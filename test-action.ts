import { minimax } from "./src/lib/minimax";

async function testAction() {
    console.log("Testing analyzeNews logic...");
    console.log("Base URL:", minimax.baseURL); // Verify URL

    const text = "Apple stock (AAPL) rose 2% today following positive earnings report.";

    try {
        const completion = await minimax.chat.completions.create({
            model: "MiniMax-M2.5",
            messages: [
                {
                    role: "system",
                    content: `You are a financial analyst. Analyze the provided news text.
          
Output must be strict JSON with the following structure:
{
  "summary": "Concise summary in Traditional Chinese (max 50 words)",
  "sentiment": "Bullish" | "Bearish" | "Neutral",
  "reasoning": "Brief explanation for the sentiment (in Traditional Chinese)"
}

Ensure all strings are valid JSON. Do not include markdown formatting or backticks.`,
                },
                {
                    role: "user",
                    content: text,
                },
            ],
            response_format: { type: "json_object" },
            temperature: 0.1,
        });

        console.log("Success!");
        console.log(completion.choices[0].message.content);

    } catch (error) {
        console.error("Error:", error);
    }
}

testAction();
