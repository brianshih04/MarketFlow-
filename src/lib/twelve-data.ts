/**
 * Twelve Data API — Symbol Utility
 *
 * Maps common internal symbols (Yahoo Finance style) to Twelve Data equivalents.
 * Twelve Data does support many equity symbols directly (AAPL, MSFT, etc.).
 * Futures and indices need special mapping.
 */

/** Map Yahoo-style symbols → Twelve Data symbols */
const SYMBOL_MAP: Record<string, string> = {
    // US Futures → Free-tier ETF proxies (indices need Grow plan on TD)
    "NQ=F": "QQQ",    // Nasdaq 100 ETF
    "ES=F": "SPY",    // S&P 500 ETF
    "YM=F": "DIA",    // Dow Jones ETF
    "RTY=F": "IWM",    // Russell 2000 ETF
    "GC=F": "GLD",    // Gold ETF
    "CL=F": "USO",    // WTI Oil ETF
    "SI=F": "SLV",    // Silver ETF

    // Crypto
    "BTC-USD": "BTC/USD",
    "ETH-USD": "ETH/USD",

    // FX
    "EURUSD=X": "EUR/USD",
    "GBPUSD=X": "GBP/USD",
    "USDJPY=X": "USD/JPY",
};

/**
 * Friendly display name for UI labels.
 * Falls back to the symbol itself.
 */
const DISPLAY_NAMES: Record<string, string> = {
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
    "BTC/USD": "Bitcoin",
    "ETH/USD": "Ethereum",
};

/**
 * Convert a user-facing / Yahoo Finance symbol to a Twelve Data API symbol.
 */
export function toTDSymbol(symbol: string): string {
    return SYMBOL_MAP[symbol] ?? symbol;
}

/**
 * Get a human-readable display name for a symbol.
 */
export function getDisplayName(tdSymbol: string): string {
    return DISPLAY_NAMES[tdSymbol] ?? tdSymbol;
}

/**
 * Interval mapping: our frontend strings → Twelve Data interval strings.
 * Twelve Data: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 8h, 1day, 1week, 1month
 */
export const TD_INTERVAL_MAP: Record<string, string> = {
    "1m": "1min",
    "5m": "5min",
    "15m": "15min",
    "30m": "30min",
    "60m": "1h",
    "1h": "1h",
    "1d": "1day",
    "1D": "1day",
    "1wk": "1week",
    "1W": "1week",
    "1mo": "1month",
    "1M": "1month",
};

/**
 * Whether an interval produces daily-or-above bars.
 * Daily bars use YYYY-MM-DD strings; intraday bars use Unix seconds.
 */
export function isDailyInterval(interval: string): boolean {
    return ["1day", "1week", "1month"].includes(interval);
}

/**
 * Twelve Data `outputsize` to cover roughly 300 bars for the given interval.
 * Their max free-tier per request is 5000.
 */
export function outputsizeForInterval(interval: string): number {
    return 300;
}

/** Ticker symbols to watch in the market tape (Twelve Data free-tier compatible) */
export const TICKER_SYMBOLS_TD = ["AAPL", "NVDA", "QQQ", "SPY"];

/** Map Twelve Data / display symbols back to UI shorthand labels */
export const TICKER_DISPLAY_MAP: Record<string, string> = {
    "QQQ": "NQ",
    "SPY": "ES",
};
