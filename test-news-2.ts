import yahooFinance from "yahoo-finance2";
import fs from "fs";

async function test() {
    const log = [];
    try {
        log.push("Starting test...");

        // Test quoteSummary with news module
        log.push("Fetching quoteSummary for AAPL with news module...");
        const result = await yahooFinance.quoteSummary("AAPL", { modules: ["news"] });

        log.push("Keys in result: " + Object.keys(result).join(", "));

        if (result.news) {
            log.push(`Found ${result.news.length} news items.`);
            if (result.news.length > 0) {
                log.push("First item: " + JSON.stringify(result.news[0], null, 2));
            }
        } else {
            log.push("No 'news' property in result.");
        }

    } catch (err) {
        log.push("Error caught: " + (err instanceof Error ? err.message : String(err)));
        if (err instanceof Error && err.stack) {
            log.push(err.stack);
        }
    } finally {
        fs.writeFileSync("test-output.txt", log.join("\n"));
        console.log("Done. Check test-output.txt");
    }
}

test();
