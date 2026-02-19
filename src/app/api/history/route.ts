import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/* ── Yahoo Finance v8 interval + range mapping ── */

/**
 * Map our UI interval strings to Yahoo Finance v8 chart API params.
 * Yahoo v8 accepts: interval (1m,2m,5m,15m,30m,60m,1h,1d,5d,1wk,1mo,3mo)
 * and range (1d,5d,1mo,3mo,6mo,1y,2y,5y,10y,ytd,max)
 */
const INTERVAL_MAP: Record<string, { interval: string; range: string }> = {
    "1m": { interval: "1m", range: "2d" },
    "5m": { interval: "5m", range: "1mo" },
    "15m": { interval: "15m", range: "5d" },
    "30m": { interval: "30m", range: "1mo" },
    "60m": { interval: "60m", range: "3mo" },
    "1h": { interval: "60m", range: "3mo" },
    "1d": { interval: "1d", range: "1y" },
    "1D": { interval: "1d", range: "1y" },
    "1wk": { interval: "1wk", range: "5y" },
    "1W": { interval: "1wk", range: "5y" },
    "1mo": { interval: "1mo", range: "max" },
    "1M": { interval: "1mo", range: "max" },
};

/** Whether a Yahoo interval produces daily+ bars (use YYYY-MM-DD strings) */
function isDailyInterval(interval: string): boolean {
    return ["1d", "1wk", "1mo", "3mo"].includes(interval);
}

/* ── Server-side cache (1 minute for history) ── */

const CACHE_TTL_MS = 60_000;

interface HistoryCacheEntry { data: object; expiresAt: number; }

const historyCache = new Map<string, HistoryCacheEntry>();

function getCached(key: string): object | null {
    const entry = historyCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) { historyCache.delete(key); return null; }
    return entry.data;
}

function setCache(key: string, data: object): void {
    historyCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

/* ── Route ── */

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol");
    const interval = searchParams.get("interval") ?? "15m";

    if (!symbol) {
        return NextResponse.json({ error: "Missing 'symbol' query parameter" }, { status: 400 });
    }

    const yf = INTERVAL_MAP[interval] ?? { interval: "15m", range: "5d" };
    const daily = isDailyInterval(yf.interval);
    const cacheKey = `${symbol}:${yf.interval}:${yf.range}`;

    // Cache hit
    const cached = getCached(cacheKey);
    if (cached) {
        return NextResponse.json(cached, { headers: { "X-Cache": "HIT" } });
    }

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${yf.interval}&range=${yf.range}&includePrePost=false`;

    try {
        const res = await fetch(url, {
            cache: "no-store",
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; MarketFlow/1.0)",
                "Accept": "application/json",
            },
        });

        if (!res.ok) throw new Error(`Yahoo Finance HTTP ${res.status}`);

        const json = await res.json();
        const result = json?.chart?.result?.[0];

        if (!result) {
            const err = json?.chart?.error?.description ?? "No data returned";
            throw new Error(err);
        }

        const { timestamp, indicators } = result;
        const quote = indicators?.quote?.[0];

        if (!timestamp || !quote) {
            return NextResponse.json({ symbol, interval, count: 0, candles: [] });
        }

        // Build candle array — skip bars with null OHLC
        const candles: object[] = [];

        for (let i = 0; i < timestamp.length; i++) {
            const o = quote.open?.[i];
            const h = quote.high?.[i];
            const l = quote.low?.[i];
            const c = quote.close?.[i];
            const v = quote.volume?.[i];

            if (o == null || h == null || l == null || c == null) continue;

            const time = daily
                ? new Date(timestamp[i] * 1000).toISOString().split("T")[0]
                : timestamp[i]; // Unix seconds for intraday

            candles.push({ time, open: o, high: h, low: l, close: c, volume: v ?? 0 });
        }

        const response = { symbol, interval, count: candles.length, candles };
        setCache(cacheKey, response);

        return NextResponse.json(response, { headers: { "X-Cache": "MISS" } });
    } catch (err) {
        console.error(`[history/yf] Error for ${symbol}:`, err);
        return NextResponse.json(
            { error: `Failed to fetch history for ${symbol}`, detail: String(err) },
            { status: 500 }
        );
    }
}
