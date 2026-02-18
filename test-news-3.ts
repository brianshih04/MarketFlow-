import YahooFinance from "yahoo-finance2";
import fs from "fs";

async function test() {
    const log = [];
    try {
        log.push("Instantiating YahooFinance...");
        const yahooFinance = new YahooFinance();

        const symbol = "NQ=F";
        log.push(`Fetching quoteSummary for ${symbol} with news module...`);

        // In some versions, you might need to suppress notices
        // yahooFinance.suppressNotices(['yahooSurvey']);

        const result = await yahooFinance.quoteSummary(symbol, { modules: ["news"] });

        log.push("Keys in result: " + Object.keys(result).join(", "));

        if (result.news) {
            log.push(`Found ${result.news.length} news items.`);
            if (result.news.length > 0) {
                log.push("First item title: " + result.news[0].title);
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
        fs.writeFileSync("test-output-3.txt", log.join("\n"));
    }
}

test();
