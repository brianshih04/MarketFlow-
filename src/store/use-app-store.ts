import { create } from "zustand";

type MarketStatus = "open" | "closed" | "pre-market" | "after-hours";

interface AppState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  marketStatus: MarketStatus;
  setMarketStatus: (status: MarketStatus) => void;
  activeSymbol: string;
  activeSymbolName: string;
  setActiveSymbol: (symbol: string, name: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  marketStatus: "closed",
  setMarketStatus: (status) => set({ marketStatus: status }),
  activeSymbol: "NQ=F",
  activeSymbolName: "Nasdaq 100 Futures",
  setActiveSymbol: (symbol, name) =>
    set({ activeSymbol: symbol, activeSymbolName: name }),
}));
