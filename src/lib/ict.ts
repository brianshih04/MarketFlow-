/**
 * ICT (Inner Circle Trader) Concepts Library — v2
 *
 * Implements:
 *  - Fair Value Gap (FVG) detection
 *  - Strict Trend Alignment Filter (SMA-50)
 *  - Strict Displacement Filter (1.5× avg body size)
 *  - Entry Signal (first-touch mitigation) detection
 */

/* ── Types ─────────────── */

export interface CandleInput {
    time: string | number;
    open: number;
    high: number;
    low: number;
    close: number;
}

/** Internal FVG zone — tracks mitigation state */
interface FvgZone {
    type: "bullish" | "bearish";
    top: number;
    bottom: number;
    mitigated: boolean;
    time: string | number;
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

/* ── Constants ─────────────── */

const SMA_PERIOD = 50;
const ATR_PERIOD = 14;
const DISPLACEMENT_MULTIPLIER = 1.5;

const COLOR_BULLISH_FVG = "#22c55e55"; // translucent green — FVG zone marker
const COLOR_BEARISH_FVG = "#ef444455"; // translucent red  — FVG zone marker
const COLOR_LONG_ENTRY = "#10b981";  // Emerald — confirmed long signal
const COLOR_SHORT_ENTRY = "#e11d48";  // Rose    — confirmed short signal

/* ── Internal helpers ─────────────── */

/**
 * Simple Moving Average for `close` prices.
 * Returns NaN for indices where there isn't enough history.
 */
function sma(data: CandleInput[], endIdx: number, period: number): number {
    if (endIdx < period - 1) return NaN;
    let sum = 0;
    for (let j = endIdx - period + 1; j <= endIdx; j++) {
        sum += data[j].close;
    }
    return sum / period;
}

/**
 * Average candle body size over the last `period` candles ending at `endIdx`.
 * Body = |close - open|
 */
function avgBody(data: CandleInput[], endIdx: number, period: number): number {
    const start = Math.max(0, endIdx - period + 1);
    let sum = 0;
    let count = 0;
    for (let j = start; j <= endIdx; j++) {
        sum += Math.abs(data[j].close - data[j].open);
        count++;
    }
    return count > 0 ? sum / count : 0;
}

/* ── Main Export ─────────────── */

/**
 * Detect Strict ICT Fair Value Gaps and Entry Signals from OHLC data.
 *
 * Algorithm:
 *   For each candle [i] (i >= 2):
 *     A) Check if a new *strict* FVG forms:
 *        - Price gap exists (standard FVG triplet condition)
 *        - Trend Alignment: close[i] vs SMA-50[i]
 *        - Displacement: body[i-1] > 1.5× avg body over last 14 bars
 *     B) Check current candle against all open (unmitigated) FVG zones
 *        → Fire LONG/SHORT entry signal on first touch.
 *
 * @param data  Candles sorted ascending by time (oldest → newest)
 * @returns     Combined array of FVG zone markers + entry signal markers
 */
export function findFVGs(data: CandleInput[]): ChartMarker[] {
    if (data.length < Math.max(3, SMA_PERIOD)) return [];

    const markers: ChartMarker[] = [];
    const openZones: FvgZone[] = [];

    for (let i = 2; i < data.length; i++) {
        const prev1 = data[i - 1]; // displacement candle
        const prev2 = data[i - 2];
        const curr = data[i];

        /* ── Compute filters at candle i ── */
        const sma50 = sma(data, i, SMA_PERIOD);
        const hasSma = !isNaN(sma50);
        const displacementBody = Math.abs(prev1.close - prev1.open);
        const avgBody14 = avgBody(data, i - 1, ATR_PERIOD);

        /* ────────────────────────────────────────────────────────────
         * PHASE A: Detect a new STRICT FVG at this [i-2, i-1, i] triplet
         * ──────────────────────────────────────────────────────────── */

        // ── Bullish FVG ──
        // Gap: [i-2].high < [i].low  (price skipped upward)
        // Trend: close[i] > SMA-50  (uptrend)
        // Displacement: body[i-1] > 1.5× avg body
        if (
            curr.low > prev2.high &&
            hasSma && curr.close > sma50 &&
            displacementBody > DISPLACEMENT_MULTIPLIER * avgBody14
        ) {
            const zone: FvgZone = {
                type: "bullish",
                top: curr.low,      // top of gap = [i].low
                bottom: prev2.high, // bottom of gap = [i-2].high
                mitigated: false,
                time: curr.time,
            };
            openZones.push(zone);

            // Small formation marker
            markers.push({
                time: curr.time,
                position: "belowBar",
                color: COLOR_BULLISH_FVG,
                shape: "square",
                text: "FVG↑",
                size: 1,
            });
        }

        // ── Bearish FVG ──
        // Gap: [i].high < [i-2].low  (price skipped downward)
        // Trend: close[i] < SMA-50 (downtrend)
        // Displacement: body[i-1] > 1.5× avg body
        if (
            curr.high < prev2.low &&
            hasSma && curr.close < sma50 &&
            displacementBody > DISPLACEMENT_MULTIPLIER * avgBody14
        ) {
            const zone: FvgZone = {
                type: "bearish",
                top: prev2.low,     // top of gap = [i-2].low
                bottom: curr.high,  // bottom of gap = [i].high
                mitigated: false,
                time: curr.time,
            };
            openZones.push(zone);

            markers.push({
                time: curr.time,
                position: "aboveBar",
                color: COLOR_BEARISH_FVG,
                shape: "square",
                text: "FVG↓",
                size: 1,
            });
        }

        /* ────────────────────────────────────────────────────────────
         * PHASE B: Check current candle for mitigation against open zones
         *   First touch only — once mitigated, zone is closed.
         * ──────────────────────────────────────────────────────────── */

        for (const zone of openZones) {
            if (zone.mitigated) continue;
            // Skip the candle that formed the zone
            if (zone.time === curr.time) continue;

            if (zone.type === "bullish") {
                // Long Entry: candle.low retraces into the bullish gap
                if (curr.low <= zone.top && curr.low >= zone.bottom) {
                    zone.mitigated = true;
                    markers.push({
                        time: curr.time,
                        position: "belowBar",
                        color: COLOR_LONG_ENTRY,
                        shape: "arrowUp",
                        text: "★ LONG",
                        size: 2,
                    });
                }
            } else {
                // Short Entry: candle.high pushes into the bearish gap
                if (curr.high >= zone.bottom && curr.high <= zone.top) {
                    zone.mitigated = true;
                    markers.push({
                        time: curr.time,
                        position: "aboveBar",
                        color: COLOR_SHORT_ENTRY,
                        shape: "arrowDown",
                        text: "★ SHORT",
                        size: 2,
                    });
                }
            }
        }
    }

    // Lightweight Charts requires markers sorted by time ascending
    markers.sort((a, b) => {
        const ta = typeof a.time === "string" ? Number(a.time) : (a.time as number);
        const tb = typeof b.time === "string" ? Number(b.time) : (b.time as number);
        return ta - tb;
    });

    return markers;
}
