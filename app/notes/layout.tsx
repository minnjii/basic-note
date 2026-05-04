"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@minnjii/dx-kit/ui/sidebar";
import { TooltipProvider } from "@minnjii/dx-kit/ui/tooltip";
import { Spinner } from "@minnjii/dx-kit/ui/spinner";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { cn } from "@minnjii/dx-kit/lib/utils";
import { FileText, Calendar, FolderTree } from "lucide-react";
import {
  GlobalLoadingProvider,
  useGlobalLoading,
} from "@/components/providers/global-loading";
import { NotesCountProvider } from "@/components/providers/notes-count-provider";

function HeaderLoadingIndicator() {
  const { isLoading } = useGlobalLoading();
  if (!isLoading) return null;
  return <Spinner className="h-4 w-4 text-muted-foreground" />;
}

const VIEW_TABS = [
  { href: "/notes", label: "모든 노트", icon: FileText },
  { href: "/notes/calendar", label: "캘린더", icon: Calendar },
  { href: "/notes/categories", label: "카테고리", icon: FolderTree },
] as const;

export default function NotesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const isTabActive = (href: string) => {
    if (href === "/notes") return pathname === "/notes";
    return pathname.startsWith(href);
  };

  return (
    <TooltipProvider>
      <GlobalLoadingProvider>
        <NotesCountProvider>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
              <header className="flex h-14 shrink-0 items-center gap-2 px-6">
                <SidebarTrigger className="md:hidden -ml-2" />
                <nav className="flex items-center gap-1 mt-0.5">
                  {VIEW_TABS.map((tab) => {
                    const active = isTabActive(tab.href);
                    return (
                      <Link
                        key={tab.href}
                        href={tab.href}
                        className={cn(
                          "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors",
                          active
                            ? "bg-secondary text-foreground font-medium"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                      >
                        <tab.icon className="h-4 w-4" />
                        <span className="hidden sm:inline">{tab.label}</span>
                      </Link>
                    );
                  })}
                </nav>
                <div className="ml-auto flex items-center">
                  <HeaderLoadingIndicator />
                </div>
              </header>
              <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-x-none overscroll-y-contain px-6 pb-6 pt-[10px]">
                {children}
              </main>
            </SidebarInset>
          </SidebarProvider>
        </NotesCountProvider>
      </GlobalLoadingProvider>
    </TooltipProvider>
  );
}
