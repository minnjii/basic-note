"use client";

import { use } from "react";
import { useCategories } from "@/hooks/use-categories";
import { NoteList } from "@/components/notes/note-list";

export default function CategoryNotesPage({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}) {
  const { categoryId } = use(params);
  const { categories } = useCategories();

  const category = categories.find((c) => c.id === categoryId);
  // Empty fallback (not "카테고리") so the title doesn't flash a placeholder
  // word before async decrypt resolves. NoteList renders the empty title slot
  // gracefully and the real name fades in on the next render.
  const title = category ? category.name : "";

  return (
    <NoteList
      categoryId={categoryId}
      title={title}
    />
  );
}
