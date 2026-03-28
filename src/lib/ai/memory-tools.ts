import type Anthropic from "@anthropic-ai/sdk";
import {
  saveMemoryNote,
  getMemoryNotes,
  updateMemoryNote,
  deactivateMemoryNote,
  upsertClientProfile,
} from "@/lib/db/memory";
import type { MemoryNoteCategory } from "@/types/financial";

// Tool definitions for Claude API
export const MEMORY_TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: "save_memory",
    description:
      "Save an important fact, plan, correction, preference, or follow-up about the client to your memory. " +
      "Use this when the client reveals something worth remembering across sessions — life events, financial plans, " +
      "corrections to previous assumptions, communication preferences, or things you promised to follow up on. " +
      "Before saving, mentally check if you've already saved a similar note — if so, use update_memory instead. " +
      "NEVER save: account numbers, SSNs, passwords, exact dollar amounts (those are in the financial data), or emotional states.",
    input_schema: {
      type: "object" as const,
      properties: {
        category: {
          type: "string",
          enum: [
            "life_event",
            "financial_plan",
            "correction",
            "preference",
            "follow_up",
            "pattern",
          ],
          description:
            "life_event: marriage, new job, baby, etc. financial_plan: buying a house, switching careers, etc. " +
            "correction: client corrected a previous assumption. preference: communication or advice preferences. " +
            "follow_up: something you committed to revisit. pattern: observed behavioral pattern (e.g. consistently declines crypto advice).",
        },
        content: {
          type: "string",
          description:
            "A concise, self-contained note. Write it as if another advisor would read it. " +
            "Example: 'Client plans to purchase a home in Q3 2027 in the Portland, OR area.'",
        },
      },
      required: ["category", "content"],
    },
  },
  {
    name: "update_memory",
    description:
      "Update an existing memory note when the client provides new information that supersedes a previous note. " +
      "Use the note_id from the Client Memory Brief in the system prompt.",
    input_schema: {
      type: "object" as const,
      properties: {
        note_id: {
          type: "string",
          description: "The ID of the existing memory note to update.",
        },
        content: {
          type: "string",
          description: "The updated content for this note.",
        },
      },
      required: ["note_id", "content"],
    },
  },
  {
    name: "retire_memory",
    description:
      "Mark a memory note as no longer active. Use when a fact is no longer true " +
      "(e.g., client decided not to buy a house after all).",
    input_schema: {
      type: "object" as const,
      properties: {
        note_id: {
          type: "string",
          description: "The ID of the memory note to retire.",
        },
      },
      required: ["note_id"],
    },
  },
  {
    name: "propose_profile_update",
    description:
      "Propose an update to the client's profile. This should be used when you've learned enough about the client " +
      "to suggest their risk tolerance, financial literacy level, communication style, or life stage. " +
      "The client will see a confirmation prompt before the update is applied. " +
      "Only propose fields you are confident about based on conversation evidence.",
    input_schema: {
      type: "object" as const,
      properties: {
        risk_tolerance: {
          type: "string",
          enum: ["conservative", "moderate", "aggressive"],
          description: "Client's investment risk tolerance.",
        },
        financial_literacy: {
          type: "string",
          enum: ["beginner", "intermediate", "advanced"],
          description: "Client's level of financial knowledge.",
        },
        communication_preference: {
          type: "string",
          enum: ["concise", "detailed", "conversational"],
          description: "How the client prefers to receive information.",
        },
        life_stage: {
          type: "string",
          enum: ["early_career", "mid_career", "pre_retirement", "retired"],
          description: "Client's career/life stage.",
        },
      },
    },
  },
];

// Tool execution handlers

interface SaveMemoryInput {
  category: MemoryNoteCategory;
  content: string;
}

interface UpdateMemoryInput {
  note_id: string;
  content: string;
}

interface RetireMemoryInput {
  note_id: string;
}

interface ProposeProfileUpdateInput {
  risk_tolerance?: string;
  financial_literacy?: string;
  communication_preference?: string;
  life_stage?: string;
}

export interface MemoryToolResult {
  success: boolean;
  tool_name: string;
  detail: string;
  // For propose_profile_update, include the proposed fields for UI confirmation
  proposed_fields?: Record<string, string>;
}

export async function executeMemoryTool(
  toolName: string,
  input: unknown,
  userId: string,
  sourceMessageId?: string
): Promise<MemoryToolResult> {
  switch (toolName) {
    case "save_memory": {
      const { category, content } = input as SaveMemoryInput;
      await saveMemoryNote(userId, category, content, "chat", sourceMessageId);
      return {
        success: true,
        tool_name: toolName,
        detail: `Saved ${category} note: "${content}"`,
      };
    }

    case "update_memory": {
      const { note_id, content } = input as UpdateMemoryInput;
      const updated = await updateMemoryNote(note_id, userId, content);
      if (!updated) {
        return {
          success: false,
          tool_name: toolName,
          detail: "Note not found or not owned by this user.",
        };
      }
      return {
        success: true,
        tool_name: toolName,
        detail: `Updated note: "${content}"`,
      };
    }

    case "retire_memory": {
      const { note_id } = input as RetireMemoryInput;
      const retired = await deactivateMemoryNote(note_id, userId);
      if (!retired) {
        return {
          success: false,
          tool_name: toolName,
          detail: "Note not found or not owned by this user.",
        };
      }
      return {
        success: true,
        tool_name: toolName,
        detail: "Note retired successfully.",
      };
    }

    case "propose_profile_update": {
      const fields = input as ProposeProfileUpdateInput;
      // Apply the profile update directly — the UI will show confirmation
      await upsertClientProfile(userId, fields);
      return {
        success: true,
        tool_name: toolName,
        detail: "Profile updated.",
        proposed_fields: fields as Record<string, string>,
      };
    }

    default:
      return {
        success: false,
        tool_name: toolName,
        detail: `Unknown memory tool: ${toolName}`,
      };
  }
}
