import React from 'react';
import { TextItem } from "@/lib/mupdf/edit-service";
import { Annotation } from "@/app/pdf-edit/types";

interface EditTextOverlayProps {
  blocks: TextItem[];
  annotations: Annotation[];
  onBlockClick: (block: TextItem) => void;
}

const getIntersectionArea = (
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
) => {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);

  if (right <= left || bottom <= top) return 0;
  return (right - left) * (bottom - top);
};

const containsBlockCenter = (
  region: { x: number; y: number; width: number; height: number },
  block: TextItem
) => {
  const centerX = block.x + (block.width / 2);
  const centerY = block.y + (block.height / 2);
  return (
    centerX >= region.x &&
    centerX <= region.x + region.width &&
    centerY >= region.y &&
    centerY <= region.y + region.height
  );
};

export const EditTextOverlay: React.FC<EditTextOverlayProps> = ({ blocks, annotations, onBlockClick }) => {
  const editedGroupIds = new Set(
    annotations
      .filter((ann) => ann.type === "text_edit" && !!ann.groupId)
      .map((ann) => ann.groupId as string)
  );

  const editedSourceRegions = annotations.flatMap((ann) => {
    if (ann.type === "text_edit" && ann.originalBounds) {
      return [ann.originalBounds];
    }

    if (ann.type === "redact" && ann.groupId && editedGroupIds.has(ann.groupId) && ann.originalBounds) {
      return [ann.originalBounds];
    }

    return [];
  });

  return (
    <div className="text-layer">
      {blocks.map((block, i) => {
        const blockArea = Math.max(block.width * block.height, 0.000001);
        const isAlreadyEdited = editedSourceRegions.some((region) => {
          const overlapRatio = getIntersectionArea(region, block) / blockArea;
          return overlapRatio >= 0.6 || containsBlockCenter(region, block);
        });

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
