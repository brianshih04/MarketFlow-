import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

export const dynamic = "force-dynamic";

// Map user-facing intervals to Yahoo Finance API intervals
const INTERVAL_MAP: Record<string, string> = {
    "1m": "1m",
    "5m": "5m",
    "10m": "15m", // Yahoo doesn't support 10m; use 15m as closest
    "15m": "15m",
    "30m": "30m",
    "1h": "1h",
    "4h": "1h",   // Will aggregate client-side or use 1h
    "1D": "1d",
    "1W": "1wk",
    "1M": "1mo",
};

// Determine appropriate lookback period based on interval
function getPeriod1(interval: string): string {
    const now = new Date();
    switch (interval) {
        case "1m":
            // Yahoo limits 1m data to last 7 days
            now.setDate(now.getDate() - 5);
            break;
        case "5m":
        case "15m":
        case "30m":
            // Intraday up to 60 days
            now.setDate(now.getDate() - 10);
            break;
        case "1h":
            now.setDate(now.getDate() - 30);
            break;
        case "1d":
            now.setFullYear(now.getFullYear() - 1);
            break;
        case "1wk":
            now.setFullYear(now.getFullYear() - 3);
            break;
        case "1mo":
            now.setFullYear(now.getFullYear() - 10);
            break;
        default:
            now.setDate(now.getDate() - 10);
    }
    return now.toISOString().split("T")[0];
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol");
    const interval = searchParams.get("interval") ?? "1D";

    if (!symbol) {
        return NextResponse.json(
            { error: "Missing 'symbol' query parameter" },
            { status: 400 }
        );
    }

    const yahooInterval = INTERVAL_MAP[interval] ?? "1d";
    const period1 = getPeriod1(yahooInterval);

    try {
        const result = await yahooFinance.chart(symbol, {
            period1,
            interval: yahooInterval as "1m" | "5m" | "15m" | "30m" | "1h" | "1d" | "1wk" | "1mo",
        });

        const candles = (result.quotes ?? [])
            .filter((q: Record<string, unknown>) => q.open != null && q.close != null)
            .map((q: Record<string, unknown>) => ({
                time: Math.floor(new Date(q.date as string).getTime() / 1000),
                open: q.open as number,
                high: q.high as number,
                low: q.low as number,
                close: q.close as number,
                volume: (q.volume as number) ?? 0,
            }));

        return NextResponse.json(
            { symbol, interval, candles },
            { headers: { "Cache-Control": "no-store, max-age=0" } }
        );
    } catch (err) {
        console.error(`[chart] Error fetching ${symbol} @ ${interval}:`, err);
        return NextResponse.json(
            { error: `Failed to fetch chart data for ${symbol}` },
            { status: 500 }
        );
    }
}
