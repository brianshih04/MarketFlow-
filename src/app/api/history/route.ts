import { NextResponse } from "next/server";
import {
    toFHSymbol,
    FH_RESOLUTION_MAP,
    isDailyResolution,
    fromTimestampForInterval,
} from "@/lib/finnhub";

export const dynamic = "force-dynamic";

const API_KEY = process.env.NEXT_PUBLIC_FINNHUB_API_KEY;
const BASE_URL = "https://finnhub.io/api/v1";

/**
 * Format a Unix timestamp for Lightweight Charts:
 *   - Daily+ → "YYYY-MM-DD" string
 *   - Intraday → Unix seconds (number, as-is)
 */
function toChartTime(unixSec: number, isDaily: boolean): string | number {
    if (isDaily) {
        const d = new Date(unixSec * 1000);
        return d.toISOString().split("T")[0];
    }
    return unixSec;
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const rawSymbol = searchParams.get("symbol");
    const interval = searchParams.get("interval") ?? "15m";

    if (!rawSymbol) {
        return NextResponse.json(
            { error: "Missing 'symbol' query parameter" },
            { status: 400 }
        );
    }

    if (!API_KEY) {
        return NextResponse.json(
            { error: "NEXT_PUBLIC_FINNHUB_API_KEY not configured" },
            { status: 500 }
        );
    }

    const fhSymbol = toFHSymbol(rawSymbol);
    const resolution = FH_RESOLUTION_MAP[interval] ?? "15";
    const daily = isDailyResolution(resolution);
    const from = fromTimestampForInterval(interval);
    const to = Math.floor(Date.now() / 1000);

    const url = new URL(`${BASE_URL}/stock/candle`);
    url.searchParams.set("symbol", fhSymbol);
    url.searchParams.set("resolution", resolution);
    url.searchParams.set("from", String(from));
    url.searchParams.set("to", String(to));
    url.searchParams.set("token", API_KEY);

    try {
        const res = await fetch(url.toString(), { cache: "no-store" });

        if (!res.ok) {
            throw new Error(`Finnhub HTTP ${res.status}`);
        }

        const json = await res.json();

        // Finnhub returns { s: "no_data" } when there's nothing available
        if (json.s === "no_data") {
            return NextResponse.json({ symbol: fhSymbol, interval, count: 0, candles: [] });
        }

        if (json.s !== "ok") {
            throw new Error(`Finnhub error: ${JSON.stringify(json)}`);
        }

        // Construct candles from parallel arrays: c, h, l, o, t, v
        const { c, h, l, o, t, v } = json as {
            c: number[]; h: number[]; l: number[];
            o: number[]; t: number[]; v: number[];
        };

        const candles = t.map((timestamp: number, i: number) => ({
            time: toChartTime(timestamp, daily),
            open: o[i],
            high: h[i],
            low: l[i],
            close: c[i],
            volume: v?.[i] ?? 0,
        }));

        // Finnhub returns oldest-first already — no reversal needed
        return NextResponse.json(
            { symbol: fhSymbol, interval, count: candles.length, candles },
            { headers: { "Cache-Control": "no-store, max-age=0" } }
        );
    } catch (err) {
        console.error(`[history/fh] Error fetching ${fhSymbol}:`, err);
        return NextResponse.json(
            { error: `Failed to fetch history for ${rawSymbol}`, detail: String(err) },
            { status: 500 }
        );
    }
}
