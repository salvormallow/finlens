import {
  queryFinancialDataForChart,
  type ChartDataPoint,
} from "@/lib/db/chart-queries";
import type Anthropic from "@anthropic-ai/sdk";

// OKLCH palette for chart series
const CHART_COLORS = [
  "oklch(0.55 0.22 265)",
  "oklch(0.65 0.2 160)",
  "oklch(0.7 0.18 75)",
  "oklch(0.62 0.2 15)",
  "oklch(0.6 0.2 300)",
  "oklch(0.65 0.15 200)",
  "oklch(0.7 0.2 130)",
  "oklch(0.6 0.22 340)",
];

export interface ChartConfig {
  chartType: "bar" | "line" | "area" | "pie" | "stacked_bar";
  title: string;
  data: ChartDataPoint[];
  series: { key: string; color: string; label: string }[];
}

// Tool definition for Claude API
export const CHART_TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: "generate_chart",
    description:
      "Generate a chart visualization from the user's financial data. Use when the user asks to 'show', 'chart', 'graph', 'visualize', or 'compare' financial data. Always try to pick the best chart_type for the request.",
    input_schema: {
      type: "object" as const,
      properties: {
        chart_type: {
          type: "string",
          enum: ["bar", "line", "area", "pie", "stacked_bar"],
          description:
            "Chart type. Use bar for comparisons, line/area for trends over time, pie for proportions, stacked_bar for composition over time.",
        },
        data_query: {
          type: "object",
          properties: {
            data_types: {
              type: "array",
              items: {
                type: "string",
                enum: [
                  "income",
                  "expense",
                  "asset",
                  "liability",
                  "investment",
                ],
              },
              description:
                "Which data types to include. Most common: expense for spending, income for earnings.",
            },
            categories: {
              type: "array",
              items: { type: "string" },
              description:
                "Optional category filter (e.g., ['Dining', 'Groceries']). Leave empty for all categories.",
            },
            group_by: {
              type: "string",
              enum: ["month", "category", "week", "day"],
              description:
                "How to group the data. 'month' for trends, 'category' for breakdowns.",
            },
            months_back: {
              type: "number",
              description:
                "How many months of historical data to include (1-24). Default 6.",
            },
          },
          required: ["data_types", "group_by"],
        },
        title: {
          type: "string",
          description: "A short descriptive chart title.",
        },
      },
      required: ["chart_type", "data_query", "title"],
    },
  },
];

interface ChartToolInput {
  chart_type: "bar" | "line" | "area" | "pie" | "stacked_bar";
  data_query: {
    data_types: string[];
    categories?: string[];
    group_by: "month" | "category" | "week" | "day";
    months_back?: number;
  };
  title: string;
}

export async function executeChartTool(
  input: ChartToolInput,
  userId: string
): Promise<ChartConfig> {
  const data = await queryFinancialDataForChart(userId, {
    dataTypes: input.data_query.data_types,
    categories: input.data_query.categories,
    groupBy: input.data_query.group_by,
    monthsBack: input.data_query.months_back || 6,
  });

  // Determine series keys from the data
  const seriesKeys = new Set<string>();
  for (const point of data) {
    for (const key of Object.keys(point)) {
      if (key !== "label" && key !== "_label") {
        seriesKeys.add(key);
      }
    }
  }

  const series = Array.from(seriesKeys).map((key, i) => ({
    key,
    color: CHART_COLORS[i % CHART_COLORS.length],
    label: key,
  }));

  return {
    chartType: input.chart_type,
    title: input.title,
    data,
    series,
  };
}
