"use client";

import {
    LayoutDashboard,
    ListOrdered,
    Newspaper,
    SlidersHorizontal,
    Settings,
    PanelLeftClose,
    PanelLeftOpen,
    TrendingUp,
} from "lucide-react";
import { useAppStore } from "@/store/use-app-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/" },
    { icon: ListOrdered, label: "Watchlist", href: "#" },
    { icon: Newspaper, label: "News", href: "#" },
    { icon: SlidersHorizontal, label: "Screener", href: "#" },
    { icon: Settings, label: "Settings", href: "#" },
] as const;

/* ── Reusable Nav Links (used by both Sidebar and mobile Sheet) ─── */

export function SidebarNav({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
    return (
        <nav className="flex-1 space-y-1">
            {navItems.map(({ icon: Icon, label, href }) => (
                <a
                    key={label}
                    href={href}
                    onClick={onNavigate}
                    className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                        label === "Dashboard" && "bg-accent text-accent-foreground"
                    )}
                >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="whitespace-nowrap">{label}</span>}
                </a>
            ))}
        </nav>
    );
}

/* ── Desktop Sidebar ─────────────── */

export function Sidebar() {
    const collapsed = useAppStore((s) => s.sidebarCollapsed);
    const toggle = useAppStore((s) => s.toggleSidebar);

    return (
        <aside
            className={cn(
                "flex h-screen flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out",
                collapsed ? "w-16" : "w-56"
            )}
        >
            {/* Brand */}
            <div className="flex h-14 items-center gap-2 border-b border-border px-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
                    <TrendingUp className="h-4 w-4 text-primary-foreground" />
                </div>
                {!collapsed && (
                    <span className="text-sm font-bold tracking-tight text-foreground whitespace-nowrap">
                        MarketFlow
                    </span>
                )}
            </div>

            {/* Nav Links */}
            <div className="flex-1 px-2 py-3">
                <SidebarNav collapsed={collapsed} />
            </div>

            {/* Collapse Toggle */}
            <div className="border-t border-border p-2">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggle}
                    className="w-full justify-center"
                >
                    {collapsed ? (
                        <PanelLeftOpen className="h-4 w-4" />
                    ) : (
                        <PanelLeftClose className="h-4 w-4" />
                    )}
                </Button>
            </div>
        </aside>
    );
}
