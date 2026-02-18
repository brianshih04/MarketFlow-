"use client";

import { useEffect, useState, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import { ExternalLink, Sparkles, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { analyzeSentiment, type Sentiment } from "@/lib/sentiment";
import { useAppStore } from "@/store/use-app-store";

/* ── Types ─────────────── */

interface NewsItem {
    uuid: string;
    title: string;
    link: string;
    publisher: string;
    providerPublishTime: string | null;
    type: string;
    relatedTickers: string[];
}

/* ── Sentiment Badge ─────────────── */

const sentimentConfig: Record<
    Sentiment,
    { className: string; icon: typeof TrendingUp }
> = {
    Bullish: {
        className: "bg-green-500/15 text-green-500 border-green-500/20",
        icon: TrendingUp,
    },
    Bearish: {
        className: "bg-red-500/15 text-red-500 border-red-500/20",
        icon: TrendingDown,
    },
    Neutral: {
        className: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
        icon: Minus,
    },
};

function SentimentBadge({ sentiment }: { sentiment: Sentiment }) {
    const config = sentimentConfig[sentiment];
    const Icon = config.icon;
    return (
        <Badge variant="outline" className={`text-[10px] gap-0.5 ${config.className}`}>
            <Icon className="h-2.5 w-2.5" />
            {sentiment}
        </Badge>
    );
}

/* ── Relative time formatter ─────────────── */

function relativeTime(publishTime: string | null): string {
    if (!publishTime) return "";
    try {
        const date = new Date(publishTime);
        if (isNaN(date.getTime())) return "";
        return formatDistanceToNow(date, { addSuffix: true });
    } catch {
        return "";
    }
}

/* ── NewsFeed Component ─────────────── */

export function NewsFeed() {
    const activeSymbol = useAppStore((s) => s.activeSymbol);
    const [news, setNews] = useState<NewsItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [analyzing, setAnalyzing] = useState<string | null>(null);

    const fetchNews = useCallback(async () => {
        setLoading(true);
        try {
            const encoded = encodeURIComponent(activeSymbol);
            const res = await fetch(`/api/news?symbol=${encoded}`);
            if (!res.ok) throw new Error("Fetch failed");
            const data = await res.json();
            setNews(data.news ?? []);
        } catch {
            setNews([]);
        } finally {
            setLoading(false);
        }
    }, [activeSymbol]);

    useEffect(() => {
        fetchNews();
    }, [fetchNews]);

    // Simulate "deep analysis" button
    const handleAnalyze = (uuid: string) => {
        setAnalyzing(uuid);
        setTimeout(() => setAnalyzing(null), 2000);
    };

    if (loading) {
        return (
            <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent mr-2" />
                Loading news…
            </div>
        );
    }

    if (news.length === 0) {
        return (
            <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
                No news available for {activeSymbol}
            </div>
        );
    }

    return (
        <ScrollArea className="h-[380px] pr-2">
            <div className="space-y-1">
                {news.map((item) => {
                    const sentiment = analyzeSentiment(item.title);
                    const isAnalyzing = analyzing === item.uuid;

                    return (
                        <div
                            key={item.uuid}
                            className="group rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/40 border-b border-border/30 last:border-0"
                        >
                            {/* Header: Publisher + Time */}
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                    {item.publisher}
                                </span>
                                <span className="text-[10px] text-muted-foreground/60">
                                    {relativeTime(item.providerPublishTime)}
                                </span>
                            </div>

                            {/* Title */}
                            <a
                                href={item.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block text-[13px] leading-snug font-medium text-foreground/90 transition-colors group-hover:text-primary"
                            >
                                {item.title}
                                <ExternalLink className="inline-block ml-1 h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                            </a>

                            {/* Footer: Sentiment + Analyze */}
                            <div className="flex items-center justify-between mt-1.5">
                                <div className="flex items-center gap-1.5">
                                    <SentimentBadge sentiment={sentiment} />
                                    {item.relatedTickers?.length > 0 && (
                                        <span className="text-[10px] text-muted-foreground/50">
                                            {item.relatedTickers.slice(0, 3).join(" · ")}
                                        </span>
                                    )}
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 px-1.5 text-[10px] text-muted-foreground/50 hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => handleAnalyze(item.uuid)}
                                    disabled={isAnalyzing}
                                >
                                    <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                                    {isAnalyzing ? "Analyzing…" : "Analyze"}
                                </Button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </ScrollArea>
    );
}
