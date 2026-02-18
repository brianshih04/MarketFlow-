import OpenAI from "openai";

const apiKey = "sk-api-FZ9HPLas0n8jMyk4UEoLxjrYC7ZFc1-CVkylUpklpVmqsmQU6QRH_-qpuH2cfYkPuOulQBxFAs9cqri2I7g01r2HD5aUURidQis29gT8PGzgeycEY57p2ro";

// Trying api.minimax.chat first
const openai = new OpenAI({
    apiKey: apiKey,
    baseURL: "https://api.minimax.chat/v1",
});

async function main() {
    try {
        console.log("Testing MiniMax API with https://api.minimax.chat/v1 ...");
        const completion = await openai.chat.completions.create({
            model: "abab6.5-chat", // Also trying a known model name just in case, or stick to user provided? 
            // User code used "MiniMax-M2.5". Let's stick to that first or try "abab6.5s-chat" which is common.
            // Actually, let's stick to "MiniMax-M2.5" if that's what was in the code, but maybe "abab5.5" etc are the real internal names.
            // Let's try "abab6.5-chat" as a fallback if M2.5 fails, but first let's see if we connect.
            model: "abab6.5-chat",
            messages: [
                { role: "system", content: "You are a helpful assistant." },
                { role: "user", content: "Hello" },
            ],
            temperature: 0.1,
        });

        console.log("Success!");
        console.log(completion.choices[0].message.content);
    } catch (error) {
        console.error("Error with abab6.5-chat:", error.name, error.message);

        // Retry with User's model name
        try {
            console.log("Retrying with MiniMax-M2.5...");
            const completion2 = await openai.chat.completions.create({
                model: "MiniMax-M2.5",
                messages: [
                    { role: "user", content: "Hello" },
                ],
            });
            console.log("Success with M2.5!");
            console.log(completion2.choices[0].message.content);
        } catch (err2) {
            console.error("Error with MiniMax-M2.5:", err2.message);
        }
    }
}

main();
