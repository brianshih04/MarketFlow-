"use client";

import { Bell, User, Clock } from "lucide-react";
import { useAppStore } from "@/store/use-app-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SymbolSearch } from "@/components/features/symbol-search";
import { useEffect, useState } from "react";

function getMarketStatus(): "open" | "closed" | "pre-market" | "after-hours" {
    const now = new Date();
    const et = new Date(
        now.toLocaleString("en-US", { timeZone: "America/New_York" })
    );
    const day = et.getDay();
    const hours = et.getHours();
    const minutes = et.getMinutes();
    const time = hours * 60 + minutes;

    if (day === 0 || day === 6) return "closed";
    if (time >= 240 && time < 570) return "pre-market";
    if (time >= 570 && time < 960) return "open";
    if (time >= 960 && time < 1200) return "after-hours";
    return "closed";
}

const statusConfig = {
    open: { label: "Market Open", className: "bg-gain/20 text-gain border-gain/30" },
    closed: { label: "Market Closed", className: "bg-loss/20 text-loss border-loss/30" },
    "pre-market": { label: "Pre-Market", className: "bg-chart-3/20 text-chart-3 border-chart-3/30" },
    "after-hours": { label: "After-Hours", className: "bg-chart-4/20 text-chart-4 border-chart-4/30" },
};

function useETClock() {
    const [time, setTime] = useState("");

    useEffect(() => {
        function tick() {
            const now = new Date();
            setTime(
                now.toLocaleString("en-US", {
                    timeZone: "America/New_York",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    hour12: false,
                })
            );
        }
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, []);

    return time;
}

export function Header() {
    const marketStatus = useAppStore((s) => s.marketStatus);
    const setMarketStatus = useAppStore((s) => s.setMarketStatus);
    const etTime = useETClock();

    useEffect(() => {
        setMarketStatus(getMarketStatus());
        const interval = setInterval(() => {
            setMarketStatus(getMarketStatus());
        }, 60_000);
        return () => clearInterval(interval);
    }, [setMarketStatus]);

    const status = statusConfig[marketStatus];

    return (
        <>
            {/* Search */}
            <SymbolSearch />

            {/* Right side */}
            <div className="flex items-center gap-2 md:gap-3 shrink-0">
                {/* ET Clock — hidden on tiny screens */}
                <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span className="font-mono-num">{etTime}</span>
                    <span className="text-[10px]">ET</span>
                </div>

                <div className="hidden sm:block h-4 w-px bg-border" />

                <Badge variant="outline" className={`text-[10px] md:text-xs ${status.className}`}>
                    <span className="mr-1 md:mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                    <span className="hidden sm:inline">{status.label}</span>
                    <span className="sm:hidden">{marketStatus === "open" ? "Open" : "Closed"}</span>
                </Badge>

                <Button variant="ghost" size="icon" className="text-muted-foreground h-8 w-8">
                    <Bell className="h-4 w-4" />
                </Button>

                <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full bg-muted text-muted-foreground h-8 w-8"
                >
                    <User className="h-4 w-4" />
                </Button>
            </div>
        </>
    );
}
