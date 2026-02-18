import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

export const dynamic = "force-dynamic";

const ALLOWED_TYPES = new Set(["EQUITY", "ETF", "FUTURE", "INDEX"]);

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim();

    if (!query || query.length < 1) {
        return NextResponse.json({ results: [] });
    }

    try {
        const result = await yahooFinance.search(query, {
            newsCount: 0,
            quotesCount: 10,
        });

        const raw = (result as Record<string, unknown>).quotes;
        const quotesArray = Array.isArray(raw) ? raw : [];

        const results = quotesArray
            .filter((q: Record<string, unknown>) =>
                ALLOWED_TYPES.has(q.quoteType as string)
            )
            .map((q: Record<string, unknown>) => ({
                symbol: (q.symbol as string) ?? "",
                shortname: (q.shortname as string) ?? (q.longname as string) ?? "",
                exchange: (q.exchange as string) ?? "",
                quoteType: (q.quoteType as string) ?? "",
            }));

        return NextResponse.json(
            { results },
            { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } }
        );
    } catch (err) {
        console.error(`[search] Error searching "${query}":`, err);
        return NextResponse.json({ results: [] });
    }
}
