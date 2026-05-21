"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useCrypto } from "@/components/providers/crypto-provider";
import { useNotes } from "@/hooks/use-notes";
import { looksLikeCiphertext } from "@/lib/crypto";
import { isLockError } from "@/lib/decrypt-diagnostics";
import { PlainEditor, type PlainEditorHandle } from "@/components/editor/plain-editor";
import { NoteTitle } from "@/components/editor/note-title";
import { Button } from "@plus-experience/design-system/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@plus-experience/design-system/ui/popover";
import { Calendar } from "@plus-experience/design-system/ui/calendar";
import { ko, enUS } from "date-fns/locale";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuSeparator,
} from "@plus-experience/design-system/ui/dropdown-menu";
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
} from "@plus-experience/design-system/ui/alert-dialog";
import { useCategories } from "@/hooks/use-categories";
import { useLanguage } from "@/components/providers/language-provider";
import { ArrowLeft, MoreHorizontal, Trash2, Pin, PinOff, FolderInput, Folder, Inbox, Check, CalendarIcon, List, Bold, Italic, Underline, Strikethrough, Heading1, Heading2, Heading3, Type, ListOrdered, Link as LinkIcon, Highlighter } from "lucide-react";

export default function NoteEditorPage({
  params,
}: {
  params: Promise<{ noteId: string }>;
}) {
  const { noteId } = use(params);
  const router = useRouter();
  const { decryptText, isUnlocked } = useCrypto();
  const { updateNoteTitle, updateNoteDate, deleteNote, togglePin, moveToCategory } = useNotes();
  const { categories } = useCategories();
  const { t, language } = useLanguage();

  const [title, setTitle] = useState("");
  const titleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<PlainEditorHandle>(null);
  const [headingLevel, setHeadingLevel] = useState<1 | 2 | 3 | null>(null);

  const note = useLiveQuery(() => db.notes.get(noteId), [noteId]);

  // Decrypt title
  useEffect(() => {
    if (!note || !isUnlocked) return;
    decryptText(note.title)
      .then((text) => setTitle(looksLikeCiphertext(text) ? t("lock.decryptFail") : text))
      .catch((e) => {
        if (isLockError(e)) return; // transient lock — don't stick "(복호화 실패)" into state
        setTitle(t("lock.decryptFail"));
      });
  }, [note, isUnlocked, decryptText, t]);

  const handleTitleChange = useCallback(
    (newTitle: string) => {
      setTitle(newTitle);
      if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
      titleTimerRef.current = setTimeout(() => {
        updateNoteTitle(noteId, newTitle);
      }, 500);
    },
    [noteId, updateNoteTitle]
  );

  const handleDelete = useCallback(async () => {
    await deleteNote(noteId);
    toast.success(t("editor.deleted"));
    router.push("/notes");
  }, [noteId, deleteNote, router, t]);

  if (!note) {
    return (
      <div className="text-muted-foreground text-sm py-8">{t("lock.loading")}</div>
    );
  }

  return (
    <div className="max-w-3xl grid gap-6">
      {/* Toolbar: back | formatting (centered) | more */}
      <div className="relative flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-[15px] gap-0.5"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4" />
          {t("editor.back")}
        </Button>

        {/* Center: formatting toolbar. Absolute center so neighbor widths
            don't push it off balance. */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-0">
          <DropdownMenu
            onOpenChange={(open) => {
              if (open) {
                editorRef.current?.saveSelection();
                setHeadingLevel(editorRef.current?.getHeadingLevel() ?? null);
              }
            }}
          >
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="text-foreground h-8 w-8 p-0" aria-label="사이즈">
                <Type className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="center"
              className="min-w-[140px]"
              onCloseAutoFocus={(e) => {
                e.preventDefault();
                editorRef.current?.restoreSelection();
              }}
            >
              <DropdownMenuItem className="justify-between" onClick={() => { editorRef.current?.restoreSelection(); editorRef.current?.setHeading(1); }}>
                <span className="flex items-center gap-2"><Heading1 className="h-4 w-4" /> 제목 1</span>
                {headingLevel === 1 && <Check className="h-4 w-4" />}
              </DropdownMenuItem>
              <DropdownMenuItem className="justify-between" onClick={() => { editorRef.current?.restoreSelection(); editorRef.current?.setHeading(2); }}>
                <span className="flex items-center gap-2"><Heading2 className="h-4 w-4" /> 제목 2</span>
                {headingLevel === 2 && <Check className="h-4 w-4" />}
              </DropdownMenuItem>
              <DropdownMenuItem className="justify-between" onClick={() => { editorRef.current?.restoreSelection(); editorRef.current?.setHeading(3); }}>
                <span className="flex items-center gap-2"><Heading3 className="h-4 w-4" /> 제목 3</span>
                {headingLevel === 3 && <Check className="h-4 w-4" />}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="justify-between" onClick={() => { editorRef.current?.restoreSelection(); editorRef.current?.setHeading(null); }}>
                <span className="flex items-center gap-2"><Type className="h-4 w-4" /> 본문</span>
                {headingLevel === null && <Check className="h-4 w-4" />}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="sm" className="text-foreground h-8 w-8 p-0" onClick={() => editorRef.current?.toggleBulletAtCaret()} aria-label="불릿 리스트">
            <List className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-foreground h-8 w-8 p-0" onClick={() => editorRef.current?.execBold()} aria-label="Bold">
            <Bold className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-foreground h-8 w-8 p-0" onClick={() => editorRef.current?.execItalic()} aria-label="Italic">
            <Italic className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-foreground h-8 w-8 p-0" onClick={() => editorRef.current?.execUnderline()} aria-label="Underline">
            <Underline className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-foreground h-8 w-8 p-0" onClick={() => editorRef.current?.execStrikethrough()} aria-label="Strikethrough">
            <Strikethrough className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-foreground h-8 w-8 p-0" onClick={() => editorRef.current?.toggleHighlight()} aria-label="Highlight">
            <Highlighter className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-foreground h-8 w-8 p-0"
            onClick={() => {
              const handle = editorRef.current;
              if (!handle) return;
              if (handle.isLinkAtCaret()) {
                handle.unlinkAtCaret();
                return;
              }
              const url = window.prompt(t("editor.linkPrompt"), "https://");
              if (url === null) return;
              handle.createLink(url);
            }}
            aria-label="Link"
          >
            <LinkIcon className="h-4 w-4" />
          </Button>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="text-foreground translate-x-[13px]">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[166px]">
            <DropdownMenuItem onClick={() => {
              togglePin(noteId);
              toast.success(note.pinned ? t("editor.unpinned") : t("editor.pinned"));
            }}>
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
            {categories.length > 0 && (
              <>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <FolderInput className="h-4 w-4" />
                    {t("editor.category")}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem
                      onClick={() => {
                        moveToCategory(noteId, null);
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
                          moveToCategory(noteId, cat.id);
                          toast.success(`"${cat.name}" ${t("editor.movedTo")}`);
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
                <DropdownMenuSeparator />
              </>
            )}
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
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("editor.deleteTitle")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("editor.deleteConfirm")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>
                    {t("common.delete")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Category + Created date */}
      <div className="-mt-[9px] flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {categories.find((c) => c.id === note.categoryId)?.name ?? t("editor.uncategorized")}
        </span>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 text-muted-foreground translate-x-[13px]"
            >
              {format(note.createdAt, "yyyy.MM.dd")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={new Date(note.createdAt)}
              onSelect={(date) => {
                if (date) updateNoteDate(noteId, date.getTime());
              }}
              locale={language === "ko" ? ko : enUS}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Title */}
      <div className="-mt-[15px]">
        <NoteTitle
          title={title}
          onTitleChange={handleTitleChange}
          onEnter={() => {
            const all = document.querySelectorAll<HTMLElement>(
              "[contenteditable]"
            );
            if (all.length > 1) all[1].focus();
          }}
        />
      </div>

      {/* Editor */}
      <div className="-mt-[18px]">
        <PlainEditor ref={editorRef} noteId={noteId} />
      </div>
    </div>
  );
}
