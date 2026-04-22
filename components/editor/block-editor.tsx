"use client";

import { useCallback, useRef, useState, useMemo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus } from "lucide-react";
import { useBlocks, type DecryptedBlock } from "@/hooks/use-blocks";
import { BlockRenderer } from "./block-renderer";
import { SlashCommandMenu } from "./slash-command-menu";
import { MobileBlockMenu } from "./mobile-block-menu";
import { MAX_INDENT } from "@/lib/constants";
import type { BlockType, BlockMeta } from "@/lib/types";

/** Caret offset (character count) within an element, using the current Selection. */
function getCaretOffset(el: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return 0;
  const range = sel.getRangeAt(0);
  if (!el.contains(range.endContainer)) return 0;
  const pre = range.cloneRange();
  pre.selectNodeContents(el);
  pre.setEnd(range.endContainer, range.endOffset);
  return pre.toString().length;
}

/** Cross-browser caretRangeFromPoint */
function caretRangeAt(x: number, y: number): Range | null {
  const d = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  if (d.caretPositionFromPoint) {
    const pos = d.caretPositionFromPoint(x, y);
    if (pos) {
      const r = document.createRange();
      r.setStart(pos.offsetNode, pos.offset);
      r.collapse(true);
      return r;
    }
  }
  if (d.caretRangeFromPoint) return d.caretRangeFromPoint(x, y);
  return null;
}

interface BlockEditorProps {
  noteId: string;
}

function SortableBlock({
  block,
  index,
  focusedIndex,
  numberedCounter,
  onContentChange,
  onMetaChange,
  onKeyDown,
  onFocus,
  registerRef,
}: {
  block: DecryptedBlock;
  index: number;
  focusedIndex: number;
  numberedCounter: number;
  onContentChange: (blockId: string, content: string) => void;
  onMetaChange: (blockId: string, meta: BlockMeta) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>, index: number) => void;
  onFocus: (index: number) => void;
  registerRef: (index: number, el: HTMLElement | null) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative flex items-start gap-1"
    >
      <div
        className="flex shrink-0 items-center pt-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground/50" />
      </div>
      <div className="flex-1 min-w-0">
        <BlockRenderer
          type={block.type}
          id={block.id}
          content={block.decryptedContent}
          indent={block.indent}
          meta={block.meta}
          number={numberedCounter}
          isFocused={focusedIndex === index}
          onContentChange={(content) => onContentChange(block.id, content)}
          onMetaChange={(meta) => onMetaChange(block.id, meta)}
          onKeyDown={(e) => onKeyDown(e, index)}
          onFocus={() => onFocus(index)}
          registerRef={(el) => registerRef(index, el)}
        />
      </div>
    </div>
  );
}

export function BlockEditor({ noteId }: BlockEditorProps) {
  const { blocks, createBlock, updateBlock, deleteBlock, reorderBlock } =
    useBlocks(noteId);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [slashMenu, setSlashMenu] = useState<{
    open: boolean;
    position: { top: number; left: number };
    blockIndex: number;
  }>({ open: false, position: { top: 0, left: 0 }, blockIndex: -1 });

  const blockRefs = useRef<Map<number, HTMLElement>>(new Map());
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  /** Sticky column X (viewport) for vertical cursor nav. Reset on horizontal move/click/type. */
  const stickyXRef = useRef<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  // Compute numbered counters
  const numberedCounters = useMemo(() => {
    const counters: number[] = [];
    let count = 0;
    for (const block of blocks) {
      if (block.type === "numbered") {
        count++;
        counters.push(count);
      } else {
        count = 0;
        counters.push(0);
      }
    }
    return counters;
  }, [blocks]);

  // Stable `items` array for SortableContext so dnd-kit doesn't re-register
  // every useSortable child on every parent render.
  const sortableItems = useMemo(() => blocks.map((b) => b.id), [blocks]);

  const registerRef = useCallback(
    (index: number, el: HTMLElement | null) => {
      if (el) {
        blockRefs.current.set(index, el);
      } else {
        blockRefs.current.delete(index);
      }
    },
    []
  );

  const focusBlock = useCallback(
    (index: number, placeAtEnd = false, targetX?: number) => {
      setFocusedIndex(index);
      requestAnimationFrame(() => {
        const el = blockRefs.current.get(index);
        if (!el) return;
        el.focus();

        // If we have a target X coordinate, try to preserve the column
        if (typeof targetX === "number") {
          const elRect = el.getBoundingClientRect();
          const lineH = parseFloat(getComputedStyle(el).lineHeight) || 24;
          const y = placeAtEnd
            ? elRect.bottom - lineH / 2
            : elRect.top + lineH / 2;
          const range = caretRangeAt(targetX, y);
          if (range) {
            const sel = window.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(range);
            return;
          }
        }

        try {
          const range = document.createRange();
          const sel = window.getSelection();
          range.selectNodeContents(el);
          range.collapse(!placeAtEnd);
          sel?.removeAllRanges();
          sel?.addRange(range);
        } catch {}
      });
    },
    []
  );

  const handleContentChange = useCallback(
    (blockId: string, content: string) => {
      // Detect "/" typed at the start → open slash menu
      const blockIndex = blocks.findIndex((b) => b.id === blockId);
      if (content === "/") {
        const el = blockRefs.current.get(blockIndex);
        if (el) {
          const rect = el.getBoundingClientRect();
          setSlashMenu({
            open: true,
            position: { top: rect.bottom + 4, left: rect.left },
            blockIndex,
          });
        }
        return; // Don't save the "/" yet
      }

      // If slash menu is open and content no longer starts with "/", close it
      if (slashMenu.open && !content.startsWith("/")) {
        setSlashMenu({ open: false, position: { top: 0, left: 0 }, blockIndex: -1 });
      }

      // Debounced save
      const existing = saveTimers.current.get(blockId);
      if (existing) clearTimeout(existing);
      saveTimers.current.set(
        blockId,
        setTimeout(() => {
          updateBlock(blockId, { content });
          saveTimers.current.delete(blockId);
        }, 400)
      );
    },
    [updateBlock, blocks, slashMenu.open]
  );

  const handleMetaChange = useCallback(
    (blockId: string, meta: BlockMeta) => {
      updateBlock(blockId, { meta });
    },
    [updateBlock]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>, index: number) => {
      const block = blocks[index];
      if (!block) return;

      // Any non-vertical key breaks the sticky column
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") {
        stickyXRef.current = null;
      }

      // Get actual DOM content (not debounced state)
      const el = blockRefs.current.get(index);
      const liveContent = el?.textContent?.trim() ?? block.decryptedContent;

      // Enter — create new block below
      if (e.key === "Enter" && !e.shiftKey) {
        if (block.type === "code") return; // Allow newlines in code blocks
        e.preventDefault();
        // During IME composition Enter commits the composition; skip the
        // "create block" action (the post-commit Enter fires it as a separate event)
        if (e.nativeEvent.isComposing || e.keyCode === 229) return;

        // If current block is an empty list-type, convert to text
        if (
          liveContent === "" &&
          ["bullet", "numbered", "todo"].includes(block.type)
        ) {
          updateBlock(block.id, { type: "text", indent: 0 });
          return;
        }

        // Split current block at the caret: everything before stays, everything after moves to new block
        const caret = el ? getCaretOffset(el) : liveContent.length;
        const before = liveContent.slice(0, caret);
        const after = liveContent.slice(caret);

        const existing = saveTimers.current.get(block.id);
        if (existing) clearTimeout(existing);
        saveTimers.current.delete(block.id);
        updateBlock(block.id, { content: before });
        // Do NOT overwrite el.textContent here — that collapses the caret to
        // position 0 and the user sees it jump before the new block takes over.
        // Block components resync DOM to `content` on blur via the isFocused dep.

        const newType: BlockType =
          ["bullet", "numbered", "todo"].includes(block.type)
            ? block.type
            : "text";
        const newMeta: BlockMeta =
          block.type === "todo" ? { checked: false } : {};

        const newId = createBlock(block.id, newType, after, newMeta);
        if (newId) focusBlock(index + 1, false);
        return;
      }

      // Backspace at caret position 0 of a non-empty block → merge this
      // block's content into the end of the previous block.
      // DOM/focus/caret are all done synchronously within this keydown for
      // instant feel; DB writes run in the background.
      if (e.key === "Backspace" && index > 0 && liveContent !== "") {
        if (e.nativeEvent.isComposing || e.keyCode === 229) return;
        const sel = window.getSelection();
        const collapsed = sel?.isCollapsed ?? true;
        const caret = el ? getCaretOffset(el) : -1;
        if (caret === 0 && collapsed) {
          e.preventDefault();
          const prev = blocks[index - 1];
          if (!prev) return;
          const prevEl = blockRefs.current.get(index - 1);
          if (!prevEl) return;

          const prevContent = prevEl.textContent ?? prev.decryptedContent;
          const joinPos = prevContent.length;
          const merged = prevContent + liveContent;

          for (const bid of [block.id, prev.id]) {
            const pending = saveTimers.current.get(bid);
            if (pending) {
              clearTimeout(pending);
              saveTimers.current.delete(bid);
            }
          }

          // Synchronous: update prev DOM, move focus, place caret at join.
          prevEl.textContent = merged;
          prevEl.focus();
          try {
            const range = document.createRange();
            const textNode = prevEl.firstChild ?? prevEl;
            const maxLen = (textNode.textContent ?? "").length;
            range.setStart(textNode, Math.min(joinPos, maxLen));
            range.collapse(true);
            const selection = window.getSelection();
            selection?.removeAllRanges();
            selection?.addRange(range);
          } catch {}

          setFocusedIndex(index - 1);

          // Fire-and-forget DB writes; UI already reflects the merged state.
          updateBlock(prev.id, { content: merged });
          deleteBlock(block.id);
          return;
        }
      }

      // Backspace on empty block — delete or convert
      if (e.key === "Backspace" && liveContent === "") {
        if (block.type !== "text") {
          e.preventDefault();
          // Cancel any pending debounced save — its captured content would
          // otherwise race with this type conversion and briefly resurrect
          // the just-deleted text after the block re-renders as Text.
          const pending = saveTimers.current.get(block.id);
          if (pending) {
            clearTimeout(pending);
            saveTimers.current.delete(block.id);
          }
          updateBlock(block.id, { type: "text", indent: 0, content: "" });
          return;
        }
        if (blocks.length > 1) {
          e.preventDefault();
          const pending = saveTimers.current.get(block.id);
          if (pending) {
            clearTimeout(pending);
            saveTimers.current.delete(block.id);
          }
          deleteBlock(block.id);
          focusBlock(Math.max(0, index - 1), true);
          return;
        }
      }

      // Tab — indent
      if (e.key === "Tab" && !e.shiftKey && block.type !== "code") {
        e.preventDefault();
        if (block.indent < MAX_INDENT) {
          updateBlock(block.id, { indent: block.indent + 1 });
        }
        return;
      }

      // Shift+Tab — outdent
      if (e.key === "Tab" && e.shiftKey) {
        e.preventDefault();
        if (block.indent > 0) {
          updateBlock(block.id, { indent: block.indent - 1 });
        }
        return;
      }

      // Arrow Up — focus previous, preserving column
      if (e.key === "ArrowUp" && index > 0) {
        // Let IME commit first; otherwise the in-progress jamo jumps to the target block
        if (e.nativeEvent.isComposing || e.keyCode === 229) return;
        const sel = window.getSelection();
        const el = e.target as HTMLElement;
        if (!sel || sel.rangeCount === 0) return;
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const lineH = parseFloat(getComputedStyle(el).lineHeight) || 24;
        const isEmpty = !el.textContent;
        const onFirstLine =
          rect.height === 0 || rect.top - elRect.top < lineH;
        if (isEmpty || onFirstLine) {
          e.preventDefault();
          if (stickyXRef.current === null) {
            stickyXRef.current = rect.left || elRect.left;
          }
          focusBlock(index - 1, true, stickyXRef.current);
        }
        return;
      }

      // Arrow Down — focus next, preserving column
      if (e.key === "ArrowDown" && index < blocks.length - 1) {
        if (e.nativeEvent.isComposing || e.keyCode === 229) return;
        const sel = window.getSelection();
        const el = e.target as HTMLElement;
        if (!sel || sel.rangeCount === 0) return;
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const lineH = parseFloat(getComputedStyle(el).lineHeight) || 24;
        const isEmpty = !el.textContent;
        const onLastLine =
          rect.height === 0 || elRect.bottom - rect.bottom < lineH;
        if (isEmpty || onLastLine) {
          e.preventDefault();
          if (stickyXRef.current === null) {
            stickyXRef.current = rect.left || elRect.left;
          }
          focusBlock(index + 1, false, stickyXRef.current);
        }
        return;
      }
    },
    [blocks, createBlock, updateBlock, deleteBlock, focusBlock]
  );

  const handleSlashSelect = useCallback(
    (type: BlockType) => {
      const { blockIndex } = slashMenu;
      const block = blocks[blockIndex];
      if (block) {
        const meta: BlockMeta =
          type === "heading"
            ? { level: 1 }
            : type === "todo"
              ? { checked: false }
              : {};
        // Clear the "/" and convert block type
        updateBlock(block.id, { type, content: "", meta });
        // Also clear the contentEditable visually
        const el = blockRefs.current.get(blockIndex);
        if (el) el.textContent = "";
      }
      setSlashMenu({ open: false, position: { top: 0, left: 0 }, blockIndex: -1 });
      focusBlock(blockIndex);
    },
    [blocks, slashMenu, updateBlock, focusBlock]
  );

  const handleMobileBlockSelect = useCallback(
    async (type: BlockType) => {
      const anchor = blocks[focusedIndex] ?? blocks[blocks.length - 1];
      const meta: BlockMeta =
        type === "heading"
          ? { level: 1 }
          : type === "todo"
            ? { checked: false }
            : {};
      const newId = createBlock(anchor?.id ?? null, type, "", meta);
      if (newId) {
        const newIdx = Math.min(blocks.length, focusedIndex + 1);
        focusBlock(newIdx);
      }
    },
    [blocks, focusedIndex, createBlock, focusBlock]
  );

  const handleSlashClose = useCallback(() => {
    setSlashMenu({ open: false, position: { top: 0, left: 0 }, blockIndex: -1 });
    // "/" stays in the block as normal text — user wanted to type "/"
    const { blockIndex } = slashMenu;
    if (blockIndex >= 0) {
      const block = blocks[blockIndex];
      if (block) {
        // Save the "/" as actual content
        updateBlock(block.id, { content: "/" });
      }
      focusBlock(blockIndex);
    }
  }, [slashMenu, blocks, updateBlock, focusBlock]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = blocks.findIndex((b) => b.id === active.id);
      const newIndex = blocks.findIndex((b) => b.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const beforeOrder = newIndex > 0 ? blocks[newIndex - 1 >= oldIndex ? newIndex : newIndex - 1].sortOrder : null;
      const afterOrder =
        newIndex < blocks.length - 1
          ? blocks[newIndex <= oldIndex ? newIndex : newIndex + 1]?.sortOrder ?? null
          : null;

      // More precise: place between the target's neighbors
      let before: string | null = null;
      let after: string | null = null;

      if (newIndex < oldIndex) {
        // Moving up
        before = newIndex > 0 ? blocks[newIndex - 1].sortOrder : null;
        after = blocks[newIndex].sortOrder;
      } else {
        // Moving down
        before = blocks[newIndex].sortOrder;
        after = newIndex + 1 < blocks.length ? blocks[newIndex + 1].sortOrder : null;
      }

      reorderBlock(active.id as string, before, after);
    },
    [blocks, reorderBlock]
  );

  if (blocks.length === 0) {
    return (
      <div className="text-muted-foreground text-sm py-4">
        로딩 중...
      </div>
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sortableItems}
          strategy={verticalListSortingStrategy}
        >
          <div
            className="grid gap-1"
            onPointerDown={() => {
              stickyXRef.current = null;
            }}
          >
            {blocks.map((block, index) => (
              <SortableBlock
                key={block.id}
                block={block}
                index={index}
                focusedIndex={focusedIndex}
                numberedCounter={numberedCounters[index]}
                onContentChange={handleContentChange}
                onMetaChange={handleMetaChange}
                onKeyDown={handleKeyDown}
                onFocus={setFocusedIndex}
                registerRef={registerRef}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <SlashCommandMenu
        open={slashMenu.open}
        position={slashMenu.position}
        onSelect={handleSlashSelect}
        onClose={handleSlashClose}
      />

      <MobileBlockMenu
        open={mobileMenuOpen}
        onOpenChange={setMobileMenuOpen}
        onSelect={handleMobileBlockSelect}
      />

      <button
        type="button"
        aria-label="Add block"
        onClick={() => setMobileMenuOpen(true)}
        className="md:hidden fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-black/30 active:scale-95 transition-transform"
      >
        <Plus className="h-5 w-5" />
      </button>
    </>
  );
}
