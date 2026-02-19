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

/* ── Server-side cache (per symbol+interval) ── */

const CACHE_TTL_MS = 60_000; // 1 minute for history (much less volatile)

interface HistoryCacheEntry {
    data: object;
    expiresAt: number;
}

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

/* ── Time format ── */

function toChartTime(unixSec: number, isDaily: boolean): string | number {
    if (isDaily) return new Date(unixSec * 1000).toISOString().split("T")[0];
    return unixSec;
}

/* ── Route ── */

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const rawSymbol = searchParams.get("symbol");
    const interval = searchParams.get("interval") ?? "15m";

    if (!rawSymbol) {
        return NextResponse.json({ error: "Missing 'symbol' query parameter" }, { status: 400 });
    }

    if (!API_KEY) {
        return NextResponse.json({ error: "NEXT_PUBLIC_FINNHUB_API_KEY not configured" }, { status: 500 });
    }

    const fhSymbol = toFHSymbol(rawSymbol);
    const resolution = FH_RESOLUTION_MAP[interval] ?? "15";
    const daily = isDailyResolution(resolution);
    const cacheKey = `${fhSymbol}:${resolution}`;

    // Cache hit → return immediately
    const cached = getCached(cacheKey);
    if (cached) {
        return NextResponse.json(cached, {
            headers: { "Cache-Control": "no-store", "X-Cache": "HIT" },
        });
    }

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
        if (!res.ok) throw new Error(`Finnhub HTTP ${res.status}`);

        const json = await res.json();

        if (json.s === "no_data") {
            const empty = { symbol: fhSymbol, interval, count: 0, candles: [] };
            setCache(cacheKey, empty);
            return NextResponse.json(empty);
        }

        if (json.s !== "ok") {
            throw new Error(`Finnhub error: ${JSON.stringify(json)}`);
        }

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

        const result = { symbol: fhSymbol, interval, count: candles.length, candles };
        setCache(cacheKey, result);

        return NextResponse.json(result, {
            headers: { "Cache-Control": "no-store", "X-Cache": "MISS" },
        });
    } catch (err) {
        console.error(`[history/fh] Error fetching ${fhSymbol}:`, err);
        return NextResponse.json(
            { error: `Failed to fetch history for ${rawSymbol}`, detail: String(err) },
            { status: 500 }
        );
    }
}
