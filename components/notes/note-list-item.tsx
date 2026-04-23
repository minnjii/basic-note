"use client";

import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
} from "@minnjii/dx-kit/ui/card";
import { Button } from "@minnjii/dx-kit/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@minnjii/dx-kit/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@minnjii/dx-kit/ui/alert-dialog";
import {
  Pin,
  PinOff,
  MoreHorizontal,
  FolderInput,
  Folder,
  Inbox,
  Check,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/components/providers/language-provider";
import type { DecryptedNote } from "@/hooks/use-notes";
import type { Category } from "@/lib/types";

interface NoteListItemProps {
  note: DecryptedNote;
  categories?: Category[];
  onMoveToCategory?: (noteId: string, categoryId: string | null) => void;
  onTogglePin?: (noteId: string) => void;
  onDelete?: (noteId: string) => Promise<void>;
}

export function NoteListItem({
  note,
  categories,
  onMoveToCategory,
  onTogglePin,
  onDelete,
}: NoteListItemProps) {
  const router = useRouter();
  const { t } = useLanguage();

  const handleDelete = async () => {
    if (!onDelete) return;
    await onDelete(note.id);
    toast.success(t("editor.deleted"));
  };

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  const hasMenu = onTogglePin || onMoveToCategory || onDelete;
  const folderName = note.categoryId
    ? categories?.find((c) => c.id === note.categoryId)?.name ?? t("editor.uncategorized")
    : t("editor.uncategorized");

  return (
    <Card
      className="transition-colors hover:bg-accent/50 cursor-pointer"
      onClick={() => router.push(`/notes/${note.id}`)}
    >
      <CardHeader>
        <div className="flex items-center gap-2">
          {note.pinned && (
            <Pin className="h-3.5 w-3.5 text-primary shrink-0" />
          )}
          <CardTitle className="text-base truncate">
            {note.decryptedTitle || t("notes.untitled")}
          </CardTitle>
        </div>
        <CardDescription className="line-clamp-1">
          {note.preview || t("notes.noContent")}
        </CardDescription>
        <CardAction>
          <div className="flex items-center gap-1.5">
            <div className="flex flex-col items-end gap-0.5 text-xs text-muted-foreground">
              <span className="shrink-0 max-w-[140px] truncate">{folderName}</span>
              <span className="shrink-0">{format(note.createdAt, "yyyy.MM.dd")}</span>
            </div>
            {hasMenu && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="xs"
                    className="h-7 w-7 p-0 text-muted-foreground"
                    onClick={stop}
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="min-w-[166px]"
                  onClick={stop}
                >
                  {onTogglePin && (
                    <DropdownMenuItem
                      onClick={() => {
                        onTogglePin(note.id);
                        toast.success(
                          note.pinned ? t("editor.unpinned") : t("editor.pinned")
                        );
                      }}
                    >
                      {note.pinned ? (
                        <>
                          <PinOff className="h-4 w-4" />
                          {t("editor.unpin")}
                        </>
                      ) : (
                        <>
                          <Pin className="h-4 w-4" />
                          {t("editor.pin")}
                        </>
                      )}
                    </DropdownMenuItem>
                  )}
                  {onMoveToCategory && categories && categories.length > 0 && (
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <FolderInput className="h-4 w-4" />
                        {t("editor.category")}
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuItem
                          onClick={() => {
                            onMoveToCategory(note.id, null);
                            toast.success(t("editor.movedUncategorized"));
                          }}
                          disabled={!note.categoryId}
                        >
                          <Inbox className="h-4 w-4" />
                          {t("editor.uncategorized")}
                          {!note.categoryId && (
                            <Check className="ml-auto h-3.5 w-3.5" />
                          )}
                        </DropdownMenuItem>
                        {categories.map((cat) => (
                          <DropdownMenuItem
                            key={cat.id}
                            onClick={() => {
                              onMoveToCategory(note.id, cat.id);
                              toast.success(
                                `"${cat.name}" ${t("editor.movedTo")}`
                              );
                            }}
                            disabled={note.categoryId === cat.id}
                          >
                            <Folder className="h-4 w-4" />
                            {cat.name}
                            {note.categoryId === cat.id && (
                              <Check className="ml-auto h-3.5 w-3.5" />
                            )}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  )}
                  {onDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <DropdownMenuItem
                            onSelect={(e) => e.preventDefault()}
                            variant="destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                            {t("editor.delete")}
                          </DropdownMenuItem>
                        </AlertDialogTrigger>
                        <AlertDialogContent onClick={stop}>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {t("editor.deleteTitle")}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {t("editor.deleteConfirm")}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>
                              {t("common.cancel")}
                            </AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete}>
                              {t("common.delete")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardAction>
      </CardHeader>
    </Card>
  );
}
