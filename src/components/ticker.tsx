"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useAppStore } from "@/store/use-app-store";

interface QuoteData {
    symbol: string;
    name: string;
    shortName: string;
    price: number | null;
    change: number | null;
    changePercent: number | null;
    dayVolume: number | null;
    marketState: string | null;
}

const SYMBOLS = ["AAPL", "NVDA", "NQ=F", "ES=F"];

function encodeSymbol(symbol: string): string {
    return encodeURIComponent(symbol);
}

function formatPrice(price: number | null): string {
    if (price === null || price === undefined) return "N/A";
    return price.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function formatPercent(pct: number | null): string {
    if (pct === null || pct === undefined) return "N/A";
    const sign = pct >= 0 ? "+" : "";
    return `${sign}${pct.toFixed(2)}%`;
}

function formatVolume(vol: number | null): string {
    if (vol === null || vol === undefined) return "—";
    if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(1)}M`;
    if (vol >= 1_000) return `${(vol / 1_000).toFixed(0)}K`;
    return vol.toString();
}

export function TickerTape() {
    const [quotes, setQuotes] = useState<QuoteData[]>([]);
    const [loading, setLoading] = useState(true);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    const fetchQuotes = useCallback(async () => {
        try {
            const symbolParam = SYMBOLS.map(encodeSymbol).join(",");
            const res = await fetch(`/api/quote?symbols=${symbolParam}`);
            if (!res.ok) throw new Error("Fetch failed");
            const data: QuoteData[] = await res.json();
            setQuotes(data);
        } catch {
            // Keep existing data on error
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchQuotes();
        intervalRef.current = setInterval(fetchQuotes, 5000);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [fetchQuotes]);

    if (loading && quotes.length === 0) {
        return (
            <div className="flex h-10 items-center justify-center text-xs text-muted-foreground">
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent mr-2" />
                Loading market data…
            </div>
        );
    }

    return (
        <div className="relative overflow-hidden">
            <div className="flex gap-6 py-2 ticker-scroll" style={{ width: "max-content" }}>
                {/* Duplicate for seamless loop */}
                {[...quotes, ...quotes].map((q, i) => (
                    <TickerItem key={`${q.symbol}-${i}`} quote={q} />
                ))}
            </div>
        </div>
    );
}

function TickerItem({ quote }: { quote: QuoteData }) {
    const isGain = (quote.change ?? 0) >= 0;
    const isFlat = quote.change === 0 || quote.change === null;

    return (
        <div className="flex items-center gap-2 whitespace-nowrap px-3">
            <span className="text-xs font-semibold text-foreground">
                {quote.symbol}
            </span>
            <span className="font-mono-num text-sm font-semibold text-foreground">
                {formatPrice(quote.price)}
            </span>
            <span
                className={`flex items-center gap-0.5 font-mono-num text-xs font-medium ${isFlat
                    ? "text-muted-foreground"
                    : isGain
                        ? "text-gain"
                        : "text-loss"
                    }`}
            >
                {isFlat ? (
                    <Minus className="h-3 w-3" />
                ) : isGain ? (
                    <TrendingUp className="h-3 w-3" />
                ) : (
                    <TrendingDown className="h-3 w-3" />
                )}
                {formatPercent(quote.changePercent)}
            </span>
        </div>
    );
}

/* ── Watchlist Table ─────────────── */

export function WatchlistTable() {
    const [quotes, setQuotes] = useState<QuoteData[]>([]);
    const activeSymbol = useAppStore((s) => s.activeSymbol);
    const setActiveSymbol = useAppStore((s) => s.setActiveSymbol);

    const fetchQuotes = useCallback(async () => {
        try {
            const symbolParam = SYMBOLS.map(encodeSymbol).join(",");
            const res = await fetch(`/api/quote?symbols=${symbolParam}`);
            if (!res.ok) return;
            const data: QuoteData[] = await res.json();
            setQuotes(data);
        } catch {
            /* ignore */
        }
    }, []);

    useEffect(() => {
        fetchQuotes();
        const id = setInterval(fetchQuotes, 5000);
        return () => clearInterval(id);
    }, [fetchQuotes]);

    return (
        <div className="space-y-1">
            {quotes.length === 0 ? (
                <div className="py-4 text-center text-xs text-muted-foreground">
                    Loading…
                </div>
            ) : (
                quotes.map((q) => {
                    const isGain = (q.change ?? 0) >= 0;
                    const isActive = q.symbol === activeSymbol;
                    return (
                        <button
                            key={q.symbol}
                            onClick={() =>
                                setActiveSymbol(q.symbol, q.name || q.shortName)
                            }
                            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-left transition-all ${isActive
                                    ? "bg-primary/10 ring-1 ring-primary/20"
                                    : "hover:bg-muted/50"
                                }`}
                        >
                            <div className="flex flex-col">
                                <span
                                    className={`font-semibold ${isActive
                                            ? "text-primary"
                                            : "text-foreground"
                                        }`}
                                >
                                    {q.symbol}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {q.name || q.shortName || q.symbol}
                                </span>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="font-mono-num text-sm font-semibold">
                                    {formatPrice(q.price)}
                                </span>
                                <div className="flex items-center gap-2">
                                    <span
                                        className={`font-mono-num text-xs ${isGain ? "text-gain" : "text-loss"
                                            }`}
                                    >
                                        {formatPercent(q.changePercent)}
                                    </span>
                                    <span className="font-mono-num text-[10px] text-muted-foreground">
                                        {formatVolume(q.dayVolume)}
                                    </span>
                                </div>
                            </div>
                        </button>
                    );
                })
            )}
        </div>
    );
}
