//
import { TextItem } from '@/lib/mupdf/edit-service'; 

export const clusterBlocks = (rawItems: TextItem[]): TextItem[] => {
  if (!rawItems || rawItems.length === 0) return [];

  // 1. Sort primarily by Y (Vertical), then X (Horizontal)
  const sorted = [...rawItems].sort((a, b) => {
    // Safety: Handle cases where pageIndex might be undefined
    const pA = (a as any).pageIndex || 0;
    const pB = (b as any).pageIndex || 0;
    if (pA !== pB) return pA - pB;
    
    // RELAXED SORTING:
    // Ensure "Label" and "Value" are compared as neighbors even if slightly misaligned.
    const yDiff = Math.abs(a.y - b.y);
    if (yDiff < (a.height * 0.5)) {
      return a.x - b.x;
    }
    return a.y - b.y;
  });

  const merged: TextItem[] = [];
  let current = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];

    // --- 1. BASIC COMPATIBILITY CHECKS ---
    // Cast to any to safely check pageIndex if it's missing from your type definition
    const samePage = ((current as any).pageIndex || 0) === ((next as any).pageIndex || 0);
    const sameSize = Math.abs(current.fontSize - next.fontSize) < 1.0; 
    const sameFont = current.fontName === next.fontName;

    // FIX: Color & Style Consistency
    const sameColor = current.color === next.color;
    const sameStyle = !!current.isBold === !!next.isBold;

    // --- 2. GEOMETRY CHECKS ---
    const verticalGap = next.y - (current.y + current.height);
    const horizontalGap = next.x - (current.x + current.width);
    
    // A. Horizontal Flow (Same Line)
    const isSameLine = Math.abs(current.y - next.y) < (current.height * 0.5);
    // Strict gap check (approx 1/3rd letter width) to keep columns separate
    const isWordGap = horizontalGap > -0.05 && horizontalGap < (current.height * 0.35);
    
    const isFlowing = isSameLine && isWordGap;

    // B. Vertical Stack (Paragraphs)
    const isBelow = verticalGap > -(current.height * 0.2) && verticalGap < (current.height * 1.5);
    const isAligned = Math.abs(current.x - next.x) < 0.02; 
    
    const isStacked = isBelow && isAligned;

    // --- 3. DECISION ---
    if (samePage && sameSize && sameFont && sameColor && sameStyle && (isFlowing || isStacked)) {
      // MERGE: Combine into one block
      const newX = Math.min(current.x, next.x);
      const newY = Math.min(current.y, next.y);
      const newMaxX = Math.max(current.x + current.width, next.x + next.width);
      const newMaxY = Math.max(current.y + current.height, next.y + next.height);
      
      const separator = isFlowing ? " " : "\n";

      current = {
        ...current, // <--- THIS LINE preserves all other properties (Color, Bold, Font, etc.)
        x: newX,
        y: newY,
        width: newMaxX - newX,
        height: newMaxY - newY,
        text: current.text + separator + next.text,
      };
    } else {
      // SPLIT: Push the completed block and start a new one
      merged.push(current);
      current = next;
    }
  }

  merged.push(current);
  return merged;
};