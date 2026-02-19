"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { TrendingUp, TrendingDown, Minus, Wifi, WifiOff } from "lucide-react";
import { useAppStore } from "@/store/use-app-store";
import { TICKER_SYMBOLS_TD, TICKER_DISPLAY_MAP, getDisplayName, toTDSymbol } from "@/lib/twelve-data";

/* ── Types ─────────────── */

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

/** Twelve Data WebSocket price event */
interface TDPriceEvent {
    event: "price" | "subscribe-status" | "heartbeat";
    symbol?: string;
    price?: number;
    day_change?: number;
    day_volume?: number;
    day_percent_change?: number;
    currency_base?: string;
    timestamp?: number;
    status?: string;
    message?: string;
}

/* ── Constants ─────────────── */

const WS_URL = `wss://ws.twelvedata.com/v1/quotes/price?apikey=${process.env.NEXT_PUBLIC_TWELVE_DATA_API_KEY}`;
const WS_SYMBOLS = TICKER_SYMBOLS_TD.join(",");     // "AAPL,NVDA,NDX,SPX"
const RECONNECT_DELAY_MS = 3000;

/* ── Formatters ─────────────── */

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

/* ── useRealtimeQuotes Hook ─────────────── */

/**
 * Maintains a real-time quote map via Twelve Data WebSocket.
 *
 * Strategy:
 *  1. Seed with REST data immediately so the UI shows something.
 *  2. Connect WebSocket; on each "price" event update the quote map.
 *  3. Auto-reconnect after unexpected close.
 */
function useRealtimeQuotes(symbols: string[]): {
    quotes: QuoteData[];
    wsStatus: "connecting" | "live" | "offline";
} {
    const [quotes, setQuotes] = useState<QuoteData[]>([]);
    const [wsStatus, setWsStatus] = useState<"connecting" | "live" | "offline">("connecting");
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const quotesMapRef = useRef<Map<string, QuoteData>>(new Map());
    const mountedRef = useRef(true);

    /* Seed quotes from REST on first load */
    const seedFromRest = useCallback(async () => {
        try {
            const symbolParam = symbols.join(",");
            const res = await fetch(`/api/quote?symbols=${symbolParam}`);
            if (!res.ok) return;
            const data: QuoteData[] = await res.json();
            data.forEach((q) => quotesMapRef.current.set(q.symbol, q));
            if (mountedRef.current) {
                setQuotes([...quotesMapRef.current.values()]);
            }
        } catch {
            /* Ignore seed failure — WS will carry it */
        }
    }, [symbols]);

    /* WebSocket connection */
    const connect = useCallback(() => {
        if (!mountedRef.current) return;

        try {
            const ws = new WebSocket(WS_URL);
            wsRef.current = ws;
            setWsStatus("connecting");

            ws.onopen = () => {
                if (!mountedRef.current) return ws.close();
                setWsStatus("live");
                ws.send(JSON.stringify({
                    action: "subscribe",
                    params: { symbols: WS_SYMBOLS },
                }));
            };

            ws.onmessage = (evt) => {
                if (!mountedRef.current) return;
                try {
                    const msg = JSON.parse(evt.data as string) as TDPriceEvent;
                    if (msg.event !== "price" || !msg.symbol || msg.price == null) return;

                    const displaySym = TICKER_DISPLAY_MAP[msg.symbol] ?? msg.symbol;
                    const existing = quotesMapRef.current.get(displaySym);

                    const updated: QuoteData = {
                        symbol: displaySym,
                        name: existing?.name ?? getDisplayName(msg.symbol),
                        shortName: existing?.shortName ?? getDisplayName(msg.symbol),
                        price: msg.price,
                        change: msg.day_change ?? existing?.change ?? null,
                        changePercent: msg.day_percent_change ?? existing?.changePercent ?? null,
                        dayVolume: msg.day_volume ?? existing?.dayVolume ?? null,
                        marketState: existing?.marketState ?? "REGULAR",
                    };

                    quotesMapRef.current.set(displaySym, updated);
                    setQuotes([...quotesMapRef.current.values()]);
                } catch {
                    /* Ignore malformed messages */
                }
            };

            ws.onerror = () => {
                setWsStatus("offline");
            };

            ws.onclose = (evt) => {
                if (!mountedRef.current) return;
                setWsStatus("offline");
                // Reconnect unless we closed it intentionally (code 1000)
                if (evt.code !== 1000) {
                    reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY_MS);
                }
            };
        } catch {
            setWsStatus("offline");
            reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY_MS);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        mountedRef.current = true;
        seedFromRest();
        connect();

        return () => {
            mountedRef.current = false;
            if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
            wsRef.current?.close(1000, "unmount");
        };
    }, [seedFromRest, connect]);

    return { quotes, wsStatus };
}

/* ── TickerItem ─────────────── */

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

/* ── TickerTape ─────────────── */

export function TickerTape() {
    const { quotes, wsStatus } = useRealtimeQuotes(TICKER_SYMBOLS_TD);

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
            {/* Live / Offline indicator */}
            <div className="absolute right-2 top-1/2 z-10 -translate-y-1/2">
                {wsStatus === "live" ? (
                    <span className="flex items-center gap-1 rounded-full bg-gain/10 px-2 py-0.5 text-[9px] font-semibold text-gain">
                        <Wifi className="h-2.5 w-2.5" />
                        LIVE
                    </span>
                ) : wsStatus === "connecting" ? (
                    <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-semibold text-primary">
                        <div className="h-2 w-2 animate-spin rounded-full border border-primary border-t-transparent" />
                        WS
                    </span>
                ) : (
                    <span className="flex items-center gap-1 rounded-full bg-muted/30 px-2 py-0.5 text-[9px] text-muted-foreground">
                        <WifiOff className="h-2.5 w-2.5" />
                        POLLING
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

export function WatchlistTable() {
    const { quotes } = useRealtimeQuotes(TICKER_SYMBOLS_TD);
    const activeSymbol = useAppStore((s) => s.activeSymbol);
    const setActiveSymbol = useAppStore((s) => s.setActiveSymbol);

    return (
        <div className="space-y-1">
            {quotes.length === 0 ? (
                <div className="py-4 text-center text-xs text-muted-foreground">
                    Loading…
                </div>
            ) : (
                quotes.map((q) => {
                    const isGain = (q.change ?? 0) >= 0;
                    // For watchlist click, map display symbol back to internal symbol
                    const internalSym = Object.entries(TICKER_DISPLAY_MAP).find(([, v]) => v === q.symbol)?.[0] ?? q.symbol;
                    const isActive = q.symbol === activeSymbol || internalSym === activeSymbol;

                    return (
                        <button
                            key={q.symbol}
                            onClick={() => setActiveSymbol(internalSym, q.name || q.shortName)}
                            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-left transition-all ${isActive
                                    ? "bg-primary/10 ring-1 ring-primary/20"
                                    : "hover:bg-muted/50"
                                }`}
                        >
                            <div className="flex flex-col">
                                <span
                                    className={`font-semibold ${isActive ? "text-primary" : "text-foreground"
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
