"use client";

import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@plus-experience/design-system/ui/sidebar";
import { TooltipProvider } from "@plus-experience/design-system/ui/tooltip";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { GlobalNavTabs } from "@/components/layout/global-nav-tabs";
import { NotesCountProvider } from "@/components/providers/notes-count-provider";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TooltipProvider>
      {/* AppSidebar → CategoryTree reads note counts; it must sit under
          NotesCountProvider (same as the notes layout) or it throws. */}
      <NotesCountProvider>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <header className="flex h-14 shrink-0 items-center gap-2 px-6">
              <span className="contents md:hidden">
                <SidebarTrigger className="-ml-2 mt-[3px]" />
              </span>
              <GlobalNavTabs />
            </header>
            <main className="flex-1 overflow-auto px-6 pb-6 pt-[10px]">
              {children}
            </main>
          </SidebarInset>
        </SidebarProvider>
      </NotesCountProvider>
    </TooltipProvider>
  );
}
