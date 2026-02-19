"use client";

import { useState } from "react";
import { type ICTSignal, type ScoreBreakdown, CONFLUENCE_WEIGHTS } from "@/lib/ict";
import { cn } from "@/lib/utils";

/* ── Helpers ─────────────── */

function scoreColor(score: number): string {
    if (score >= 80) return "text-emerald-400";
    if (score >= 60) return "text-yellow-400";
    return "text-red-400";
}

function progressColor(score: number): string {
    if (score >= 80) return "bg-emerald-500";
    if (score >= 60) return "bg-yellow-500";
    return "bg-red-500";
}

function formatTime(time: string | number): string {
    const ts = typeof time === "string" ? Number(time) : time;
    if (!isFinite(ts) || ts < 1e9) return String(time); // daily candle (YYYY-MM-DD)
    const d = new Date(ts * 1000);
    return d.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });
}

const CRITERION_LABELS: Record<keyof ScoreBreakdown, string> = {
    marketStructure: "Market Structure",
    sessionOverlap: "Session Overlap",
    orderBlock: "Order Block",
    fvgPresence: "FVG Presence",
    liquiditySwept: "Liquidity Swept",
    discountPremium: "Discount / Premium",
    candlestick: "Candlestick",
};

/* ── Sub-Components ─────────────── */

function ScoreBar({ score }: { score: number }) {
    return (
        <div className="relative h-1.5 w-full rounded-full bg-white/10">
            <div
                className={cn("h-full rounded-full transition-all duration-700", progressColor(score))}
                style={{ width: `${Math.min(score, 100)}%` }}
            />
        </div>
    );
}

function Breakdown({ breakdown }: { breakdown: ScoreBreakdown }) {
    return (
        <div className="mt-2 space-y-1 rounded-lg border border-white/5 bg-white/[0.03] p-2">
            {(Object.keys(breakdown) as (keyof ScoreBreakdown)[]).map((key) => {
                const { score, max, passed } = breakdown[key];
                return (
                    <div key={key} className="flex items-center gap-1.5 text-[11px]">
                        <span className={passed ? "text-emerald-400" : "text-white/25"}>
                            {passed ? "✅" : "❌"}
                        </span>
                        <span className={cn("flex-1", passed ? "text-foreground/80" : "text-muted-foreground/50")}>
                            {CRITERION_LABELS[key]}
                        </span>
                        <span className={cn("font-mono-num tabular-nums", passed ? scoreColor(score) : "text-muted-foreground/40")}>
                            +{score}<span className="text-muted-foreground/30">/{max}</span>
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

interface SignalCardProps {
    signal: ICTSignal;
    symbol: string;
    interval: string;
}

function SignalCard({ signal, symbol, interval }: SignalCardProps) {
    const [expanded, setExpanded] = useState(false);
    const isLong = signal.type === "LONG";

    return (
        <div
            className={cn(
                "rounded-xl border p-3 cursor-pointer transition-all duration-200 hover:border-white/20",
                isLong
                    ? "border-emerald-500/20 bg-emerald-500/5"
                    : "border-rose-500/20 bg-rose-500/5"
            )}
            onClick={() => setExpanded((v) => !v)}
        >
            {/* Header row */}
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <span
                        className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider",
                            isLong
                                ? "bg-emerald-500/20 text-emerald-400"
                                : "bg-rose-500/20 text-rose-400"
                        )}
                    >
                        {isLong ? "▲ LONG" : "▼ SHORT"}
                    </span>
                    <span className="font-mono-num text-xs font-semibold text-foreground">
                        {symbol}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{interval}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className={cn("font-mono-num text-sm font-bold", scoreColor(signal.totalScore))}>
                        {signal.totalScore}
                        <span className="text-[10px] font-normal text-muted-foreground">/100</span>
                    </span>
                    <span className="text-[10px] text-muted-foreground/60">
                        {formatTime(signal.time)}
                    </span>
                    <span className="text-muted-foreground/40 text-xs">{expanded ? "▴" : "▾"}</span>
                </div>
            </div>

            {/* Score bar */}
            <div className="mt-2">
                <ScoreBar score={signal.totalScore} />
            </div>

            {/* Passed criteria chips */}
            <div className="mt-2 flex flex-wrap gap-1">
                {(Object.keys(signal.breakdown) as (keyof ScoreBreakdown)[])
                    .filter((k) => signal.breakdown[k].passed)
                    .map((k) => (
                        <span
                            key={k}
                            className="rounded-full bg-white/5 px-1.5 py-0.5 text-[9px] text-foreground/60"
                        >
                            {CRITERION_LABELS[k]}
                        </span>
                    ))}
            </div>

            {/* Collapsible detail breakdown */}
            {expanded && <Breakdown breakdown={signal.breakdown} />}
        </div>
    );
}

/* ── Main Panel ─────────────── */

interface SignalPanelProps {
    signals: ICTSignal[];
    symbol: string;
    interval: string;
}

export function SignalPanel({ signals, symbol, interval }: SignalPanelProps) {
    // Show latest 10 signals, most recent first
    const sorted = [...signals].reverse().slice(0, 10);

    return (
        <div className="flex h-full flex-col">
            {/* Panel header */}
            <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground/80">
                        高機率訊號
                    </span>
                    <span className="text-[10px] text-muted-foreground">≥ 60分</span>
                </div>
                {sorted.length > 0 && (
                    <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-mono text-primary">
                        {sorted.length} 個訊號
                    </span>
                )}
            </div>

            {/* Signal list */}
            {sorted.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
                    <span className="text-2xl opacity-20">🎯</span>
                    <p className="text-xs text-muted-foreground/50">
                        目前無高機率訊號
                    </p>
                    <p className="text-[10px] text-muted-foreground/30">
                        切換至 15m / 60m 時框查看
                    </p>
                </div>
            ) : (
                <div className="space-y-2 overflow-y-auto pr-0.5">
                    {sorted.map((sig, idx) => (
                        <SignalCard
                            key={`${sig.time}-${idx}`}
                            signal={sig}
                            symbol={symbol}
                            interval={interval}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
