import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const MCP_URL = process.env.MCP_SERVICE_URL ?? "http://tradingview-mcp:8000/mcp";
const MCP_TIMEOUT_MS = 20_000;
const MCP_MAX_ATTEMPTS = 2;

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
    // The TradingView MCP sometimes emits NDJSON (several JSON objects printed one
    // after another without an enclosing array). Try to recover a structured array.
    try {
      const trimmed = text.trim();
      if (trimmed.startsWith("[")) {
        return JSON.parse(trimmed) as unknown;
      }
      if (trimmed.startsWith("{")) {
        const parts: string[] = [];
        let depth = 0;
        let buf = "";
        let inStr = false;
        let esc = false;
        for (const ch of trimmed) {
          buf += ch;
          if (inStr) {
            if (esc) {
              esc = false;
            } else if (ch === "\\") {
              esc = true;
            } else if (ch === '"') {
              inStr = false;
            }
            continue;
          }
          if (ch === '"') {
            inStr = true;
          } else if (ch === "{") {
            depth += 1;
          } else if (ch === "}") {
            depth -= 1;
          }
          if (depth === 0 && buf.trim()) {
            parts.push(buf.trim());
            buf = "";
          }
        }
        if (buf.trim()) parts.push(buf.trim());
        const parsed = parts.map(p => JSON.parse(p));
        // Single object: wrap so callers always get an iterable structure.
        return parsed.length === 1 ? parsed[0] : parsed;
      }
    } catch {
      // Fall through and return the raw text.
    }
    return text;
  }
}

type McpConnection = { client: Client; transport: StreamableHTTPClientTransport };
let activeConnection: McpConnection | null = null;
let connecting: Promise<McpConnection> | null = null;

function withTimeout<T>(operation: Promise<T>, context: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${context} تجاوز مهلة ${MCP_TIMEOUT_MS / 1000} ثانية`)), MCP_TIMEOUT_MS);
    operation.then(
      value => { clearTimeout(timer); resolve(value); },
      error => { clearTimeout(timer); reject(error); },
    );
  });
}

async function createConnection(): Promise<McpConnection> {
  const client = new Client(
    { name: "amic-market-bridge", version: "1.0.0" },
    { capabilities: {} },
  );
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL));
  await withTimeout(client.connect(transport), "اتصال TradingView MCP");
  return { client, transport };
}

async function getConnection(): Promise<McpConnection> {
  if (activeConnection) return activeConnection;
  if (!connecting) {
    connecting = createConnection().then(connection => {
      activeConnection = connection;
      return connection;
    }).finally(() => { connecting = null; });
  }
  return connecting;
}

async function invalidateConnection(connection: McpConnection) {
  if (activeConnection !== connection) return;
  activeConnection = null;
  await connection.transport.close().catch(() => undefined);
}

export async function closeTradingViewMcpConnection() {
  if (activeConnection) await invalidateConnection(activeConnection);
}

async function withMcpClient<T>(handler: (client: Client) => Promise<T>): Promise<T> {
  let lastCause: unknown;

  for (let attempt = 1; attempt <= MCP_MAX_ATTEMPTS; attempt += 1) {
    let connection: McpConnection | null = null;
    try {
      connection = await getConnection();
      return await withTimeout(handler(connection.client), "طلب TradingView MCP");
    } catch (cause) {
      lastCause = cause;
      if (connection) await invalidateConnection(connection);
    }
  }

  const reason = lastCause instanceof Error ? lastCause.message : "فشل غير معروف";
  throw new Error(`تعذر تنفيذ طلب TradingView MCP بعد محاولة إعادة اتصال واحدة: ${reason}. تحقق من جاهزية مزود التحليل أو بنية استجابته.`);
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
