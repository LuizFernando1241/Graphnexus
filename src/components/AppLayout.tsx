import { Outlet } from "react-router-dom";
import { useState, useCallback } from "react";
import { Menu, Network } from "lucide-react";
import { useHotkeys } from "react-hotkeys-hook";
import { AppSidebar } from "./AppSidebar";
import { CommandPalette } from "./CommandPalette";
import { QuickAdd } from "./QuickAdd";
import { useTaskDueNotifications } from "@/hooks/useTaskDueNotifications";
import { useAutoTriage } from "@/hooks/useAutoTriage";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { MobileSidebarContent } from "./MobileSidebarContent";
import { NexusBot } from "./NexusBot/NexusBot";

export function AppLayout() {
  useTaskDueNotifications();
  useAutoTriage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const openQuickAdd = useCallback(() => setQuickAddOpen(true), []);

  useHotkeys("shift+n", (e) => {
    e.preventDefault();
    openQuickAdd();
  }, { enableOnFormTags: false });

  return (
    <div className="flex bg-background h-screen w-full overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <AppSidebar />
      </div>

      {/* Mobile top bar */}
      <div className="fixed top-0 left-0 right-0 z-40 flex md:hidden items-center h-[60px] px-4 gap-3 border-b border-border/50 bg-[hsl(var(--sidebar-background)/.8)] backdrop-blur-lg">
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded p-2.5 text-foreground hover:bg-accent min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Abrir menu de navegação"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
            <Network className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <span className="font-heading text-base font-bold text-foreground">NexusGraph</span>
        </div>
      </div>

      {/* Mobile sheet sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[260px] p-0 bg-[hsl(var(--sidebar-background))]">
          <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
          <MobileSidebarContent onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <main className="flex-1 overflow-auto p-4 md:p-6 pt-[76px] md:pt-6">
        <Outlet />
      </main>
      <CommandPalette />
      <QuickAdd externalOpen={quickAddOpen} onExternalOpenChange={setQuickAddOpen} />
      <NexusBot />
    </div>
  );
}
