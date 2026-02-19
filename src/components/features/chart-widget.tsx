"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
    createChart,
    ColorType,
    CandlestickSeries,
    HistogramSeries,
    LineSeries,
    createSeriesMarkers,
    type IChartApi,
    type ISeriesApi,
    type ISeriesMarkersPluginApi,
    type CandlestickData,
    type Time,
    type SeriesMarker,
} from "lightweight-charts";
import { Button } from "@/components/ui/button";
import { findFVGs, type ICTSignal } from "@/lib/ict";

/* ── Types ─────────────── */

interface CandleData {
    time: string | number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

interface LegendData {
    open: number | null;
    high: number | null;
    low: number | null;
    close: number | null;
    volume: number | null;
    sma20: number | null;
    sma50: number | null;
    isGain: boolean;
}

/* ── SMA Calculator ─────────────── */

function calculateSMA(
    data: CandleData[],
    period: number
): { time: string | number; value: number }[] {
    const result: { time: string | number; value: number }[] = [];

    for (let i = period - 1; i < data.length; i++) {
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) {
            sum += data[j].close;
        }
        result.push({
            time: data[i].time,
            value: Math.round((sum / period) * 100) / 100,
        });
    }

    return result;
}

/* ── Formatters ─────────────── */

function fmt(n: number | null, decimals = 2): string {
    if (n === null || n === undefined) return "—";
    return n.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}

function fmtVol(n: number | null): string {
    if (n === null || n === undefined) return "—";
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return n.toString();
}

/* ── Timeframe presets ─────────────── */

const INTRADAY_TFS = [
    { label: "1m", interval: "1m" },
    { label: "5m", interval: "5m" },
    { label: "15m", interval: "15m" },
    { label: "30m", interval: "30m" },
    { label: "60m", interval: "60m" },
] as const;

const DAILY_TFS = [
    { label: "1D", interval: "1d" },
    { label: "1W", interval: "1wk" },
    { label: "1M", interval: "1mo" },
    { label: "3M", interval: "1d", range: "3mo" },
    { label: "1Y", interval: "1d", range: "1y" },
    { label: "5Y", interval: "1wk", range: "5y" },
] as const;

type IntradayInterval = (typeof INTRADAY_TFS)[number]["interval"];
type DailyLabel = (typeof DAILY_TFS)[number]["label"];

/* ── Component ─────────────── */

interface ChartWidgetProps {
    symbol?: string;
    onSignals?: (signals: ICTSignal[]) => void;
    onIntervalChange?: (interval: string) => void;
}

export function ChartWidget({ symbol = "NQ=F", onSignals, onIntervalChange }: ChartWidgetProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
    const sma20SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    const sma50SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    const legendRef = useRef<HTMLDivElement>(null);
    const candleDataRef = useRef<CandleData[]>([]);
    const sma20DataRef = useRef<{ time: string | number; value: number }[]>([]);
    const sma50DataRef = useRef<{ time: string | number; value: number }[]>([]);
    const markersPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);

    // Timeframe state: intraday interval OR daily selector index
    const [activeInterval, setActiveInterval] = useState<string>("15m");
    const [activeDailyIdx, setActiveDailyIdx] = useState<number | null>(null); // null = intraday mode
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [legend, setLegend] = useState<LegendData | null>(null);

    /* ── Fetch helper ─────────────── */

    const fetchHistory = useCallback(
        async (interval: string, range?: string) => {
            setLoading(true);
            setError(null);
            try {
                const encoded = encodeURIComponent(symbol);
                const rangeParam = range ? `&range=${range}` : "";
                const res = await fetch(
                    `/api/history?symbol=${encoded}&interval=${interval}${rangeParam}`
                );
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const json = await res.json();
                if (json.error) throw new Error(json.error);
                return json.candles as CandleData[];
            } catch (err) {
                console.error("Chart fetch error:", err);
                setError("Failed to load chart data");
                return [];
            } finally {
                setLoading(false);
            }
        },
        [symbol]
    );

    /* ── Create chart once ─────────────── */

    useEffect(() => {
        if (!containerRef.current) return;

        const chart = createChart(containerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: "transparent" },
                textColor: "#a1a1aa",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
            },
            grid: {
                vertLines: { color: "#27272a" },
                horzLines: { color: "#27272a" },
            },
            crosshair: {
                vertLine: {
                    color: "rgba(255,255,255,0.15)",
                    labelBackgroundColor: "#27272a",
                },
                horzLine: {
                    color: "rgba(255,255,255,0.15)",
                    labelBackgroundColor: "#27272a",
                },
            },
            rightPriceScale: { borderColor: "#27272a" },
            timeScale: {
                borderColor: "#27272a",
                timeVisible: true,
                secondsVisible: false,
            },
            handleScroll: true,
            handleScale: true,
        });

        chartRef.current = chart;

        // ── Candlestick Series ──
        const candleSeries = chart.addSeries(CandlestickSeries, {
            upColor: "#22c55e",
            downColor: "#ef4444",
            borderUpColor: "#22c55e",
            borderDownColor: "#ef4444",
            wickUpColor: "#22c55e",
            wickDownColor: "#ef4444",
        });
        candleSeriesRef.current = candleSeries;

        // ── Volume Histogram Series (bottom 20%) ──
        const volumeSeries = chart.addSeries(HistogramSeries, {
            priceFormat: { type: "volume" },
            priceScaleId: "volume",
        });
        volumeSeries.priceScale().applyOptions({
            scaleMargins: { top: 0.8, bottom: 0 },
        });
        volumeSeriesRef.current = volumeSeries;

        // ── SMA 20 Line (Yellow) ──
        const sma20 = chart.addSeries(LineSeries, {
            color: "#FACC15",
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
        });
        sma20SeriesRef.current = sma20;

        // ── SMA 50 Line (Blue) ──
        const sma50 = chart.addSeries(LineSeries, {
            color: "#3B82F6",
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
        });
        sma50SeriesRef.current = sma50;

        // ── Crosshair Legend Subscription ──
        chart.subscribeCrosshairMove((param) => {
            if (!param.time || !param.seriesData) {
                // Reset to latest bar when cursor leaves
                const candles = candleDataRef.current;
                if (candles.length) {
                    const last = candles[candles.length - 1];
                    const sma20Last = sma20DataRef.current;
                    const sma50Last = sma50DataRef.current;
                    setLegend({
                        open: last.open,
                        high: last.high,
                        low: last.low,
                        close: last.close,
                        volume: last.volume,
                        sma20: sma20Last.length
                            ? sma20Last[sma20Last.length - 1].value
                            : null,
                        sma50: sma50Last.length
                            ? sma50Last[sma50Last.length - 1].value
                            : null,
                        isGain: last.close >= last.open,
                    });
                }
                return;
            }

            const candlePoint = param.seriesData.get(candleSeries) as
                | CandlestickData<Time>
                | undefined;
            const sma20Point = param.seriesData.get(sma20) as
                | { value: number }
                | undefined;
            const sma50Point = param.seriesData.get(sma50) as
                | { value: number }
                | undefined;

            // Find volume for this bar from our data
            const timeKey = param.time;
            const volBar = candleDataRef.current.find(
                (c) => String(c.time) === String(timeKey)
            );

            if (candlePoint) {
                setLegend({
                    open: candlePoint.open,
                    high: candlePoint.high,
                    low: candlePoint.low,
                    close: candlePoint.close,
                    volume: volBar?.volume ?? null,
                    sma20: sma20Point?.value ?? null,
                    sma50: sma50Point?.value ?? null,
                    isGain: candlePoint.close >= candlePoint.open,
                });
            }
        });

        // ── ResizeObserver ──
        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                chart.applyOptions({ width, height });
            }
        });
        resizeObserver.observe(containerRef.current);

        return () => {
            resizeObserver.disconnect();
            chart.remove();
            chartRef.current = null;
            candleSeriesRef.current = null;
            volumeSeriesRef.current = null;
            sma20SeriesRef.current = null;
            sma50SeriesRef.current = null;
        };
    }, []);

    /* ── Load data on interval / symbol change ─────────────── */

    useEffect(() => {
        let cancelled = false;

        // Resolve interval + optional manual range
        let interval: string;
        let range: string | undefined;

        if (activeDailyIdx !== null) {
            const tf = DAILY_TFS[activeDailyIdx];
            interval = tf.interval;
            range = (tf as { range?: string }).range;
        } else {
            interval = activeInterval;
            range = undefined; // backend auto-resolves for intraday
        }

        fetchHistory(interval, range).then((candles) => {
            if (cancelled || !candles.length) return;

            candleDataRef.current = candles;

            // ── Set candlestick data ──
            candleSeriesRef.current?.setData(
                candles.map((c) => ({
                    time: c.time as Time,
                    open: c.open,
                    high: c.high,
                    low: c.low,
                    close: c.close,
                }))
            );

            // ── Set volume data ──
            volumeSeriesRef.current?.setData(
                candles.map((c) => ({
                    time: c.time as Time,
                    value: c.volume,
                    color:
                        c.close >= c.open
                            ? "rgba(34, 197, 94, 0.5)"
                            : "rgba(239, 68, 68, 0.5)",
                }))
            );

            // ── Calculate & set SMA 20 ──
            const sma20Data = calculateSMA(candles, 20);
            sma20DataRef.current = sma20Data;
            sma20SeriesRef.current?.setData(
                sma20Data.map((d) => ({ time: d.time as Time, value: d.value }))
            );

            // ── Calculate & set SMA 50 ──
            const sma50Data = calculateSMA(candles, 50);
            sma50DataRef.current = sma50Data;
            sma50SeriesRef.current?.setData(
                sma50Data.map((d) => ({ time: d.time as Time, value: d.value }))
            );

            // ── ICT: FVG zones + Entry Signal markers (v5 plugin API) ──
            if (candleSeriesRef.current) {
                const { markers: fvgMarkerList, signals } = findFVGs(candles);
                const fvgMarkers = fvgMarkerList.map((m) => ({
                    time: m.time as Time,
                    position: m.position,
                    color: m.color,
                    shape: m.shape,
                    text: m.text,
                    size: m.size ?? 1,
                })) as SeriesMarker<Time>[];

                if (!markersPluginRef.current) {
                    markersPluginRef.current = createSeriesMarkers(
                        candleSeriesRef.current,
                        fvgMarkers
                    );
                } else {
                    markersPluginRef.current.setMarkers(fvgMarkers);
                }

                // Emit signals to parent for the SignalPanel
                onSignals?.(signals);
            }

            // ── Set initial legend to last bar ──
            const last = candles[candles.length - 1];
            setLegend({
                open: last.open,
                high: last.high,
                low: last.low,
                close: last.close,
                volume: last.volume,
                sma20: sma20Data.length
                    ? sma20Data[sma20Data.length - 1].value
                    : null,
                sma50: sma50Data.length
                    ? sma50Data[sma50Data.length - 1].value
                    : null,
                isGain: last.close >= last.open,
            });

            chartRef.current?.timeScale().fitContent();
        });

        return () => {
            cancelled = true;
        };
    }, [activeInterval, activeDailyIdx, symbol, fetchHistory]);

    /* ── Render ─────────────── */

    return (
        <div className="flex h-full flex-col">
            {/* Timeframe Toolbar */}
            <div className="flex flex-col gap-1 px-2 pb-2">
                {/* Intraday row */}
                <div className="flex items-center gap-1">
                    <span className="text-[9px] text-muted-foreground/50 uppercase mr-1 font-mono">Intraday</span>
                    {INTRADAY_TFS.map((tf) => (
                        <Button
                            key={tf.interval}
                            variant={activeDailyIdx === null && activeInterval === tf.interval ? "default" : "ghost"}
                            size="sm"
                            className={`h-6 px-2.5 text-xs font-mono-num ${activeDailyIdx === null && activeInterval === tf.interval
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:text-foreground"
                                }`}
                            onClick={() => { setActiveInterval(tf.interval); setActiveDailyIdx(null); onIntervalChange?.(tf.interval); }}
                        >
                            {tf.label}
                        </Button>
                    ))}
                    <div className="mx-1 h-4 w-px bg-border/50" />
                    <span className="text-[9px] text-muted-foreground/50 uppercase mr-1 font-mono">Daily</span>
                    {DAILY_TFS.map((tf, i) => (
                        <Button
                            key={tf.label}
                            variant={activeDailyIdx === i ? "default" : "ghost"}
                            size="sm"
                            className={`h-6 px-2.5 text-xs font-mono-num ${activeDailyIdx === i
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:text-foreground"
                                }`}
                            onClick={() => { setActiveDailyIdx(i); onIntervalChange?.(tf.label); }}
                        >
                            {tf.label}
                        </Button>
                    ))}

                    {loading && (
                        <div className="ml-2 h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                    )}
                    {error && <span className="ml-2 text-xs text-loss">{error}</span>}
                </div>
            </div>

            {/* Chart + Legend Container */}
            <div className="relative flex-1 min-h-[280px]">
                {/* Floating Legend Overlay */}
                {legend && (
                    <div
                        ref={legendRef}
                        className="absolute top-1 left-2 z-10 pointer-events-none select-none"
                    >
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] font-mono-num">
                            <span className="text-muted-foreground">O</span>
                            <span className={legend.isGain ? "text-[#22c55e]" : "text-[#ef4444]"}>
                                {fmt(legend.open)}
                            </span>
                            <span className="text-muted-foreground">H</span>
                            <span className={legend.isGain ? "text-[#22c55e]" : "text-[#ef4444]"}>
                                {fmt(legend.high)}
                            </span>
                            <span className="text-muted-foreground">L</span>
                            <span className={legend.isGain ? "text-[#22c55e]" : "text-[#ef4444]"}>
                                {fmt(legend.low)}
                            </span>
                            <span className="text-muted-foreground">C</span>
                            <span className={legend.isGain ? "text-[#22c55e]" : "text-[#ef4444]"}>
                                {fmt(legend.close)}
                            </span>
                            <span className="text-muted-foreground">Vol</span>
                            <span className="text-foreground/70">{fmtVol(legend.volume)}</span>
                            <span className="text-[#FACC15]">MA20</span>
                            <span className="text-[#FACC15]/80">{fmt(legend.sma20)}</span>
                            <span className="text-[#3B82F6]">MA50</span>
                            <span className="text-[#3B82F6]/80">{fmt(legend.sma50)}</span>
                        </div>
                    </div>
                )}

                {/* Chart Container */}
                <div
                    ref={containerRef}
                    className="h-full w-full"
                    style={{ position: "absolute", inset: 0 }}
                />
            </div>
        </div>
    );
}
