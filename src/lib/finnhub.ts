/**
 * Finnhub API — Symbol & Resolution Utility
 *
 * Free tier covers US equities in real-time.
 * Futures (NQ=F, ES=F) → ETF proxies that work on free tier.
 */

/** Map Yahoo-style / internal symbols → Finnhub-compatible symbols */
const SYMBOL_MAP: Record<string, string> = {
    // Futures → ETF proxies (Finnhub free tier does not support CME futures)
    "NQ=F": "QQQ",
    "ES=F": "SPY",
    "YM=F": "DIA",
    "RTY=F": "IWM",
    "GC=F": "GLD",
    "CL=F": "USO",
    "SI=F": "SLV",

    // Crypto: Finnhub uses exchange prefix (BINANCE:BTCUSDT)
    "BTC-USD": "BINANCE:BTCUSDT",
    "ETH-USD": "BINANCE:ETHUSDT",

    // FX: Finnhub uses OANDA: prefix for forex
    "EURUSD=X": "OANDA:EUR_USD",
    "GBPUSD=X": "OANDA:GBP_USD",
    "USDJPY=X": "OANDA:USD_JPY",
};

/** Human-readable display names keyed on the Finnhub symbol */
export const DISPLAY_NAMES: Record<string, string> = {
    "QQQ": "Nasdaq 100 ETF",
    "SPY": "S&P 500 ETF",
    "DIA": "Dow Jones ETF",
    "IWM": "Russell 2000 ETF",
    "GLD": "Gold ETF",
    "USO": "WTI Oil ETF",
    "SLV": "Silver ETF",
    "AAPL": "Apple Inc.",
    "NVDA": "NVIDIA Corp.",
    "MSFT": "Microsoft Corp.",
    "TSLA": "Tesla Inc.",
    "AMZN": "Amazon.com",
    "GOOGL": "Alphabet Inc.",
    "META": "Meta Platforms",
    "BINANCE:BTCUSDT": "Bitcoin",
    "BINANCE:ETHUSDT": "Ethereum",
};

/** Convert user/Yahoo symbol → Finnhub symbol */
export function toFHSymbol(symbol: string): string {
    return SYMBOL_MAP[symbol] ?? symbol;
}

/** Get a human-readable name for a Finnhub symbol */
export function getDisplayName(fhSymbol: string): string {
    return DISPLAY_NAMES[fhSymbol] ?? fhSymbol;
}

/**
 * Finnhub resolution mapping.
 * Finnhub: 1, 5, 15, 30, 60, D, W, M
 */
export const FH_RESOLUTION_MAP: Record<string, string> = {
    "1m": "1",
    "5m": "5",
    "15m": "15",
    "30m": "30",
    "60m": "60",
    "1h": "60",
    "1d": "D",
    "1D": "D",
    "1wk": "W",
    "1W": "W",
    "1mo": "M",
    "1M": "M",
};

/** Whether a resolution produces daily+ bars (use YYYY-MM-DD strings) */
export function isDailyResolution(resolution: string): boolean {
    return ["D", "W", "M"].includes(resolution);
}

/** Calculate from-timestamp (Unix seconds) for a given look-back period */
export function fromTimestampForInterval(interval: string): number {
    const now = Math.floor(Date.now() / 1000);
    const DAY = 86400;
    switch (interval) {
        case "1m": return now - DAY * 5;      // 5 days
        case "5m": return now - DAY * 30;     // 30 days
        case "15m": return now - DAY * 60;     // 60 days
        case "30m": return now - DAY * 90;     // 90 days
        case "60m":
        case "1h": return now - DAY * 180;    // 6 months
        case "1d":
        case "1D": return now - DAY * 365;    // 1 year
        case "1wk":
        case "1W": return now - DAY * 365 * 3;// 3 years
        case "1mo":
        case "1M": return now - DAY * 365 * 5;// 5 years
        default: return now - DAY * 60;
    }
}

/** Watchlist symbols for the tape (Finnhub free-tier US equities) */
export const TICKER_SYMBOLS_FH = ["AAPL", "NVDA", "QQQ", "SPY"];

/**
 * Display label overrides — empty so symbols show as-is.
 * QQQ shows as "QQQ", SPY as "SPY", etc.
 */
export const TICKER_DISPLAY_MAP: Record<string, string> = {};

