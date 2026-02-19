import { NextResponse } from "next/server";
import { toFHSymbol, getDisplayName, TICKER_DISPLAY_MAP } from "@/lib/finnhub";

export const dynamic = "force-dynamic";

const API_KEY = process.env.NEXT_PUBLIC_FINNHUB_API_KEY;
const BASE_URL = "https://finnhub.io/api/v1";

interface FHQuote {
    c: number;  // Current price
    d: number;  // Change
    dp: number;  // Percent change
    h: number;  // High
    l: number;  // Low
    o: number;  // Open price of the day
    pc: number;  // Previous close price
    t: number;  // Timestamp
}

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

    const rawSymbols = symbolsParam.split(",").map((s) => s.trim()).filter(Boolean);

    // Finnhub quote is per-symbol, no batch endpoint on free tier → parallel fetch
    const results = await Promise.allSettled(
        rawSymbols.map(async (rawSym) => {
            const fhSym = toFHSymbol(rawSym);
            const displaySym = TICKER_DISPLAY_MAP[fhSym] ?? rawSym;

            try {
                const url = new URL(`${BASE_URL}/quote`);
                url.searchParams.set("symbol", fhSym);
                url.searchParams.set("token", API_KEY);

                const res = await fetch(url.toString(), { cache: "no-store" });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);

                const q: FHQuote = await res.json();
                const price = q.c ?? null;

                // Finnhub returns a profile-based name; use our local lookup
                const name = getDisplayName(fhSym);

                return {
                    symbol: displaySym,
                    name,
                    shortName: name,
                    price,
                    change: q.d ?? null,
                    changePercent: q.dp ?? null,
                    dayVolume: null, // not in /quote endpoint — use WS for live vol
                    marketState: price ? "REGULAR" : "CLOSED",
                };
            } catch {
                return {
                    symbol: displaySym,
                    name: getDisplayName(toFHSymbol(rawSym)),
                    shortName: displaySym,
                    price: null, change: null, changePercent: null,
                    dayVolume: null, marketState: null,
                };
            }
        })
    );

    const data = results.map((r) =>
        r.status === "fulfilled" ? r.value : {
            symbol: "UNKNOWN", name: "Unknown", shortName: "Unknown",
            price: null, change: null, changePercent: null,
            dayVolume: null, marketState: null,
        }
    );

    return NextResponse.json(data, {
        headers: { "Cache-Control": "no-store, max-age=0" },
    });
}
