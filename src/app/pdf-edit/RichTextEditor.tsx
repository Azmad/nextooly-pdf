import React, { useEffect, useRef } from "react";

interface RichTextEditorProps {
  htmlContent: string;
  onChange: (html: string) => void;
  style: React.CSSProperties;
  className?: string;
  isSelected: boolean;
}

export const RichTextEditor = ({
  htmlContent,
  onChange,
  style,
  className,
  isSelected
}: RichTextEditorProps) => {
  const contentEditableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentEditableRef.current && contentEditableRef.current.innerHTML !== htmlContent) {
      if (document.activeElement !== contentEditableRef.current) {
        contentEditableRef.current.innerHTML = htmlContent;
      }
    }
  }, [htmlContent]);

  return (
    <div
      ref={contentEditableRef}
      className={className}
      style={{ ...style, outline: "none", cursor: "text" }}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      onInput={(e) => onChange(e.currentTarget.innerHTML)}
      onBlur={(e) => onChange(e.currentTarget.innerHTML)}
      onClick={(e) => {
        e.stopPropagation();
        e.currentTarget.focus();
      }}
    />
  );
};