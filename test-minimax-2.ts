import OpenAI from "openai";

const apiKey = "sk-api-FZ9HPLas0n8jMyk4UEoLxjrYC7ZFc1-CVkylUpklpVmqsmQU6QRH_-qpuH2cfYkPuOulQBxFAs9cqri2I7g01r2HD5aUURidQis29gT8PGzgeycEY57p2ro";

async function testEndpoint(url: string) {
    console.log(`\nTesting ${url} ...`);
    const openai = new OpenAI({
        apiKey: apiKey,
        baseURL: url,
        timeout: 10000,
    });

    try {
        const completion = await openai.chat.completions.create({
            model: "abab6.5-chat",
            messages: [
                { role: "user", content: "Hello" },
            ],
        });
        console.log(`SUCCESS with ${url}!`);
        console.log(completion.choices[0].message.content);
        return true;
    } catch (error) {
        console.error(`FAILED with ${url}:`, error instanceof Error ? error.message : error);
        return false;
    }
}

async function main() {
    await testEndpoint("https://api.minimax.io/v1");
    await testEndpoint("https://api.minimaxi.com/v1");
    // Also try with /v1 removed just in case or other variations if needed
}

main();
