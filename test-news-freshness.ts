import YahooFinance from "yahoo-finance2";

async function test() {
    const yahooFinance = new YahooFinance();

    try {
        console.log("Searching 'AAPL' news...");
        const result = await yahooFinance.search("AAPL", { newsCount: 10 });

        if (result.news) {
            console.log(`Found ${result.news.length} items.`);
            result.news.forEach((n, i) => {
                console.log(`[${i}] ${n.providerPublishTime} - ${n.title}`);
            });
        }

        // Check if there is a direct 'news' method or similar by inspecting the object? 
        // Typescript might complain but runtime might have it if updated.
        // Actually, let's just stick to what we know.

        // Attempting strict query if possible?

    } catch (err) {
        console.error("Error:", err);
    }
}

test();
