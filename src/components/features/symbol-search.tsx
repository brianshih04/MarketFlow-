"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Search, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/store/use-app-store";
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";

/* ── Types ─────────────── */

interface SearchResult {
    symbol: string;
    shortname: string;
    exchange: string;
    quoteType: string;
}

const typeColors: Record<string, string> = {
    EQUITY: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    ETF: "bg-purple-500/15 text-purple-400 border-purple-500/20",
    FUTURE: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    INDEX: "bg-cyan-500/15 text-cyan-400 border-cyan-500/20",
};

/* ── Component ─────────────── */

export function SymbolSearch() {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const setActiveSymbol = useAppStore((s) => s.setActiveSymbol);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    // ── Cmd+K / "/" keyboard shortcut ──
    useEffect(() => {
        function onKeyDown(e: KeyboardEvent) {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                setOpen((o) => !o);
            }
            if (e.key === "/" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
                e.preventDefault();
                setOpen(true);
            }
        }
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, []);

    // ── Debounced search ──
    const search = useCallback((q: string) => {
        if (debounceRef.current) clearTimeout(debounceRef.current);

        if (!q.trim()) {
            setResults([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        debounceRef.current = setTimeout(async () => {
            try {
                const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
                if (!res.ok) throw new Error("Search failed");
                const data = await res.json();
                setResults(data.results ?? []);
            } catch {
                setResults([]);
            } finally {
                setLoading(false);
            }
        }, 300);
    }, []);

    // ── Handle input change ──
    const handleValueChange = (value: string) => {
        setQuery(value);
        search(value);
    };

    // ── Handle selection ──
    const handleSelect = (result: SearchResult) => {
        setActiveSymbol(result.symbol, result.shortname);
        setOpen(false);
        setQuery("");
        setResults([]);
    };

    return (
        <>
            {/* Mobile Trigger — icon only */}
            <button
                onClick={() => setOpen(true)}
                className="flex md:hidden h-9 w-9 items-center justify-center rounded-lg border border-input bg-muted/50 text-muted-foreground"
            >
                <Search className="h-4 w-4" />
            </button>

            {/* Desktop Trigger — full bar */}
            <button
                onClick={() => setOpen(true)}
                className="hidden md:flex h-9 w-72 items-center gap-2 rounded-lg border border-input bg-muted/50 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
                <Search className="h-4 w-4" />
                <span className="flex-1 text-left">Search symbols…</span>
                <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border border-border bg-background px-1.5 font-mono-num text-[10px] font-medium text-muted-foreground sm:flex">
                    <span className="text-xs">⌘</span>K
                </kbd>
            </button>

            {/* Command Dialog */}
            <CommandDialog open={open} onOpenChange={setOpen}>
                <CommandInput
                    placeholder="Search stocks, ETFs, futures…"
                    value={query}
                    onValueChange={handleValueChange}
                />
                <CommandList>
                    {loading && (
                        <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Searching…
                        </div>
                    )}

                    {!loading && query.length > 0 && results.length === 0 && (
                        <CommandEmpty>No results found.</CommandEmpty>
                    )}

                    {!loading && results.length > 0 && (
                        <CommandGroup heading="Results">
                            {results.map((r) => (
                                <CommandItem
                                    key={r.symbol}
                                    value={`${r.symbol} ${r.shortname}`}
                                    onSelect={() => handleSelect(r)}
                                    className="flex items-center justify-between gap-2 cursor-pointer"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="font-semibold text-foreground shrink-0">
                                            {r.symbol}
                                        </span>
                                        <span className="text-sm text-muted-foreground truncate">
                                            {r.shortname}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <span className="text-[10px] text-muted-foreground/50">
                                            {r.exchange}
                                        </span>
                                        <Badge
                                            variant="outline"
                                            className={`text-[9px] px-1 py-0 ${typeColors[r.quoteType] ?? typeColors.EQUITY
                                                }`}
                                        >
                                            {r.quoteType}
                                        </Badge>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    )}

                    {!loading && !query && (
                        <CommandGroup heading="Quick Access">
                            {[
                                { symbol: "NQ=F", shortname: "Nasdaq 100 Futures", quoteType: "FUTURE", exchange: "CME" },
                                { symbol: "ES=F", shortname: "E-Mini S&P 500", quoteType: "FUTURE", exchange: "CME" },
                                { symbol: "AAPL", shortname: "Apple Inc.", quoteType: "EQUITY", exchange: "NMS" },
                                { symbol: "NVDA", shortname: "NVIDIA Corporation", quoteType: "EQUITY", exchange: "NMS" },
                                { symbol: "TSLA", shortname: "Tesla, Inc.", quoteType: "EQUITY", exchange: "NMS" },
                                { symbol: "SPY", shortname: "SPDR S&P 500 ETF", quoteType: "ETF", exchange: "PCX" },
                            ].map((r) => (
                                <CommandItem
                                    key={r.symbol}
                                    value={`${r.symbol} ${r.shortname}`}
                                    onSelect={() => handleSelect(r)}
                                    className="flex items-center justify-between gap-2 cursor-pointer"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-foreground">
                                            {r.symbol}
                                        </span>
                                        <span className="text-sm text-muted-foreground">
                                            {r.shortname}
                                        </span>
                                    </div>
                                    <Badge
                                        variant="outline"
                                        className={`text-[9px] px-1 py-0 ${typeColors[r.quoteType] ?? typeColors.EQUITY
                                            }`}
                                    >
                                        {r.quoteType}
                                    </Badge>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    )}
                </CommandList>
            </CommandDialog>
        </>
    );
}
