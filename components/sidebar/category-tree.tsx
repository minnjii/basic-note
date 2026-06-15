"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuBadge,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@plus-experience/design-system/ui/sidebar";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@plus-experience/design-system/ui/collapsible";
import { Folder, ChevronRight, FileText } from "lucide-react";
import { useLanguage } from "@/components/providers/language-provider";
import { useCategories } from "@/hooks/use-categories";
import { useNotesCount } from "@/components/providers/notes-count-provider";
import type { CategoryTreeNode } from "@/lib/types";

function CategoryNode({ node, depth = 0 }: { node: CategoryTreeNode; depth?: number }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const isActive = pathname === `/notes/categories/${node.id}`;
  const hasChildren = node.children.length > 0;

  if (hasChildren) {
    return (
      <Collapsible asChild>
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton tooltip={node.name}>
              <ChevronRight className="h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
              <span>{node.name}</span>
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <SidebarMenuBadge className="justify-end">{node.noteCount}</SidebarMenuBadge>
          <CollapsibleContent>
            <SidebarMenuSub>
              {/* Link to this category's notes */}
              <SidebarMenuSubItem>
                <SidebarMenuSubButton asChild isActive={isActive}>
                  <Link href={`/notes/categories/${node.id}`}>
                    <span>{t("categories.allNotes")}</span>
                    <span className="ml-auto text-muted-foreground tabular-nums">
                      {node.noteCount}
                    </span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
              {node.children.map((child) => (
                <SidebarMenuSubItem key={child.id}>
                  <SidebarMenuSubButton
                    asChild
                    isActive={pathname === `/notes/categories/${child.id}`}
                  >
                    <Link href={`/notes/categories/${child.id}`}>
                      <span>{child.name}</span>
                      <span className="ml-auto text-muted-foreground tabular-nums">
                        {child.noteCount}
                      </span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} tooltip={node.name}>
        <Link href={`/notes/categories/${node.id}`}>
          <Folder className="h-4 w-4" />
          <span>{node.name}</span>
        </Link>
      </SidebarMenuButton>
      <SidebarMenuBadge className="justify-end">{node.noteCount}</SidebarMenuBadge>
    </SidebarMenuItem>
  );
}

// Notes with no category. Distinct from a real folder: muted, FileText icon,
// and only rendered when non-empty (an empty uncategorized bucket is noise).
function UncategorizedItem() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const count = useNotesCount(null);

  if (!count) return null;

  const isActive = pathname === "/notes/categories/uncategorized";

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        tooltip={t("categories.uncategorized")}
        className="text-muted-foreground"
      >
        <Link href="/notes/categories/uncategorized">
          <FileText className="h-4 w-4" />
          <span>{t("categories.uncategorized")}</span>
        </Link>
      </SidebarMenuButton>
      <SidebarMenuBadge className="justify-end">{count}</SidebarMenuBadge>
    </SidebarMenuItem>
  );
}

export function CategoryTree() {
  const { tree } = useCategories();
  const { t } = useLanguage();
  const uncategorizedCount = useNotesCount(null);

  if (tree.length === 0 && !uncategorizedCount) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton disabled tooltip={t("nav.noCategories")}>
            <Folder className="h-4 w-4 opacity-50" />
            <span className="text-muted-foreground text-sm">{t("nav.noCategories")}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <SidebarMenu>
      {tree.map((node) => (
        <CategoryNode key={node.id} node={node} />
      ))}
      <UncategorizedItem />
    </SidebarMenu>
  );
}
