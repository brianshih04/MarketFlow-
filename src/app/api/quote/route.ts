import { NextResponse } from "next/server";
import { toTDSymbol, getDisplayName, TICKER_DISPLAY_MAP } from "@/lib/twelve-data";

export const dynamic = "force-dynamic";

const API_KEY = process.env.TWELVE_DATA_API_KEY;
const BASE_URL = "https://api.twelvedata.com";

interface TDQuote {
    symbol: string;
    name: string;
    exchange: string;
    currency: string;
    datetime: string;
    open: string;
    high: string;
    low: string;
    close: string;
    volume: string;
    previous_close: string;
    change: string;
    percent_change: string;
    is_market_open: boolean;
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
            { error: "TWELVE_DATA_API_KEY not configured" },
            { status: 500 }
        );
    }

    // Map each incoming symbol to its Twelve Data equivalent
    const rawSymbols = symbolsParam.split(",").map((s) => s.trim()).filter(Boolean);
    const tdSymbols = rawSymbols.map(toTDSymbol);

    const url = new URL(`${BASE_URL}/quote`);
    url.searchParams.set("symbol", tdSymbols.join(","));
    url.searchParams.set("apikey", API_KEY);

    try {
        const res = await fetch(url.toString(), { cache: "no-store" });
        if (!res.ok) throw new Error(`Twelve Data HTTP ${res.status}`);

        const json = await res.json();

        // For a single symbol TD returns the object directly;
        // for multiple it returns { "AAPL": {...}, "NVDA": {...} }
        const resultsMap = tdSymbols.length === 1
            ? { [tdSymbols[0]]: json }
            : (json as Record<string, TDQuote>);

        const data = rawSymbols.map((rawSym, idx) => {
            const tdSym = tdSymbols[idx];
            const q = resultsMap[tdSym] as TDQuote | undefined;
            const displaySym = TICKER_DISPLAY_MAP[tdSym] ?? rawSym;

            if (!q || q.close == null) {
                return {
                    symbol: displaySym,
                    name: getDisplayName(tdSym),
                    shortName: getDisplayName(tdSym),
                    price: null,
                    change: null,
                    changePercent: null,
                    dayVolume: null,
                    marketState: null,
                };
            }

            return {
                symbol: displaySym,
                name: q.name || getDisplayName(tdSym),
                shortName: q.name || getDisplayName(tdSym),
                price: parseFloat(q.close),
                change: parseFloat(q.change),
                changePercent: parseFloat(q.percent_change),
                dayVolume: q.volume ? parseFloat(q.volume) : null,
                marketState: q.is_market_open ? "REGULAR" : "CLOSED",
            };
        });

        return NextResponse.json(data, {
            headers: { "Cache-Control": "no-store, max-age=0" },
        });
    } catch (err) {
        console.error("[quote/td] Error:", err);
        // Return nulls for all symbols on error so UI degrades gracefully
        const fallback = rawSymbols.map((s) => ({
            symbol: s, name: s, shortName: s,
            price: null, change: null, changePercent: null,
            dayVolume: null, marketState: null,
        }));
        return NextResponse.json(fallback, {
            headers: { "Cache-Control": "no-store, max-age=0" },
        });
    }
}
