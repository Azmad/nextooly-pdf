import React from 'react';
import { TextItem } from "@/lib/mupdf/edit-service";

interface EditTextOverlayProps {
  blocks: TextItem[];
  annotations: any[];
  onBlockClick: (block: TextItem) => void;
}

export const EditTextOverlay: React.FC<EditTextOverlayProps> = ({ blocks, annotations, onBlockClick }) => {
  return (
    <div className="text-layer">
      {blocks.map((block, i) => {
        const isAlreadyEdited = annotations.some(ann =>
          ann.type === "redact" &&
          ann.originalBounds &&
          Math.abs(ann.originalBounds.x - block.x) < 0.0001 &&
          Math.abs(ann.originalBounds.y - block.y) < 0.0001
        );

        if (isAlreadyEdited) return null;

        return (
          <div
            key={i}
            className="text-line-item"
            style={{
              left: `${block.x * 100}%`,
              top: `${block.y * 100}%`,
              width: `${block.width * 100}%`,
              height: `${block.height * 100}%`,
            }}
            onClick={(e) => {
              e.stopPropagation();
              onBlockClick(block);
            }}
          />
        );
      })}
    </div>
  );
};