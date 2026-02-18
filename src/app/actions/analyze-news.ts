"use server";

import { minimax } from "@/lib/minimax";

export interface AnalysisResult {
    summary: string;
    sentiment: "Bullish" | "Bearish" | "Neutral";
    reasoning: string;
}

export async function analyzeNews(text: string): Promise<AnalysisResult> {
    // const apiKey = process.env.MINIMAX_API_KEY; // No longer needed
    // if (!apiKey) ...

    const openai = minimax;

    try {
        const completion = await openai.chat.completions.create({
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

        const content = completion.choices[0]?.message?.content;
        console.log("[analyze-news] Raw Content:", content);

        if (!content) {
            throw new Error("No response content from MiniMax");
        }

        // Clean content:
        // 1. Remove <think>...</think> blocks
        // 2. Remove markdown code blocks
        // 3. Extract JSON object
        let cleanContent = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
        cleanContent = cleanContent.replace(/```json\n?|```/g, "").trim();

        const firstBrace = cleanContent.indexOf("{");
        const lastBrace = cleanContent.lastIndexOf("}");

        if (firstBrace !== -1 && lastBrace !== -1) {
            cleanContent = cleanContent.substring(firstBrace, lastBrace + 1);
        }

        const result = JSON.parse(cleanContent) as AnalysisResult;
        return result;

    } catch (error) {
        console.error("[analyze-news] Detail Error:", error);
        if (error instanceof Error && "status" in error && (error.status === 401 || error.status === 403)) {
            throw new Error("Invalid MiniMax API Key");
        }
        // Provide the actual error message for debugging
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to analyze news: ${errorMessage}`);
    }
}
