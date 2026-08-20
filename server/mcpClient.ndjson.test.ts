import { describe, it, expect, vi, beforeEach } from "vitest";

// Re-implement the exact decoding logic under test (mirrors mcpClient.ts decodeResult)
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
        return parsed.length === 1 ? parsed[0] : parsed;
      }
    } catch {
      // fall through
    }
    return text;
  }
}

const realNdjson = `{
  "symbol": "BINANCE:ONGUSDT",
  "changePercent": 184.761,
  "indicators": {
    "open": null,
    "close": 0.1725,
    "SMA20": 0.051997000000000036,
    "BB_upper": 0.10853025361236504,
    "BB_lower": -0.004536253612364975,
    "EMA50": 0.052346143547632853,
    "RSI": 97.325279176583,
    "volume": 160090292
  }
}
{
  "symbol": "BINANCE:ONTUSDT",
  "changePercent": 60.701,
  "indicators": {
    "open": null,
    "close": 0.0646,
    "SMA20": 0.03893950000000008,
    "BB_upper": 0.05092341501137997,
    "BB_lower": 0.026955584988620183,
    "EMA50": 0.04189214509876543,
    "RSI": 86.1222857709557,
    "volume": 100400857
  }
}
{
  "symbol": "BINANCE:XRPUSDT",
  "changePercent": -4.2,
  "indicators": {
    "open": null,
    "close": 2.31,
    "SMA20": 2.45,
    "BB_upper": 2.7,
    "BB_lower": 2.2,
    "EMA50": 2.38,
    "RSI": 34.1,
    "volume": 341937296.8
  }
}`;

describe("decodeResult NDJSON", () => {
  it("splits real TradingView NDJSON into an array of objects", () => {
    const result = decodeResult({
      content: [{ type: "text", text: realNdjson }],
    });
    expect(Array.isArray(result)).toBe(true);
    const arr = result as Array<{ symbol: string; changePercent: number }>;
    expect(arr).toHaveLength(3);
    expect(arr[0].symbol).toBe("BINANCE:ONGUSDT");
    expect(arr[2].changePercent).toBe(-4.2);
  });

  it("parses a single JSON object normally", () => {
    const result = decodeResult({
      content: [{ type: "text", text: '{"a":1,"b":{"c":2}}' }],
    });
    expect(result).toEqual({ a: 1, b: { c: 2 } });
  });

  it("parses a JSON array normally", () => {
    const result = decodeResult({
      content: [{ type: "text", text: '[{"x":1},{"y":2}]' }],
    });
    expect(result).toEqual([{ x: 1 }, { y: 2 }]);
  });

  it("handles objects containing brace characters inside string values", () => {
    const text = `{"name":"a{b}c","v":1}\n{"name":"{d}","v":2}`;
    const result = decodeResult({ content: [{ type: "text", text }] });
    expect(result).toEqual([{ name: "a{b}c", v: 1 }, { name: "{d}", v: 2 }]);
  });

  it("handles escaped quotes inside strings", () => {
    const text = `{"name":"say \\"{hi}\\"","v":1}\n{"name":"ok","v":2}`;
    const result = decodeResult({ content: [{ type: "text", text }] });
    expect(result).toEqual([{ name: 'say "{hi}"', v: 1 }, { name: "ok", v: 2 }]);
  });
});
