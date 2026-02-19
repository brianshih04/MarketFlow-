"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { TrendingUp, TrendingDown, Minus, Wifi, WifiOff } from "lucide-react";
import { useAppStore } from "@/store/use-app-store";
import {
    TICKER_SYMBOLS_FH,
    TICKER_DISPLAY_MAP,
    getDisplayName,
    toFHSymbol,
} from "@/lib/finnhub";

/* ── Types ─────────────── */

export interface QuoteData {
    symbol: string;
    name: string;
    shortName: string;
    price: number | null;
    change: number | null;
    changePercent: number | null;
    dayVolume: number | null;
    marketState: string | null;
}

/** A single Finnhub trade tick from the WebSocket */
export interface LiveTrade {
    /** Finnhub symbol (e.g. "AAPL") */
    symbol: string;
    /** Last trade price */
    price: number;
    /** Unix milliseconds */
    timestamp: number;
    /** Trade volume */
    volume: number;
}

/** Finnhub WS message shape */
interface FHMessage {
    type: "trade" | "ping" | "error" | "no_data";
    data?: Array<{
        p: number;  // price
        s: string;  // symbol
        t: number;  // timestamp ms
        v: number;  // volume
    }>;
    msg?: string;
}

/* ── Constants ─────────────── */

const API_KEY = process.env.NEXT_PUBLIC_FINNHUB_API_KEY ?? "";
const WS_URL = `wss://ws.finnhub.io?token=${API_KEY}`;
const RECONNECT_DELAY = 3000;

/* ── Formatters ─────────────── */

function formatPrice(price: number | null): string {
    if (price === null) return "N/A";
    return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPercent(pct: number | null): string {
    if (pct === null) return "";
    return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
}

function formatVolume(vol: number | null): string {
    if (vol === null) return "—";
    if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(1)}M`;
    if (vol >= 1_000) return `${(vol / 1_000).toFixed(0)}K`;
    return vol.toString();
}

/* ── useRealtimeQuotes Hook ─────────────── */

/**
 * Maintains a real-time quote map via Finnhub WebSocket.
 * Seeds from REST; overlays live trade events.
 *
 * @param symbols      Finnhub-compatible symbols to subscribe to.
 * @param onLiveTrade  Callback fired for every trade tick (for chart live update).
 */
export function useRealtimeQuotes(
    symbols: string[],
    onLiveTrade?: (trade: LiveTrade) => void
): { quotes: QuoteData[]; wsStatus: "connecting" | "live" | "offline" } {
    const [quotes, setQuotes] = useState<QuoteData[]>([]);
    const [wsStatus, setWsStatus] = useState<"connecting" | "live" | "offline">("connecting");

    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const quotesMapRef = useRef<Map<string, QuoteData>>(new Map());
    const mountedRef = useRef(true);
    const onLiveTradeRef = useRef(onLiveTrade);
    onLiveTradeRef.current = onLiveTrade; // keep ref up to date without re-subscribing

    /* Seed from REST immediately */
    const seedFromRest = useCallback(async () => {
        try {
            const param = symbols.join(",");
            const res = await fetch(`/api/quote?symbols=${param}`);
            if (!res.ok) return;
            const data: QuoteData[] = await res.json();
            data.forEach((q) => quotesMapRef.current.set(q.symbol, q));
            if (mountedRef.current) setQuotes([...quotesMapRef.current.values()]);
        } catch { /* ignore — WS will carry data */ }
    }, [symbols]);

    /* WebSocket connection with auto-reconnect */
    const connect = useCallback(() => {
        if (!mountedRef.current || !API_KEY) return;

        try {
            const ws = new WebSocket(WS_URL);
            wsRef.current = ws;
            setWsStatus("connecting");

            ws.onopen = () => {
                if (!mountedRef.current) { ws.close(1000); return; }
                setWsStatus("live");
                // Subscribe to each symbol
                for (const sym of symbols) {
                    ws.send(JSON.stringify({ type: "subscribe", symbol: sym }));
                }
            };

            ws.onmessage = (evt) => {
                if (!mountedRef.current) return;
                try {
                    const msg = JSON.parse(evt.data as string) as FHMessage;
                    if (msg.type !== "trade" || !msg.data?.length) return;

                    for (const tick of msg.data) {
                        const displaySym = TICKER_DISPLAY_MAP[tick.s] ?? tick.s;
                        const existing = quotesMapRef.current.get(displaySym);

                        // Update last price in quote map
                        const updated: QuoteData = {
                            symbol: displaySym,
                            name: existing?.name ?? getDisplayName(tick.s),
                            shortName: existing?.shortName ?? displaySym,
                            price: tick.p,
                            change: existing?.change ?? null,
                            changePercent: existing?.changePercent ?? null,
                            dayVolume: (existing?.dayVolume ?? 0) + tick.v,
                            marketState: "REGULAR",
                        };
                        quotesMapRef.current.set(displaySym, updated);

                        // Fire live trade callback (for chart candle update)
                        onLiveTradeRef.current?.({
                            symbol: tick.s,
                            price: tick.p,
                            timestamp: tick.t,
                            volume: tick.v,
                        });
                    }

                    setQuotes([...quotesMapRef.current.values()]);
                } catch { /* ignore malformed messages */ }
            };

            ws.onerror = () => setWsStatus("offline");

            ws.onclose = (evt) => {
                if (!mountedRef.current) return;
                setWsStatus("offline");
                if (evt.code !== 1000) {
                    reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY);
                }
            };
        } catch {
            setWsStatus("offline");
            reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY);
        }
    }, [symbols]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        mountedRef.current = true;
        seedFromRest();
        connect();

        return () => {
            mountedRef.current = false;
            if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
            // Unsubscribe cleanly before closing
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                for (const sym of symbols) {
                    wsRef.current.send(JSON.stringify({ type: "unsubscribe", symbol: sym }));
                }
                wsRef.current.close(1000, "unmount");
            }
        };
    }, [seedFromRest, connect, symbols]);

    return { quotes, wsStatus };
}

/* ── TickerItem ─────────────── */

function TickerItem({ quote }: { quote: QuoteData }) {
    const isGain = (quote.change ?? 0) >= 0;
    const isFlat = quote.change === null;

    return (
        <div className="flex items-center gap-2 whitespace-nowrap px-3">
            <span className="text-xs font-semibold text-foreground">{quote.symbol}</span>
            <span className="font-mono-num text-sm font-semibold text-foreground">
                {formatPrice(quote.price)}
            </span>
            <span className={`flex items-center gap-0.5 font-mono-num text-xs font-medium ${isFlat ? "text-muted-foreground" : isGain ? "text-gain" : "text-loss"
                }`}>
                {isFlat ? <Minus className="h-3 w-3" /> : isGain
                    ? <TrendingUp className="h-3 w-3" />
                    : <TrendingDown className="h-3 w-3" />}
                {formatPercent(quote.changePercent)}
            </span>
        </div>
    );
}

/* ── TickerTape ─────────────── */

export function TickerTape({
    quotes,
    wsStatus,
}: {
    quotes: QuoteData[];
    wsStatus: "connecting" | "live" | "offline";
}) {

    if (quotes.length === 0) {
        return (
            <div className="flex h-10 items-center justify-center text-xs text-muted-foreground">
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent mr-2" />
                Loading market data…
            </div>
        );
    }

    return (
        <div className="relative overflow-hidden">
            <div className="absolute right-2 top-1/2 z-10 -translate-y-1/2">
                {wsStatus === "live" ? (
                    <span className="flex items-center gap-1 rounded-full bg-gain/10 px-2 py-0.5 text-[9px] font-semibold text-gain">
                        <Wifi className="h-2.5 w-2.5" />LIVE
                    </span>
                ) : wsStatus === "connecting" ? (
                    <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-semibold text-primary">
                        <div className="h-2 w-2 animate-spin rounded-full border border-primary border-t-transparent" />
                        WS
                    </span>
                ) : (
                    <span className="flex items-center gap-1 rounded-full bg-muted/30 px-2 py-0.5 text-[9px] text-muted-foreground">
                        <WifiOff className="h-2.5 w-2.5" />POLLING
                    </span>
                )}
            </div>
            <div className="flex gap-6 py-2 ticker-scroll" style={{ width: "max-content" }}>
                {[...quotes, ...quotes].map((q, i) => (
                    <TickerItem key={`${q.symbol}-${i}`} quote={q} />
                ))}
            </div>
        </div>
    );
}

/* ── WatchlistTable ─────────────── */

export function WatchlistTable({ quotes }: { quotes: QuoteData[] }) {
    const activeSymbol = useAppStore((s) => s.activeSymbol);
    const setActiveSymbol = useAppStore((s) => s.setActiveSymbol);

    return (
        <div className="space-y-1">
            {quotes.length === 0 ? (
                <div className="py-4 text-center text-xs text-muted-foreground">Loading…</div>
            ) : (
                quotes.map((q) => {
                    const isGain = (q.change ?? 0) >= 0;
                    // Reverse map display symbol → internal
                    const internalSym = Object.entries(TICKER_DISPLAY_MAP)
                        .find(([, v]) => v === q.symbol)?.[0] ?? q.symbol;
                    const isActive = q.symbol === activeSymbol || internalSym === activeSymbol;

                    return (
                        <button
                            key={q.symbol}
                            onClick={() => setActiveSymbol(internalSym, q.name || q.shortName)}
                            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-left transition-all ${isActive ? "bg-primary/10 ring-1 ring-primary/20" : "hover:bg-muted/50"
                                }`}
                        >
                            <div className="flex flex-col">
                                <span className={`font-semibold ${isActive ? "text-primary" : "text-foreground"}`}>
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
                                    <span className={`font-mono-num text-xs ${isGain ? "text-gain" : "text-loss"}`}>
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
