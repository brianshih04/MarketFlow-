import { NextResponse } from "next/server";
import {
    toTDSymbol,
    TD_INTERVAL_MAP,
    isDailyInterval,
    outputsizeForInterval,
} from "@/lib/twelve-data";

export const dynamic = "force-dynamic";

const API_KEY = process.env.TWELVE_DATA_API_KEY;
const BASE_URL = "https://api.twelvedata.com";

/**
 * Parse a Twelve Data datetime string to the appropriate chart time format.
 *   Intraday  → Unix seconds (number)
 *   Daily+    → "YYYY-MM-DD" string
 *
 * TD datetimes: "2024-01-15 09:30:00" or "2024-01-15"
 */
function parseDateTime(datetime: string, isDaily: boolean): number | string {
    if (isDaily) {
        // Already "YYYY-MM-DD", but may have time component — strip it
        return datetime.split(" ")[0];
    }
    // Intraday: convert "YYYY-MM-DD HH:MM:SS" → Unix seconds
    // TD returns times in the exchange's local timezone; treat as ET (UTC-5 winter)
    const isoish = datetime.replace(" ", "T") + "-05:00";
    const d = new Date(isoish);
    return Math.floor(d.getTime() / 1000);
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
            { error: "TWELVE_DATA_API_KEY not configured" },
            { status: 500 }
        );
    }

    // Map user symbol → Twelve Data symbol
    const tdSymbol = toTDSymbol(rawSymbol);
    const tdInterval = TD_INTERVAL_MAP[interval] ?? "15min";
    const daily = isDailyInterval(tdInterval);
    const outputsize = outputsizeForInterval(tdInterval);

    const url = new URL(`${BASE_URL}/time_series`);
    url.searchParams.set("symbol", tdSymbol);
    url.searchParams.set("interval", tdInterval);
    url.searchParams.set("outputsize", String(outputsize));
    url.searchParams.set("apikey", API_KEY);

    try {
        const res = await fetch(url.toString(), { cache: "no-store" });
        if (!res.ok) {
            throw new Error(`Twelve Data HTTP ${res.status}`);
        }

        const json = await res.json();

        if (json.status === "error") {
            throw new Error(json.message ?? "Twelve Data API error");
        }

        // json.values is newest-first; we need oldest-first for Lightweight Charts
        const raw: Array<{
            datetime: string;
            open: string;
            high: string;
            low: string;
            close: string;
            volume?: string;
        }> = Array.isArray(json.values) ? json.values : [];

        const candles = raw
            .reverse() // oldest → newest
            .filter((v) => v.open && v.close) // filter incomplete rows
            .map((v) => ({
                time: parseDateTime(v.datetime, daily),
                open: parseFloat(v.open),
                high: parseFloat(v.high),
                low: parseFloat(v.low),
                close: parseFloat(v.close),
                volume: v.volume ? parseFloat(v.volume) : 0,
            }));

        return NextResponse.json(
            { symbol: tdSymbol, interval: tdInterval, count: candles.length, candles },
            { headers: { "Cache-Control": "no-store, max-age=0" } }
        );
    } catch (err) {
        console.error(`[history/td] Error fetching ${tdSymbol}:`, err);
        return NextResponse.json(
            { error: `Failed to fetch history for ${rawSymbol}`, detail: String(err) },
            { status: 500 }
        );
    }
}
