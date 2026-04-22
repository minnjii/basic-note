"use client";

import { useRef, useEffect, useCallback } from "react";
import { Checkbox } from "@minnjii/dx-kit/ui/checkbox";
import type { BlockComponentProps } from "../block-types";

export function TodoBlock({
  content,
  indent,
  meta,
  onContentChange,
  onMetaChange,
  onKeyDown,
  onFocus,
  registerRef,
  isFocused,
}: BlockComponentProps) {
  const ref = useRef<HTMLDivElement>(null);
  const contentRef = useRef(content);
  const checked = meta.checked ?? false;

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  useEffect(() => {
    registerRef(ref.current);
  }, [registerRef]);

  useEffect(() => {
    if (!ref.current) return;
    if (document.activeElement === ref.current) return;
    if (ref.current.textContent !== content) {
      ref.current.textContent = content;
    }
  }, [content, isFocused]);

  useEffect(() => {
    if (isFocused && ref.current && document.activeElement !== ref.current) {
      ref.current.focus();
    }
  }, [isFocused]);

  const handleInput = useCallback(() => {
    if (ref.current) {
      onContentChange(ref.current.textContent ?? "");
    }
  }, [onContentChange]);

  const handleBlur = useCallback(() => {
    if (ref.current && ref.current.textContent !== contentRef.current) {
      ref.current.textContent = contentRef.current;
    }
  }, []);

  return (
    <div
      className="flex items-start gap-2.5"
      style={{ paddingLeft: `${indent * 1.5}rem` }}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={(val) => onMetaChange({ ...meta, checked: !!val })}
        className="mt-[0.2em] shrink-0"
      />
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        className={`outline-none min-h-[1.5em] leading-relaxed flex-1 ${
          checked
            ? "line-through text-muted-foreground/60"
            : "text-foreground"
        }`}
        onInput={handleInput}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onBlur={handleBlur}
        data-placeholder="할 일"
      />
    </div>
  );
}
