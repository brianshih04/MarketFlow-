"use client";

import { useState, useCallback, useRef } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  ListOrdered,
  TrendingUp,
  TrendingDown,
  Newspaper,
  Briefcase,
  Crosshair,
} from "lucide-react";
import { TickerTape, WatchlistTable, useRealtimeQuotes } from "@/components/features/ticker";
import { ChartWidget } from "@/components/features/chart-widget";
import { NewsFeed } from "@/components/features/news-feed";
import { SignalPanel } from "@/components/features/signal-panel";
import { useAppStore } from "@/store/use-app-store";
import { type ICTSignal } from "@/lib/ict";
import { type LiveTrade } from "@/components/features/ticker";
import { TICKER_SYMBOLS_FH, toFHSymbol } from "@/lib/finnhub";

/* ── Placeholder Data ─────────────── */

const movers = [
  { symbol: "SMCI", name: "Super Micro", change: 12.8, price: 48.32 },
  { symbol: "PLTR", name: "Palantir", change: 7.2, price: 78.15 },
  { symbol: "AMD", name: "AMD Inc.", change: -4.1, price: 162.9 },
  { symbol: "TSLA", name: "Tesla Inc.", change: -2.8, price: 345.6 },
];

const positions = [
  { symbol: "AAPL", qty: 100, entry: 189.5, current: 192.3 },
  { symbol: "NVDA", qty: 50, entry: 820.0, current: 875.4 },
  { symbol: "ES=F", qty: 2, entry: 5180.0, current: 5245.0 },
];

/* ── Dashboard Page ─────────────── */

export default function DashboardPage() {
  const activeSymbol = useAppStore((s) => s.activeSymbol);
  const activeSymbolName = useAppStore((s) => s.activeSymbolName);

  const [signals, setSignals] = useState<ICTSignal[]>([]);
  const [currentInterval, setCurrentInterval] = useState("15m");

  /* ── Page-level Finnhub WebSocket ── */
  // Live trade handler ref — points to ChartWidget's internal updater
  const chartLiveHandlerRef = useRef<((trade: LiveTrade) => void) | null>(null);

  const handleLiveTrade = useCallback((trade: LiveTrade) => {
    chartLiveHandlerRef.current?.(trade);
  }, []);

  // Subscribe at page level so TickerTape + ChartWidget share one WS connection
  const { quotes: tickerQuotes, wsStatus } = useRealtimeQuotes(TICKER_SYMBOLS_FH, handleLiveTrade);

  /* Callback for ChartWidget to register its internal live-update handler */
  const registerChartHandler = useCallback((handler: (trade: LiveTrade) => void) => {
    chartLiveHandlerRef.current = handler;
  }, []);

  return (
    <div className="space-y-4">
      {/* Ticker Tape */}
      <Card className="glow-card border-border/50 bg-card">
        <CardContent className="px-4 py-0">
          <TickerTape quotes={tickerQuotes} wsStatus={wsStatus} />
        </CardContent>
      </Card>

      {/* Bento Grid */}
      <div className="grid auto-rows-auto gap-3 md:gap-4 grid-cols-1 lg:grid-cols-3">
        {/* Chart — spans 2 cols on desktop */}
        <Card className="glow-card border-border/50 bg-card lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <span className="text-foreground font-semibold">{activeSymbol}</span>
              <span className="text-muted-foreground font-normal">— {activeSymbolName}</span>
              {wsStatus === "live" && (
                <span className="ml-auto text-[9px] rounded-full bg-gain/10 px-2 py-0.5 font-mono text-gain">
                  ● LIVE
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] md:h-[380px] lg:h-[500px] p-2 pt-0">
            <ChartWidget
              symbol={activeSymbol}
              onSignals={setSignals}
              onIntervalChange={setCurrentInterval}
            />
          </CardContent>
        </Card>

        {/* Signal Panel — ICT Composite Score */}
        <Card className="glow-card border-border/50 bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Crosshair className="h-4 w-4" />
              高機率設置
              <Badge variant="outline" className="ml-auto text-[9px] font-mono border-primary/30 text-primary/70">
                複合評分
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 pt-0">
            <SignalPanel
              signals={signals}
              symbol={activeSymbol}
              interval={currentInterval}
            />
          </CardContent>
        </Card>

        {/* Watchlist */}
        <Card className="glow-card border-border/50 bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <ListOrdered className="h-4 w-4" />
              Watchlist
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 pt-0">
            <WatchlistTable quotes={tickerQuotes} />
          </CardContent>
        </Card>

        {/* Market Movers */}
        <Card className="glow-card border-border/50 bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              Market Movers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 p-2 pt-0">
            {movers.map((m) => (
              <div
                key={m.symbol}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted/50"
              >
                <div className="flex flex-col">
                  <span className="font-semibold">{m.symbol}</span>
                  <span className="text-xs text-muted-foreground">{m.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono-num text-sm">${m.price.toFixed(2)}</span>
                  <Badge
                    variant="outline"
                    className={`font-mono-num text-xs ${m.change >= 0
                      ? "border-gain/30 bg-gain/10 text-gain"
                      : "border-loss/30 bg-loss/10 text-loss"
                      }`}
                  >
                    {m.change >= 0 ? <TrendingUp className="mr-0.5 h-3 w-3" /> : <TrendingDown className="mr-0.5 h-3 w-3" />}
                    {m.change >= 0 ? "+" : ""}{m.change}%
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* News Feed */}
        <Card className="glow-card border-border/50 bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Newspaper className="h-4 w-4" />
              News — {activeSymbol}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 pt-0">
            <NewsFeed />
          </CardContent>
        </Card>

        {/* Positions */}
        <Card className="glow-card border-border/50 bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Briefcase className="h-4 w-4" />
              Open Positions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 p-2 pt-0">
            {positions.map((p) => {
              const pnl = (p.current - p.entry) * p.qty;
              const pnlPct = ((p.current - p.entry) / p.entry) * 100;
              const isGain = pnl >= 0;
              return (
                <div
                  key={p.symbol}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted/50"
                >
                  <div className="flex flex-col">
                    <span className="font-semibold">{p.symbol}</span>
                    <span className="text-xs text-muted-foreground">
                      {p.qty} shares @ ${p.entry.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className={`font-mono-num text-sm font-semibold ${isGain ? "text-gain" : "text-loss"}`}>
                      {isGain ? "+" : ""}${pnl.toFixed(2)}
                    </span>
                    <span className={`font-mono-num text-xs ${isGain ? "text-gain" : "text-loss"}`}>
                      {isGain ? "+" : ""}{pnlPct.toFixed(2)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
