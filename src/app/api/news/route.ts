import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol");

    if (!symbol) {
        return NextResponse.json(
            { error: "Missing 'symbol' query parameter" },
            { status: 400 }
        );
    }

    try {
        const result = await yahooFinance.search(symbol, { newsCount: 10 });
        const raw = (result as Record<string, unknown>).news;
        const newsArray = Array.isArray(raw) ? raw : [];

        const news = newsArray.map((item: Record<string, unknown>) => ({
            uuid: (item.uuid as string) ?? "",
            title: (item.title as string) ?? "",
            link: (item.link as string) ?? "",
            publisher: (item.publisher as string) ?? "",
            providerPublishTime: (item.providerPublishTime as string) ?? null,
            type: (item.type as string) ?? "STORY",
            relatedTickers: Array.isArray(item.relatedTickers)
                ? item.relatedTickers
                : [],
        }));

        return NextResponse.json(
            { symbol, news },
            { headers: { "Cache-Control": "no-store, max-age=0" } }
        );
    } catch (err) {
        console.error(`[news] Error fetching news for ${symbol}:`, err);
        return NextResponse.json({ symbol, news: [] });
    }
}
