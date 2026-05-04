"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@minnjii/dx-kit/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@minnjii/dx-kit/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@minnjii/dx-kit/ui/dropdown-menu";
import { Plus, FileText, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useNotes } from "@/hooks/use-notes";
import { useCategories } from "@/hooks/use-categories";
import { useNotesCount } from "@/components/providers/notes-count-provider";
import { useLoadingIndicator } from "@/components/providers/global-loading";
import { useLanguage } from "@/components/providers/language-provider";
import { CategoryDialog } from "@/components/dialogs/category-dialog";
import { NoteCard } from "./note-card";

interface NoteListProps {
  categoryId?: string | null;
  title?: string;
}

export function NoteList({
  categoryId,
  title,
}: NoteListProps) {
  const { t } = useLanguage();
  const displayTitle = title ?? t("nav.allNotes");
  const { notes, isLoading, createNote } = useNotes(categoryId);
  const headerCount = useNotesCount(categoryId);
  const { updateCategory, deleteCategoryWithNotes } = useCategories();
  useLoadingIndicator(`note-list:${categoryId ?? "all"}`, isLoading);
  const router = useRouter();
  const [showFirstConfirm, setShowFirstConfirm] = useState(false);
  const [showSecondConfirm, setShowSecondConfirm] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const handleCreate = async () => {
    const noteId = await createNote(categoryId ?? null);
    if (noteId) router.push(`/notes/${noteId}`);
  };

  const handleFirstConfirm = () => {
    setShowFirstConfirm(false);
    setShowSecondConfirm(true);
  };

  const handleDeleteCategory = async () => {
    if (!categoryId) return;
    await deleteCategoryWithNotes(categoryId);
    toast.success(t("notes.deletedCategory"));
    setShowSecondConfirm(false);
    router.push("/notes");
  };

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {displayTitle}
            {headerCount !== undefined && (
              <span className="text-[22px]"> ({headerCount})</span>
            )}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {categoryId && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[166px]">
                <DropdownMenuItem onClick={() => setEditOpen(true)}>
                  <Pencil className="h-4 w-4" />
                  {t("common.edit")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setShowFirstConfirm(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  {t("common.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4" />
            {t("notes.note")}
          </Button>
        </div>
      </div>

      {/* Edit Category Dialog */}
      {categoryId && (
        <CategoryDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          onSubmit={async (name) => {
            await updateCategory(categoryId, { name });
            toast.success(t("categoryDialog.updated"));
          }}
          defaultName={displayTitle}
          title={t("categoryDialog.editTitle")}
          description={t("categoryDialog.editDesc")}
        />
      )}

      {/* Delete: Step 1 */}
      <AlertDialog open={showFirstConfirm} onOpenChange={setShowFirstConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("notes.deleteCategory")}</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{displayTitle}&quot; {t("notes.deleteCategoryConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleFirstConfirm}>
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete: Step 2 */}
      <AlertDialog open={showSecondConfirm} onOpenChange={setShowSecondConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("notes.deleteCategoryFinal")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("notes.deleteCategoryWarn")} ({notes.length})
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCategory}>
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {!isLoading && (notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">{t("notes.empty")}</h3>
        </div>
      ) : (
        <div className="grid gap-3">
          {notes.map((note) => (
            <NoteCard key={note.id} note={note} />
          ))}
        </div>
      ))}
    </div>
  );
}
