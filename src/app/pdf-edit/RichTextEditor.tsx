import React, { useCallback, useEffect, useRef } from "react";

interface RichTextEditorProps {
  htmlContent: string;
  onChange: (html: string) => void;
  style: React.CSSProperties;
  className?: string;
  autoFocus?: boolean;
  sanitizeHtml?: (html: string) => string;
}

export const RichTextEditor = ({
  htmlContent,
  onChange,
  style,
  className,
  autoFocus = false,
  sanitizeHtml,
}: RichTextEditorProps) => {
  const contentEditableRef = useRef<HTMLDivElement>(null);
  const normalizeHtml = useCallback(
    (html: string) => sanitizeHtml ? sanitizeHtml(html) : html,
    [sanitizeHtml]
  );

  useEffect(() => {
    const normalizedHtml = normalizeHtml(htmlContent);
    if (contentEditableRef.current && contentEditableRef.current.innerHTML !== normalizedHtml) {
      if (document.activeElement !== contentEditableRef.current) {
        contentEditableRef.current.innerHTML = normalizedHtml;
      }
    }
  }, [htmlContent, normalizeHtml]);

  useEffect(() => {
    if (!autoFocus || !contentEditableRef.current) return;
    const el = contentEditableRef.current;
    // Small delay so the element is fully painted before we grab focus
    const raf = requestAnimationFrame(() => {
      el.focus();
      // Place cursor at the end of the content
      const range = document.createRange();
      const sel = window.getSelection();
      if (sel) {
        range.selectNodeContents(el);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [autoFocus]);

  const emitChange = (html: string) => {
    onChange(normalizeHtml(html));
  };

  return (
    <div
      ref={contentEditableRef}
      className={className}
      style={{ ...style, outline: "none", cursor: "text" }}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      onInput={(e) => emitChange(e.currentTarget.innerHTML)}
      onBlur={(e) => {
        const cleanHtml = normalizeHtml(e.currentTarget.innerHTML);
        if (e.currentTarget.innerHTML !== cleanHtml) {
          e.currentTarget.innerHTML = cleanHtml;
        }
        onChange(cleanHtml);
      }}
      onPaste={(e) => {
        e.preventDefault();
        const pastedText = e.clipboardData.getData("text/plain");
        document.execCommand("insertText", false, pastedText);
        requestAnimationFrame(() => {
          if (contentEditableRef.current) {
            emitChange(contentEditableRef.current.innerHTML);
          }
        });
      }}
      onClick={(e) => {
        e.stopPropagation();
        e.currentTarget.focus();
      }}
    />
  );
};
