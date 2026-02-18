"use client";

import { useState } from "react";
import { Menu, TrendingUp } from "lucide-react";
import { Sidebar, SidebarNav } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";

export function AppShell({ children }: { children: React.ReactNode }) {
    const [mobileNavOpen, setMobileNavOpen] = useState(false);

    return (
        <div className="flex h-screen overflow-hidden bg-background">
            {/* Desktop Sidebar — hidden on mobile */}
            <div className="hidden md:flex">
                <Sidebar />
            </div>

            <div className="flex flex-1 flex-col overflow-hidden">
                {/* Header with mobile hamburger */}
                <header className="flex h-14 items-center border-b border-border bg-background/80 backdrop-blur-md px-3 md:px-4 gap-2">
                    {/* Mobile Menu — hidden on desktop */}
                    <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                        <SheetTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="md:hidden shrink-0"
                            >
                                <Menu className="h-5 w-5" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="left" className="w-64 p-0">
                            <SheetHeader className="flex h-14 items-center gap-2 border-b border-border px-4 flex-row">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
                                    <TrendingUp className="h-4 w-4 text-primary-foreground" />
                                </div>
                                <SheetTitle className="text-sm font-bold tracking-tight">
                                    MarketFlow
                                </SheetTitle>
                            </SheetHeader>
                            <div className="py-3 px-2">
                                <SidebarNav onNavigate={() => setMobileNavOpen(false)} />
                            </div>
                        </SheetContent>
                    </Sheet>

                    {/* Header content — flex-1 fills remaining space */}
                    <div className="flex flex-1 items-center justify-between min-w-0">
                        <Header />
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-3 md:p-4">{children}</main>
            </div>
        </div>
    );
}
