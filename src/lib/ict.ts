/**
 * ICT (Inner Circle Trader) Concepts Library
 * Implements Fair Value Gap (FVG) detection and Entry Signal (mitigation) logic.
 */

/* ── Types ─────────────── */

export interface CandleInput {
    time: string | number;
    open: number;
    high: number;
    low: number;
    close: number;
}

/** Internal FVG zone, tracks mitigation state */
interface FvgZone {
    type: "bullish" | "bearish";
    top: number;
    bottom: number;
    mitigated: boolean;
    time: string | number;
}

/** A marker to render on the Lightweight-Charts candlestick series */
export interface ChartMarker {
    time: string | number;
    position: "belowBar" | "aboveBar" | "inBar";
    color: string;
    shape: "arrowUp" | "arrowDown" | "circle" | "square";
    text: string;
    size?: number;
}

/* ── Constants ─────────────── */

const COLOR_BULLISH_FVG = "#22c55e4d"; // translucent green (for zone markers)
const COLOR_BEARISH_FVG = "#ef44444d"; // translucent red  (for zone markers)
const COLOR_LONG_ENTRY = "#10b981";    // Emerald
const COLOR_SHORT_ENTRY = "#e11d48";   // Rose

/* ── Main export ─────────────── */

/**
 * Detect Fair Value Gaps and Entry Signals from OHLC data.
 *
 * Algorithm:
 *   Pass 1 – scan every triplet [i-2, i-1, i] for FVGs.
 *   Pass 2 – for each subsequent candle, check if price mitigates any open FVG.
 *
 * @param data  Array of candles sorted by time ascending (oldest first)
 * @returns     Array of ChartMarker objects (FVG + Entry Signals combined)
 */
export function findFVGs(data: CandleInput[]): ChartMarker[] {
    if (data.length < 3) return [];

    const markers: ChartMarker[] = [];
    const openZones: FvgZone[] = [];

    for (let i = 2; i < data.length; i++) {
        const prev2 = data[i - 2]; // candle  [i-2]
        const curr = data[i];     // current candle [i]

        /* ────────────────────────────────────────────────
         * Step A: Detect new FVGs at this candle index i
         * ─────────────────────────────────────────────── */

        // Bullish FVG: gap between [i-2].high and [i].low
        if (curr.low > prev2.high) {
            const zone: FvgZone = {
                type: "bullish",
                top: curr.low,      // top of the gap  = [i].low
                bottom: prev2.high, // bottom of gap   = [i-2].high
                mitigated: false,
                time: curr.time,
            };
            openZones.push(zone);

            // Small FVG zone marker at the formation candle
            markers.push({
                time: curr.time,
                position: "belowBar",
                color: COLOR_BULLISH_FVG,
                shape: "square",
                text: "FVG↑",
                size: 1,
            });
        }

        // Bearish FVG: gap between [i].high and [i-2].low
        if (curr.high < prev2.low) {
            const zone: FvgZone = {
                type: "bearish",
                top: prev2.low,    // top of the gap  = [i-2].low
                bottom: curr.high, // bottom of gap   = [i].high
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

        /* ────────────────────────────────────────────────
         * Step B: Check current candle against open FVGs
         *   Only unmitgated zones; first touch only.
         * ─────────────────────────────────────────────── */

        for (const zone of openZones) {
            if (zone.mitigated) continue;
            // Skip the candle that formed the FVG itself
            if (zone.time === curr.time) continue;

            if (zone.type === "bullish") {
                // Long Entry: candle.low drops into the bullish FVG zone
                if (curr.low <= zone.top && curr.low >= zone.bottom) {
                    zone.mitigated = true;
                    markers.push({
                        time: curr.time,
                        position: "belowBar",
                        color: COLOR_LONG_ENTRY,
                        shape: "arrowUp",
                        text: "LONG",
                        size: 2,
                    });
                }
            } else {
                // Short Entry: candle.high pushes into the bearish FVG zone
                if (curr.high >= zone.bottom && curr.high <= zone.top) {
                    zone.mitigated = true;
                    markers.push({
                        time: curr.time,
                        position: "aboveBar",
                        color: COLOR_SHORT_ENTRY,
                        shape: "arrowDown",
                        text: "SHORT",
                        size: 2,
                    });
                }
            }
        }
    }

    // Sort markers by time ascending (required by Lightweight Charts)
    markers.sort((a, b) => {
        const ta = typeof a.time === "string" ? Number(a.time) : a.time;
        const tb = typeof b.time === "string" ? Number(b.time) : b.time;
        return ta - tb;
    });

    return markers;
}
