import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

export const dynamic = "force-dynamic";

/**
 * Compute period1 from a human-readable range string.
 * Examples: "1d", "5d", "1mo", "3mo", "6mo", "1y", "5y"
 */
function rangeToDate(range: string): string {
    const now = new Date();
    const num = parseInt(range, 10) || 1;
    const unit = range.replace(/\d/g, "");

    switch (unit) {
        case "d":
            now.setDate(now.getDate() - num);
            break;
        case "mo":
            now.setMonth(now.getMonth() - num);
            break;
        case "y":
            now.setFullYear(now.getFullYear() - num);
            break;
        default:
            now.setMonth(now.getMonth() - 1); // fallback: 1 month
    }
    return now.toISOString().split("T")[0];
}

/**
 * Determine whether an interval produces daily+ bars (use YYYY-MM-DD)
 * or intraday bars (use Unix timestamp in seconds).
 */
function isDailyOrAbove(interval: string): boolean {
    return ["1d", "1wk", "1mo", "3mo"].includes(interval);
}

const VALID_INTERVALS = [
    "1m", "2m", "5m", "15m", "30m", "60m", "1h",
    "1d", "5d", "1wk", "1mo", "3mo",
] as const;

type YFInterval = (typeof VALID_INTERVALS)[number];

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol");
    const range = searchParams.get("range") ?? "1mo";
    const interval = searchParams.get("interval") ?? "1d";

    if (!symbol) {
        return NextResponse.json(
            { error: "Missing 'symbol' query parameter" },
            { status: 400 }
        );
    }

    // Normalise user-friendly intervals to Yahoo format
    const intervalMap: Record<string, string> = {
        "1m": "1m", "5m": "5m", "10m": "15m", "15m": "15m",
        "30m": "30m", "1h": "1h", "1H": "1h",
        "1D": "1d", "1d": "1d", "1W": "1wk", "1wk": "1wk",
        "1M": "1mo", "1mo": "1mo",
    };
    const yfInterval = (intervalMap[interval] ?? "1d") as YFInterval;
    const period1 = rangeToDate(range);
    const daily = isDailyOrAbove(yfInterval);

    try {
        const result = await yahooFinance.chart(symbol, {
            period1,
            interval: yfInterval,
        });

        const candles = (result.quotes ?? [])
            .filter((q: Record<string, unknown>) => q.open != null && q.close != null)
            .map((q: Record<string, unknown>) => {
                const d = new Date(q.date as string);
                return {
                    // Daily bars → "YYYY-MM-DD" string; intraday → Unix seconds
                    time: daily
                        ? d.toISOString().split("T")[0]
                        : Math.floor(d.getTime() / 1000),
                    open: q.open as number,
                    high: q.high as number,
                    low: q.low as number,
                    close: q.close as number,
                    volume: (q.volume as number) ?? 0,
                };
            });

        return NextResponse.json(
            { symbol, interval: yfInterval, range, count: candles.length, candles },
            { headers: { "Cache-Control": "no-store, max-age=0" } }
        );
    } catch (err) {
        console.error(`[history] Error fetching ${symbol}:`, err);
        return NextResponse.json(
            { error: `Failed to fetch history for ${symbol}`, detail: String(err) },
            { status: 500 }
        );
    }
}
