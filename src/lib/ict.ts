/**
 * ICT (Inner Circle Trader) Concepts Library — v3
 *
 * Implements:
 *  - Fair Value Gap (FVG) detection
 *  - Trend Alignment Filter (SMA-50)
 *  - Displacement Filter (1.5× avg body size)
 *  - 100-point Composite Confluence Scoring System
 *  - Entry Signal (first-touch mitigation) with score >= 60 gate
 */

/* ── Types ─────────────── */

export interface CandleInput {
    time: string | number;
    open: number;
    high: number;
    low: number;
    close: number;
}

/** Individual breakdown of each scoring factor */
export interface ScoreBreakdown {
    marketStructure: { score: number; max: number; passed: boolean };
    sessionOverlap: { score: number; max: number; passed: boolean };
    orderBlock: { score: number; max: number; passed: boolean };
    fvgPresence: { score: number; max: number; passed: boolean };
    liquiditySwept: { score: number; max: number; passed: boolean };
    discountPremium: { score: number; max: number; passed: boolean };
    candlestick: { score: number; max: number; passed: boolean };
}

/** A fully-qualified entry signal emitted by findFVGs */
export interface ICTSignal {
    /** Unix seconds or YYYY-MM-DD */
    time: string | number;
    type: "LONG" | "SHORT";
    totalScore: number;
    breakdown: ScoreBreakdown;
}

/** A marker to render on the Lightweight Charts candlestick series */
export interface ChartMarker {
    time: string | number;
    position: "belowBar" | "aboveBar" | "inBar";
    color: string;
    shape: "arrowUp" | "arrowDown" | "circle" | "square";
    text: string;
    size?: number;
}

/** Combined return value from findFVGs */
export interface FVGResult {
    markers: ChartMarker[];
    signals: ICTSignal[];
}

/** Internal FVG zone — tracks mitigation state */
interface FvgZone {
    type: "bullish" | "bearish";
    top: number;
    bottom: number;
    mitigated: boolean;
    time: string | number;
    formedAt: number; // index in data[]
}

/* ── Confluence Weights ─────────────── */

export const CONFLUENCE_WEIGHTS = {
    marketStructure: 20, // Price > SMA50 (trend alignment)
    sessionOverlap: 15, // NY AM / PM session
    orderBlock: 20, // Near structural order block (proxied by swing)
    fvgPresence: 15, // Valid FVG exists (always true when signal fires)
    liquiditySwept: 15, // Recent swing H/L cleared before FVG
    discountPremium: 10, // In lower/upper 50% of 40-candle range
    candlestick: 5, // Pin bar / rejection wick
} as const;

/* ── ICT Filter Constants ─────────────── */

const SMA_PERIOD = 50;
const ATR_PERIOD = 14;
const DISPLACEMENT_MULT = 1.5;
const MIN_SCORE = 60;

const COLOR_BULLISH_FVG = "#22c55e55";
const COLOR_BEARISH_FVG = "#ef444455";
const COLOR_LONG_ENTRY = "#10b981";
const COLOR_SHORT_ENTRY = "#e11d48";

/* ── Internal Helpers ─────────────── */

function sma(data: CandleInput[], endIdx: number, period: number): number {
    if (endIdx < period - 1) return NaN;
    let sum = 0;
    for (let j = endIdx - period + 1; j <= endIdx; j++) sum += data[j].close;
    return sum / period;
}

function avgBody(data: CandleInput[], endIdx: number, period: number): number {
    const start = Math.max(0, endIdx - period + 1);
    let sum = 0, count = 0;
    for (let j = start; j <= endIdx; j++) {
        sum += Math.abs(data[j].close - data[j].open);
        count++;
    }
    return count > 0 ? sum / count : 0;
}

/**
 * Detect if a Unix-seconds timestamp falls within a session window.
 * NY AM: 09:30–11:30 ET  →  13:30–15:30 UTC (winter) / 14:30–16:30 UTC (summer)
 * NY PM: 13:30–15:30 ET  →  17:30–19:30 UTC (winter) / 18:30–20:30 UTC (summer)
 * We use UTC-5 offset (winter) as a conservative approximation.
 */
function isNYSession(time: string | number): boolean {
    const ts = typeof time === "string" ? Number(time) * 1000 : (time as number) * 1000;
    if (!isFinite(ts) || ts < 1e12) return false; // non-Unix (daily) candles → skip

    const d = new Date(ts);
    const utcH = d.getUTCHours();
    const utcM = d.getUTCMinutes();
    const totalMinutes = utcH * 60 + utcM;

    // NY AM open: 14:30–16:30 UTC (UTC-5 winter, 09:30–11:30 ET)
    const nyAmStart = 14 * 60 + 30;
    const nyAmEnd = 16 * 60 + 30;
    // NY PM drive: 18:30–20:30 UTC (UTC-5 winter, 13:30–15:30 ET)
    const nyPmStart = 18 * 60 + 30;
    const nyPmEnd = 20 * 60 + 30;

    return (totalMinutes >= nyAmStart && totalMinutes <= nyAmEnd) ||
        (totalMinutes >= nyPmStart && totalMinutes <= nyPmEnd);
}

/* ── Composite Score Calculator ─────────────── */

function calculateCompositeScore(
    data: CandleInput[],
    currentIndex: number,
    type: "LONG" | "SHORT",
    zone: FvgZone,
    sma50: number
): { totalScore: number; breakdown: ScoreBreakdown } {
    const curr = data[currentIndex];
    const W = CONFLUENCE_WEIGHTS;

    /* 1. Market Structure — SMA50 trend alignment (already gated before this call) */
    const msPass = type === "LONG"
        ? (!isNaN(sma50) && curr.close > sma50)
        : (!isNaN(sma50) && curr.close < sma50);
    const msScore = msPass ? W.marketStructure : 0;

    /* 2. Session Overlap — NY AM / PM */
    const sessionPass = isNYSession(curr.time);
    const sessionScore = sessionPass ? W.sessionOverlap : 0;

    /* 3. Order Block proxy — swing high/low within last 20 candles near zone */
    let obPass = false;
    const obLookback = Math.max(0, currentIndex - 20);
    if (type === "LONG") {
        // Look for a recent swing low near the zone bottom (demand zone)
        for (let j = obLookback; j < currentIndex; j++) {
            if (data[j].low <= zone.bottom * 1.002 && data[j].low >= zone.bottom * 0.995) {
                obPass = true; break;
            }
        }
    } else {
        for (let j = obLookback; j < currentIndex; j++) {
            if (data[j].high >= zone.top * 0.998 && data[j].high <= zone.top * 1.005) {
                obPass = true; break;
            }
        }
    }
    const obScore = obPass ? W.orderBlock : 0;

    /* 4. FVG Presence — always true when this function is called */
    const fvgScore = W.fvgPresence;

    /* 5. Liquidity Swept — recent swing H/L breached before FVG formed */
    let liqPass = false;
    const liqLookback = Math.max(0, zone.formedAt - 10);
    if (type === "LONG") {
        // A swing low was swept (price dipped below) shortly before the bullish FVG
        let swingLow = Infinity;
        for (let j = liqLookback; j < zone.formedAt; j++) swingLow = Math.min(swingLow, data[j].low);
        // The candle before the FVG formed briefly took out that low
        if (zone.formedAt > 0 && data[zone.formedAt - 1].low <= swingLow * 1.001) liqPass = true;
    } else {
        let swingHigh = -Infinity;
        for (let j = liqLookback; j < zone.formedAt; j++) swingHigh = Math.max(swingHigh, data[j].high);
        if (zone.formedAt > 0 && data[zone.formedAt - 1].high >= swingHigh * 0.999) liqPass = true;
    }
    const liqScore = liqPass ? W.liquiditySwept : 0;

    /* 6. Discount / Premium — 40-candle equilibrium */
    const dpLookback = Math.max(0, currentIndex - 40);
    let rangeHigh = -Infinity, rangeLow = Infinity;
    for (let j = dpLookback; j < currentIndex; j++) {
        rangeHigh = Math.max(rangeHigh, data[j].high);
        rangeLow = Math.min(rangeLow, data[j].low);
    }
    const eq = (rangeHigh + rangeLow) / 2;
    const dpPass = type === "LONG"
        ? curr.close <= eq  // in discount (lower half) for longs
        : curr.close >= eq; // in premium (upper half) for shorts
    const dpScore = dpPass ? W.discountPremium : 0;

    /* 7. Candlestick — Pin bar / rejection wick */
    const body = Math.abs(curr.close - curr.open);
    const totalRange = curr.high - curr.low;
    let csPass = false;
    if (totalRange > 0) {
        const lowerWick = Math.min(curr.open, curr.close) - curr.low;
        const upperWick = curr.high - Math.max(curr.open, curr.close);
        if (type === "LONG" && lowerWick > body * 0.5) csPass = true;
        if (type === "SHORT" && upperWick > body * 0.5) csPass = true;
    }
    const csScore = csPass ? W.candlestick : 0;

    /* Total */
    const totalScore = msScore + sessionScore + obScore + fvgScore + liqScore + dpScore + csScore;

    const breakdown: ScoreBreakdown = {
        marketStructure: { score: msScore, max: W.marketStructure, passed: msPass },
        sessionOverlap: { score: sessionScore, max: W.sessionOverlap, passed: sessionPass },
        orderBlock: { score: obScore, max: W.orderBlock, passed: obPass },
        fvgPresence: { score: fvgScore, max: W.fvgPresence, passed: true },
        liquiditySwept: { score: liqScore, max: W.liquiditySwept, passed: liqPass },
        discountPremium: { score: dpScore, max: W.discountPremium, passed: dpPass },
        candlestick: { score: csScore, max: W.candlestick, passed: csPass },
    };

    return { totalScore, breakdown };
}

/* ── Main Export ─────────────── */

/**
 * Detect Strict ICT Fair Value Gaps + Composite Score Entry Signals.
 *
 * @param data  Candles sorted ascending by time (oldest → newest)
 * @returns     { markers, signals } — markers for the chart, signals for the UI panel
 */
export function findFVGs(data: CandleInput[]): FVGResult {
    if (data.length < Math.max(3, SMA_PERIOD)) return { markers: [], signals: [] };

    const markers: ChartMarker[] = [];
    const signals: ICTSignal[] = [];
    const openZones: FvgZone[] = [];

    for (let i = 2; i < data.length; i++) {
        const prev2 = data[i - 2];
        const prev1 = data[i - 1]; // displacement candle
        const curr = data[i];

        const sma50 = sma(data, i, SMA_PERIOD);
        const hasSma = !isNaN(sma50);
        const bodyPrev1 = Math.abs(prev1.close - prev1.open);
        const avgBody14 = avgBody(data, i - 1, ATR_PERIOD);

        /* ── Phase A: Detect strict FVG ── */

        // Bullish FVG
        if (
            curr.low > prev2.high &&
            hasSma && curr.close > sma50 &&
            bodyPrev1 > DISPLACEMENT_MULT * avgBody14
        ) {
            openZones.push({
                type: "bullish",
                top: curr.low, bottom: prev2.high,
                mitigated: false, time: curr.time, formedAt: i,
            });
            markers.push({
                time: curr.time, position: "belowBar",
                color: COLOR_BULLISH_FVG, shape: "square", text: "FVG↑", size: 1,
            });
        }

        // Bearish FVG
        if (
            curr.high < prev2.low &&
            hasSma && curr.close < sma50 &&
            bodyPrev1 > DISPLACEMENT_MULT * avgBody14
        ) {
            openZones.push({
                type: "bearish",
                top: prev2.low, bottom: curr.high,
                mitigated: false, time: curr.time, formedAt: i,
            });
            markers.push({
                time: curr.time, position: "aboveBar",
                color: COLOR_BEARISH_FVG, shape: "square", text: "FVG↓", size: 1,
            });
        }

        /* ── Phase B: Check mitigation & score ── */

        for (const zone of openZones) {
            if (zone.mitigated || zone.time === curr.time) continue;

            const currentSma50 = sma(data, i, SMA_PERIOD);
            let mitTriggered = false;
            let signalType: "LONG" | "SHORT" | null = null;

            if (zone.type === "bullish" && curr.low <= zone.top && curr.low >= zone.bottom) {
                mitTriggered = true; signalType = "LONG";
            } else if (zone.type === "bearish" && curr.high >= zone.bottom && curr.high <= zone.top) {
                mitTriggered = true; signalType = "SHORT";
            }

            if (mitTriggered && signalType) {
                zone.mitigated = true;
                const { totalScore, breakdown } = calculateCompositeScore(
                    data, i, signalType, zone, currentSma50
                );

                if (totalScore >= MIN_SCORE) {
                    const markerText = `🎯 ${signalType} (${totalScore}%)`;
                    markers.push({
                        time: curr.time,
                        position: signalType === "LONG" ? "belowBar" : "aboveBar",
                        color: signalType === "LONG" ? COLOR_LONG_ENTRY : COLOR_SHORT_ENTRY,
                        shape: signalType === "LONG" ? "arrowUp" : "arrowDown",
                        text: markerText,
                        size: 2,
                    });
                    signals.push({ time: curr.time, type: signalType, totalScore, breakdown });
                }
            }
        }
    }

    // Markers must be sorted by time ascending for Lightweight Charts
    markers.sort((a, b) => {
        const ta = typeof a.time === "string" ? Number(a.time) : (a.time as number);
        const tb = typeof b.time === "string" ? Number(b.time) : (b.time as number);
        return ta - tb;
    });

    return { markers, signals };
}
