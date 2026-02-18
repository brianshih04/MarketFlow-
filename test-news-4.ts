import YahooFinance from "yahoo-finance2";
import fs from "fs";

async function test() {
    const log = [];
    try {
        const yahooFinance = new YahooFinance();

        // Test 1: AAPL
        log.push("Searching AAPL...");
        const res1 = await yahooFinance.search("AAPL", { newsCount: 5 });
        log.push(`AAPL news count: ${res1.news ? res1.news.length : 0}`);
        if (res1.news && res1.news.length > 0) {
            log.push("First AAPL news title: " + res1.news[0].title);
        }

        // Test 2: NQ=F
        log.push("Searching NQ=F...");
        const res2 = await yahooFinance.search("NQ=F", { newsCount: 5 });
        log.push(`NQ=F news count: ${res2.news ? res2.news.length : 0}`);

    } catch (err) {
        log.push("Error caught: " + (err instanceof Error ? err.message : String(err)));
    } finally {
        fs.writeFileSync("test-output-4.txt", log.join("\n"));
    }
}

test();
