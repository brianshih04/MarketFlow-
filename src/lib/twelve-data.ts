/**
 * Twelve Data API — Symbol Utility
 *
 * Maps common internal symbols (Yahoo Finance style) to Twelve Data equivalents.
 * Twelve Data does support many equity symbols directly (AAPL, MSFT, etc.).
 * Futures and indices need special mapping.
 */

/** Map Yahoo-style symbols → Twelve Data symbols */
const SYMBOL_MAP: Record<string, string> = {
    // US Equity Futures → Indices (Twelve Data free tier)
    "NQ=F": "NDX",    // Nasdaq 100 Index
    "ES=F": "SPX",    // S&P 500 Index
    "YM=F": "DJI",    // Dow Jones Industrial
    "RTY=F": "RUT",    // Russell 2000
    "GC=F": "XAU/USD",// Gold spot
    "CL=F": "WTI",    // WTI Crude Oil
    "SI=F": "XAG/USD",// Silver spot

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
    "NDX": "Nasdaq 100",
    "SPX": "S&P 500",
    "DJI": "Dow Jones",
    "RUT": "Russell 2000",
    "AAPL": "Apple Inc.",
    "NVDA": "NVIDIA Corp.",
    "MSFT": "Microsoft Corp.",
    "TSLA": "Tesla Inc.",
    "AMZN": "Amazon.com",
    "GOOGL": "Alphabet Inc.",
    "META": "Meta Platforms",
    "XAU/USD": "Gold Spot",
    "WTI": "WTI Crude Oil",
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

/** Ticker symbols to watch in the market tape (Twelve Data-compatible) */
export const TICKER_SYMBOLS_TD = ["AAPL", "NVDA", "NDX", "SPX"];

/** Map Twelve Data symbols back to display symbols for the UI */
export const TICKER_DISPLAY_MAP: Record<string, string> = {
    "NDX": "NQ",
    "SPX": "ES",
};
