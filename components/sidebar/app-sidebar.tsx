"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
} from "@minnjii/dx-kit/ui/sidebar";
import {
  FileText,
  Calendar,
  FolderTree,
  Settings,
  Lock,
  Plus,
} from "lucide-react";
import { useCrypto } from "@/components/providers/crypto-provider";
import { useCategories } from "@/hooks/use-categories";
import { CategoryTree } from "./category-tree";
import { CategoryDialog } from "@/components/dialogs/category-dialog";

const NAV_ITEMS = [
  { href: "/notes", label: "모든 노트", icon: FileText },
  { href: "/notes/calendar", label: "캘린더", icon: Calendar },
  { href: "/notes/categories", label: "카테고리", icon: FolderTree },
] as const;

export function AppSidebar() {
  const pathname = usePathname();
  const { lock } = useCrypto();
  const { createCategory } = useCategories();
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);

  return (
    <>
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/notes">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <FileText className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold tracking-tight">
                    just note
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    개인 보안 노트
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>탐색</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                    tooltip={item.label}
                  >
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        {/* Categories */}
        <SidebarGroup>
          <SidebarGroupLabel>카테고리</SidebarGroupLabel>
          <SidebarGroupAction
            title="카테고리 추가"
            onClick={() => setCategoryDialogOpen(true)}
          >
            <Plus />
          </SidebarGroupAction>
          <SidebarGroupContent>
            <CategoryTree />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="설정">
              <Link href="/settings">
                <Settings />
                <span>설정</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={lock} tooltip="잠금">
              <Lock />
              <span>잠금</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>

    <CategoryDialog
      open={categoryDialogOpen}
      onOpenChange={setCategoryDialogOpen}
      onSubmit={async (name) => {
        await createCategory(name);
      }}
    />
    </>
  );
}
