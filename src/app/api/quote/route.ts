import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbolsParam = searchParams.get("symbols");

    if (!symbolsParam) {
        return NextResponse.json(
            { error: "Missing 'symbols' query parameter" },
            { status: 400 }
        );
    }

    // Symbols come in URL-decoded, e.g. "AAPL,NVDA,NQ=F,ES=F"
    const symbols = symbolsParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

    const results = await Promise.allSettled(
        symbols.map(async (symbol) => {
            try {
                const quote = await yahooFinance.quote(symbol);
                const q = quote as Record<string, unknown>;
                return {
                    symbol: (q.symbol as string) ?? symbol,
                    name: (q.shortName as string) ?? (q.longName as string) ?? symbol,
                    shortName: (q.shortName as string) ?? (q.longName as string) ?? symbol,
                    price: (q.regularMarketPrice as number) ?? null,
                    change: (q.regularMarketChange as number) ?? null,
                    changePercent: (q.regularMarketChangePercent as number) ?? null,
                    dayVolume: (q.regularMarketVolume as number) ?? null,
                    marketState: (q.marketState as string) ?? null,
                };
            } catch (err) {
                console.error(`[quote] Error fetching ${symbol}:`, err);
                return {
                    symbol,
                    name: symbol,
                    shortName: symbol,
                    price: null,
                    change: null,
                    changePercent: null,
                    dayVolume: null,
                    marketState: null,
                };
            }
        })
    );

    const data = results.map((r) =>
        r.status === "fulfilled"
            ? r.value
            : {
                symbol: "UNKNOWN",
                name: "Unknown",
                shortName: "Unknown",
                price: null,
                change: null,
                changePercent: null,
                dayVolume: null,
                marketState: null,
            }
    );

    return NextResponse.json(data, {
        headers: {
            "Cache-Control": "no-store, max-age=0",
        },
    });
}
