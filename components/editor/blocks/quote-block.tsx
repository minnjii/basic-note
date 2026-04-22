"use client";

import { useRef, useEffect, useCallback } from "react";
import type { BlockComponentProps } from "../block-types";

export function QuoteBlock({
  content,
  indent,
  onContentChange,
  onKeyDown,
  onFocus,
  registerRef,
  isFocused,
}: BlockComponentProps) {
  const ref = useRef<HTMLDivElement>(null);
  const contentRef = useRef(content);

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
      className="flex items-stretch"
      style={{ paddingLeft: `${indent * 1.5}rem` }}
    >
      <div className="w-1 shrink-0 rounded-full bg-primary/40 mr-3" />
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        className="outline-none min-h-[1.5em] leading-relaxed text-muted-foreground italic flex-1"
        onInput={handleInput}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onBlur={handleBlur}
        data-placeholder="인용문"
      />
    </div>
  );
}
