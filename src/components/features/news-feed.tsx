"use client";

import { useEffect, useState, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import { ExternalLink, Sparkles, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { analyzeSentiment, type Sentiment } from "@/lib/sentiment";
import { useAppStore } from "@/store/use-app-store";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { analyzeNews, type AnalysisResult } from "@/app/actions/analyze-news";

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
    // Track analyzing state for each item
    const [analyzing, setAnalyzing] = useState<Record<string, boolean>>({});
    const [analysisResults, setAnalysisResults] = useState<
        Record<string, AnalysisResult>
    >({});

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

    // Call Server Action
    const handleAnalyze = async (uuid: string, text: string) => {
        if (analyzing[uuid]) return;

        setAnalyzing((prev) => ({ ...prev, [uuid]: true }));
        try {
            const result = await analyzeNews(text);
            setAnalysisResults((prev) => ({ ...prev, [uuid]: result }));
        } catch (err) {
            console.error(err);
            // In a real app, show a toast here
            alert(err instanceof Error ? err.message : "Analysis failed");
        } finally {
            setAnalyzing((prev) => ({ ...prev, [uuid]: false }));
        }
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
                    const isAnalyzing = analyzing[item.uuid];
                    const analysis = analysisResults[item.uuid];

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
                                    className="h-6 px-2 text-[10px] text-muted-foreground hover:text-primary hover:bg-muted"
                                    onClick={() => handleAnalyze(item.uuid, item.title)}
                                    disabled={isAnalyzing || !!analysis}
                                >
                                    <Sparkles className="h-3 w-3 mr-1" />
                                    {isAnalyzing ? "Analyzing..." : (analysis ? "Analysis Done" : "✨ AI 解讀")}
                                </Button>
                            </div>

                            {/* AI Analysis Result */}
                            {analysis && (
                                <Alert className="mt-2 bg-muted/50 border-none p-2 animate-in fade-in slide-in-from-top-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[14px]">
                                            {analysis.sentiment === "Bullish" && "🚀"}
                                            {analysis.sentiment === "Bearish" && "🔻"}
                                            {analysis.sentiment === "Neutral" && "⚖️"}
                                        </span>
                                        <AlertTitle className="text-[12px] font-semibold m-0 text-primary">
                                            AI Analysis
                                        </AlertTitle>
                                        <Badge variant="outline" className="ml-auto text-[9px] h-4 px-1">
                                            {analysis.sentiment}
                                        </Badge>
                                    </div>
                                    <AlertDescription className="text-[11px] leading-relaxed text-foreground/90">
                                        <p className="mb-1">{analysis.summary}</p>
                                        <p className="text-muted-foreground italic text-[10px]">
                                            {analysis.reasoning}
                                        </p>
                                    </AlertDescription>
                                </Alert>
                            )}
                        </div>
                    );
                })}
            </div>
        </ScrollArea>
    );
}
