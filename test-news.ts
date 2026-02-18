import yahooFinance from "yahoo-finance2";

console.log("yahooFinance object:", yahooFinance);

async function test() {
    try {
        console.log("Fetching quote for AAPL...");
        const quote = await yahooFinance.quote("AAPL");
        console.log("Quote result:", quote ? "Found" : "Not Found");
        if (quote) console.log("Price:", quote.regularMarketPrice);

        console.log("Searching for 'AAPL'...");
        const result = await yahooFinance.search("AAPL", { newsCount: 10 });
        console.log("Search result keys:", Object.keys(result));
        console.log("News count:", result.news ? result.news.length : 0);

        if (result.news && result.news.length > 0) {
            console.log("First news item:", JSON.stringify(result.news[0], null, 2));
        } else {
            console.log("No news found in search result.");
        }

    } catch (err) {
        console.error("Test failed:", err);
    }
}

test();
