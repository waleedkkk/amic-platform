import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const MCP_URL = process.env.MCP_SERVICE_URL ?? "http://tradingview-mcp:8000/mcp";
const MCP_TIMEOUT_MS = 20_000;

export const TRADINGVIEW_TOOL_NAMES = [
  "top_gainers",
  "top_losers",
  "bollinger_scan",
  "rating_filter",
  "coin_analysis",
  "consecutive_candles_scan",
  "advanced_candle_pattern",
  "volume_breakout_scanner",
  "volume_confirmation_analysis",
  "smart_volume_scanner",
  "multi_agent_analysis",
  "egx_market_overview",
  "egx_sector_scan",
  "egx_sector_scanner",
  "egx_index_analysis",
  "egx_stock_screener",
  "egx_trade_plan",
  "egx_fibonacci_retracement",
  "multi_timeframe_analysis",
  "market_sentiment",
  "financial_news",
  "combined_analysis",
  "backtest_strategy",
  "compare_strategies",
  "walk_forward_backtest_strategy",
  "yahoo_price",
  "market_snapshot",
  "bitcoin_market_pulse",
  "stock_extended_hours",
  "stock_options_chain",
  "stock_options_unusual_activity",
  "futures_market_overview",
  "futures_top_movers",
  "futures_category_snapshot",
  "futures_watchlist",
  "stock_screener",
  "stock_prices",
  "exchanges_list",
] as const;

export type TradingViewToolName = (typeof TRADINGVIEW_TOOL_NAMES)[number];

export type MCPToolDescription = {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
};

function decodeResult(result: unknown) {
  if (!result || typeof result !== "object") return result;
  const response = result as { content?: Array<{ type?: string; text?: string }>; toolResult?: unknown };
  if (!Array.isArray(response.content)) return response.toolResult ?? result;

  const text = response.content
    .filter(item => item.type === "text" && typeof item.text === "string")
    .map(item => item.text)
    .join("\n");

  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function withMcpClient<T>(handler: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client(
    { name: "amic-market-bridge", version: "1.0.0" },
    { capabilities: {} },
  );
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
    requestInit: { signal: AbortSignal.timeout(MCP_TIMEOUT_MS) },
  });

  await client.connect(transport);
  try {
    return await handler(client);
  } finally {
    await transport.close();
  }
}

export async function listTradingViewTools(): Promise<MCPToolDescription[]> {
  return withMcpClient(async client => {
    const result = await client.listTools();
    return result.tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema as Record<string, unknown>,
    }));
  });
}

export async function callTradingViewTool(
  name: TradingViewToolName,
  args: Record<string, unknown>,
): Promise<unknown> {
  if (!TRADINGVIEW_TOOL_NAMES.includes(name)) {
    throw new Error(`Unsupported TradingView MCP tool: ${name}`);
  }

  return withMcpClient(async client => {
    const result = await client.callTool({ name, arguments: args });
    return decodeResult(result);
  });
}
