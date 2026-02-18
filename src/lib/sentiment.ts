/**
 * Simple keyword-based sentiment analysis (heuristic MVP).
 * Returns "Bullish", "Bearish", or "Neutral" based on headline text.
 */

const BULLISH_KEYWORDS = [
    "soar",
    "surge",
    "jump",
    "record",
    "beat",
    "buy",
    "upgrade",
    "growth",
    "gain",
    "rally",
    "rise",
    "high",
    "bull",
    "outperform",
    "breakout",
    "boom",
    "optimis",
    "strong",
    "exceed",
    "positive",
];

const BEARISH_KEYWORDS = [
    "crash",
    "drop",
    "fall",
    "miss",
    "sell",
    "downgrade",
    "loss",
    "decline",
    "plunge",
    "concern",
    "fear",
    "bear",
    "weak",
    "slump",
    "cut",
    "warn",
    "risk",
    "trouble",
    "negative",
    "down",
];

export type Sentiment = "Bullish" | "Bearish" | "Neutral";

export function analyzeSentiment(text: string): Sentiment {
    const lower = text.toLowerCase();

    let bullScore = 0;
    let bearScore = 0;

    for (const kw of BULLISH_KEYWORDS) {
        if (lower.includes(kw)) bullScore++;
    }

    for (const kw of BEARISH_KEYWORDS) {
        if (lower.includes(kw)) bearScore++;
    }

    if (bullScore > bearScore) return "Bullish";
    if (bearScore > bullScore) return "Bearish";
    return "Neutral";
}
