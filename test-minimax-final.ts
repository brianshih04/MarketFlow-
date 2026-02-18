import OpenAI from "openai";

const apiKey = "sk-api-FZ9HPLas0n8jMyk4UEoLxjrYC7ZFc1-CVkylUpklpVmqsmQU6QRH_-qpuH2cfYkPuOulQBxFAs9cqri2I7g01r2HD5aUURidQis29gT8PGzgeycEY57p2ro";

const openai = new OpenAI({
    apiKey: apiKey,
    baseURL: "https://api.minimax.io/v1", // Correct endpoint found
});

async function main() {
    try {
        console.log("Testing with MiniMax-M2.5...");
        const completion = await openai.chat.completions.create({
            model: "MiniMax-M2.5", // Testing user requested model
            messages: [
                { role: "system", content: "You are a helpful assistant." },
                { role: "user", content: "Hello" },
            ],
            temperature: 0.1,
        });

        console.log("Success!");
        console.log(completion.choices[0].message.content);
    } catch (error) {
        console.error("Error:", error instanceof Error ? error.message : error);
    }
}

main();
