"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { InlineChart } from "@/components/chat/inline-chart";
import { Send, Bot, User, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface ChartConfig {
  chartType: "bar" | "line" | "area" | "pie" | "stacked_bar";
  title: string;
  data: Record<string, string | number>[];
  series: { key: string; color: string; label: string }[];
}

interface MessagePart {
  type: "text" | "chart";
  content?: string;
  config?: ChartConfig;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  parts: MessagePart[];
}

const SUGGESTED_QUESTIONS = [
  "Show me my expenses by category as a pie chart",
  "Chart my spending trends over the last 6 months",
  "Compare my income vs expenses month by month",
  "What would happen if I maxed out my 401k?",
  "Where can I cut expenses the most?",
  "Am I on track for my financial goals?",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Load chat history on mount
  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetch("/api/chat");
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data.messages) && data.messages.length > 0) {
          setMessages(
            data.messages.map(
              (m: { id: string; role: string; content: string }) => ({
                id: m.id,
                role: m.role as "user" | "assistant",
                parts: [{ type: "text" as const, content: m.content }],
              })
            )
          );
        }
      } catch {
        // Silent fail
      } finally {
        setHistoryLoaded(true);
      }
    }
    loadHistory();
  }, []);

  const handleSend = async (text?: string) => {
    const messageText = (text || input).trim();
    if (!messageText || loading) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      parts: [{ type: "text", content: messageText }],
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageText }),
      });

      if (!response.ok) throw new Error("Chat request failed");
      if (!response.body) throw new Error("No response body");

      const assistantId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", parts: [] },
      ]);

      // Parse NDJSON stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const event = JSON.parse(line);

            if (event.type === "text") {
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.id !== assistantId) return m;
                  const parts = [...m.parts];
                  const lastPart = parts[parts.length - 1];
                  if (lastPart?.type === "text") {
                    parts[parts.length - 1] = {
                      ...lastPart,
                      content: (lastPart.content || "") + event.content,
                    };
                  } else {
                    parts.push({ type: "text", content: event.content });
                  }
                  return { ...m, parts };
                })
              );
            } else if (event.type === "chart") {
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.id !== assistantId) return m;
                  return {
                    ...m,
                    parts: [
                      ...m.parts,
                      { type: "chart", config: event.config },
                    ],
                  };
                })
              );
            }
          } catch {
            // If not valid JSON, treat as plain text (backwards compat)
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== assistantId) return m;
                const parts = [...m.parts];
                const lastPart = parts[parts.length - 1];
                if (lastPart?.type === "text") {
                  parts[parts.length - 1] = {
                    ...lastPart,
                    content: (lastPart.content || "") + line,
                  };
                } else {
                  parts.push({ type: "text", content: line });
                }
                return { ...m, parts };
              })
            );
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        try {
          const event = JSON.parse(buffer);
          if (event.type === "text") {
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== assistantId) return m;
                const parts = [...m.parts];
                const lastPart = parts[parts.length - 1];
                if (lastPart?.type === "text") {
                  parts[parts.length - 1] = {
                    ...lastPart,
                    content: (lastPart.content || "") + event.content,
                  };
                } else {
                  parts.push({ type: "text", content: event.content });
                }
                return { ...m, parts };
              })
            );
          } else if (event.type === "chart") {
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== assistantId) return m;
                return {
                  ...m,
                  parts: [
                    ...m.parts,
                    { type: "chart", config: event.config },
                  ],
                };
              })
            );
          }
        } catch {
          // Ignore
        }
      }
    } catch {
      toast.error("Failed to get response. Please try again.");
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && last.parts.length === 0) {
          return prev.slice(0, -1);
        }
        return prev;
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = async () => {
    try {
      const res = await fetch("/api/chat", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to clear");
      setMessages([]);
      toast.success("Conversation cleared");
    } catch {
      toast.error("Failed to clear conversation");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const hasContent = (msg: Message) =>
    msg.parts.length > 0 &&
    msg.parts.some(
      (p) => (p.type === "text" && p.content) || p.type === "chart"
    );

  const showTypingIndicator =
    loading &&
    (messages.length === 0 ||
      messages[messages.length - 1]?.role !== "assistant" ||
      !hasContent(messages[messages.length - 1]));

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Financial Chat</h1>
          <p className="text-muted-foreground text-sm">
            Ask questions about your finances — powered by AI
          </p>
        </div>
        {messages.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleClearHistory}>
            <Trash2 className="h-4 w-4 mr-2" />
            New Chat
          </Button>
        )}
      </div>

      <div className="flex-1 border border-border rounded-lg bg-card overflow-hidden flex flex-col">
        <ScrollArea className="flex-1 p-4">
          {!historyLoaded ? (
            <div className="flex items-center justify-center h-full min-h-[400px]">
              <div className="flex gap-1">
                <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" />
                <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0.2s]" />
                <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center space-y-6">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                <Sparkles className="h-8 w-8 text-white" />
              </div>
              <div className="space-y-2 max-w-md">
                <h2 className="text-lg font-semibold">
                  Ask me anything about your finances
                </h2>
                <p className="text-sm text-muted-foreground">
                  I have context of all your uploaded financial data and can help
                  with projections, comparisons, and what-if scenarios. Try
                  asking me to chart your data!
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg w-full">
                {SUGGESTED_QUESTIONS.map((question) => (
                  <button
                    key={question}
                    onClick={() => handleSend(question)}
                    className="text-left text-xs p-3 rounded-lg border border-border/50 hover:bg-primary/5 hover:border-primary/20 transition-all text-muted-foreground hover:text-foreground"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${
                    message.role === "user" ? "justify-end" : ""
                  }`}
                >
                  {message.role === "assistant" && (
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center shrink-0 shadow-md shadow-indigo-500/20">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] ${
                      message.role === "user"
                        ? "rounded-lg px-4 py-3 text-sm bg-gradient-to-r from-indigo-500 to-indigo-400 text-white"
                        : ""
                    }`}
                  >
                    {message.role === "user" ? (
                      <span className="whitespace-pre-wrap">
                        {message.parts
                          .filter((p) => p.type === "text")
                          .map((p) => p.content)
                          .join("")}
                      </span>
                    ) : hasContent(message) ? (
                      <div className="space-y-2">
                        {message.parts.map((part, idx) =>
                          part.type === "text" && part.content ? (
                            <div
                              key={idx}
                              className="rounded-lg px-4 py-3 text-sm whitespace-pre-wrap bg-muted/80 backdrop-blur-sm"
                            >
                              {part.content}
                            </div>
                          ) : part.type === "chart" && part.config ? (
                            <InlineChart key={idx} config={part.config} />
                          ) : null
                        )}
                      </div>
                    ) : (
                      <div className="rounded-lg px-4 py-3 bg-muted/80 backdrop-blur-sm">
                        <div className="flex gap-1">
                          <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" />
                          <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0.2s]" />
                          <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0.4s]" />
                        </div>
                      </div>
                    )}
                  </div>
                  {message.role === "user" && (
                    <div className="h-8 w-8 rounded-full bg-muted/80 flex items-center justify-center shrink-0">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </div>
              ))}
              {showTypingIndicator &&
                messages[messages.length - 1]?.role === "user" && (
                  <div className="flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center shrink-0 shadow-md shadow-indigo-500/20">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                    <div className="bg-muted/80 backdrop-blur-sm rounded-lg px-4 py-3">
                      <div className="flex gap-1">
                        <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" />
                        <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0.2s]" />
                        <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0.4s]" />
                      </div>
                    </div>
                  </div>
                )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        <div className="border-t border-border p-4">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your finances or request a chart..."
              disabled={loading}
              className="flex-1"
            />
            <Button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              size="icon"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 text-center">
            AI responses are for informational purposes only. Consult a
            financial advisor for professional advice.
          </p>
        </div>
      </div>
    </div>
  );
}
