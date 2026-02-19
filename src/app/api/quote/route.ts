import { NextResponse } from "next/server";
import { toFHSymbol, getDisplayName, TICKER_DISPLAY_MAP } from "@/lib/finnhub";

export const dynamic = "force-dynamic";

const API_KEY = process.env.NEXT_PUBLIC_FINNHUB_API_KEY;
const BASE_URL = "https://finnhub.io/api/v1";

/* ── Server-side in-memory cache (survives between requests in the same process) ── */

const CACHE_TTL_MS = 15_000; // 15 seconds

interface CacheEntry {
    data: object[];
    expiresAt: number;
}

// Module-level cache — shared across all requests to this route handler
const quoteCache = new Map<string, CacheEntry>();

function getCached(key: string): object[] | null {
    const entry = quoteCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        quoteCache.delete(key);
        return null;
    }
    return entry.data;
}

function setCache(key: string, data: object[]): void {
    quoteCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

/* ── Finnhub /quote response shape ── */

interface FHQuote {
    c: number;   // Current price
    d: number;   // Change
    dp: number;   // Percent change
    h: number;   // High of day
    l: number;   // Low of day
    o: number;   // Open price of day
    pc: number;   // Previous close
    t: number;   // Timestamp
}

/* ── Route handler ── */

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbolsParam = searchParams.get("symbols");

    if (!symbolsParam) {
        return NextResponse.json(
            { error: "Missing 'symbols' query parameter" },
            { status: 400 }
        );
    }

    if (!API_KEY) {
        return NextResponse.json(
            { error: "NEXT_PUBLIC_FINNHUB_API_KEY not configured" },
            { status: 500 }
        );
    }

    const cacheKey = symbolsParam; // Use raw param as cache key

    // ── Cache hit: return immediately, 0 Finnhub calls ──
    const cached = getCached(cacheKey);
    if (cached) {
        return NextResponse.json(cached, {
            headers: {
                "Cache-Control": "no-store, max-age=0",
                "X-Cache": "HIT",
            },
        });
    }

    const rawSymbols = symbolsParam.split(",").map((s) => s.trim()).filter(Boolean);

    // ── Sequential fetch to avoid bursting Finnhub rate limit ──
    // 4 symbols × 1 call = 4 calls; with 15s cache this is max 4 calls per 15s = 16/min
    const results: object[] = [];

    for (const rawSym of rawSymbols) {
        const fhSym = toFHSymbol(rawSym);
        const displaySym = TICKER_DISPLAY_MAP[fhSym] ?? rawSym;

        try {
            const url = new URL(`${BASE_URL}/quote`);
            url.searchParams.set("symbol", fhSym);
            url.searchParams.set("token", API_KEY);

            const res = await fetch(url.toString(), { cache: "no-store" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const q: FHQuote = await res.json();
            const name = getDisplayName(fhSym);

            results.push({
                symbol: displaySym,
                name,
                shortName: name,
                price: q.c ?? null,
                change: q.d ?? null,
                changePercent: q.dp ?? null,
                dayVolume: null,
                marketState: q.c ? "REGULAR" : "CLOSED",
            });
        } catch {
            results.push({
                symbol: displaySym,
                name: getDisplayName(fhSym),
                shortName: displaySym,
                price: null,
                change: null,
                changePercent: null,
                dayVolume: null,
                marketState: null,
            });
        }
    }

    // Cache the successful batch result
    setCache(cacheKey, results);

    return NextResponse.json(results, {
        headers: {
            "Cache-Control": "no-store, max-age=0",
            "X-Cache": "MISS",
        },
    });
}
