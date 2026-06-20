import {
  makeStroke,
  type Point,
  type Rect,
  type Stroke,
  type TextMap,
  type ToolBuilder,
  type RectSegment,
  type SnappedSegment,
  type LineBox,
  type WordBox,
} from "./types";

/** Normalize two corner points into an x/y/w/h rect. */
export function rectFromPoints(a: Point, b: Point): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
}

/**
 * Dumb box tool: drag a rectangle, highlight the whole rectangle.
 * Emits a single RectSegment.
 */
export class BoxBuilder implements ToolBuilder {
  private stroke: Stroke;
  private start: Point | null = null;
  private box: Rect = { x: 0, y: 0, w: 0, h: 0 };

  constructor(color: string, opacity: number) {
    this.stroke = makeStroke({ color, opacity });
  }

  down(p: Point) {
    this.start = p;
    this.update(p);
  }

  move(p: Point) {
    if (this.start) this.update(p);
  }

  private update(p: Point) {
    this.box = rectFromPoints(this.start!, p);
    const seg: RectSegment = { kind: "rect", ...this.box };
    this.stroke.segments = [seg];
  }

  currentBox(): Rect {
    return this.box;
  }

  preview(): Stroke {
    return this.stroke;
  }

  finish(): Stroke {
    return this.stroke;
  }
}



interface FlatWord {
  line: LineBox;
  word: WordBox;
  flatIndex: number;
}

function buildFlatWords(map: TextMap): FlatWord[] {
  const out: FlatWord[] = [];
  for (const line of map) {
    for (const word of line.words) {
      out.push({ line, word, flatIndex: out.length });
    }
  }
  return out;
}

function closestWord(flatWords: FlatWord[], p: Point): FlatWord | null {
  if (flatWords.length === 0) return null;
  let best = flatWords[0];
  let bestDist = Infinity;
  for (const fw of flatWords) {
    // If the point is strictly inside the word, return it immediately!
    if (p.x >= fw.word.x && p.x <= fw.word.x + fw.word.w &&
        p.y >= fw.word.y && p.y <= fw.word.y + fw.word.h) {
      return fw;
    }
    
    // Otherwise calculate distance to center
    const cx = fw.word.x + fw.word.w / 2;
    const cy = fw.word.y + fw.word.h / 2;
    const dx = p.x - cx;
    const dy = p.y - cy;
    // heavily penalize vertical distance so we stick to the right line
    const dist = dx * dx + dy * dy * 10; 
    if (dist < bestDist) {
      bestDist = dist;
      best = fw;
    }
  }
  return best;
}

/**
 * Smart-paragraph tool: acts like a digital text selector.
 * Dragging selects all words between the start word and end word
 * in reading order.
 */
export class ParagraphBuilder implements ToolBuilder {
  private stroke: Stroke;
  private flatWords: FlatWord[];
  private startWord: FlatWord | null = null;



  constructor(map: TextMap, color: string, opacity: number) {
    this.stroke = makeStroke({ color, opacity });
    this.flatWords = buildFlatWords(map);
  }

  down(p: Point) {
    this.startWord = closestWord(this.flatWords, p);
    this.update(p);
  }

  move(p: Point) {
    if (this.startWord) this.update(p);
  }

  private update(p: Point) {
    const endWord = closestWord(this.flatWords, p);
    if (!this.startWord || !endWord) return;

    const minIdx = Math.min(this.startWord.flatIndex, endWord.flatIndex);
    const maxIdx = Math.max(this.startWord.flatIndex, endWord.flatIndex);

    const selected = this.flatWords.slice(minIdx, maxIdx + 1);
    
    // Group selected words by line
    const byLine = new Map<number, { line: LineBox; minX: number; maxX: number }>();
    
    for (const fw of selected) {
      let group = byLine.get(fw.line.id);
      if (!group) {
        group = { line: fw.line, minX: Infinity, maxX: -Infinity };
        byLine.set(fw.line.id, group);
      }
      if (fw.word.x < group.minX) group.minX = fw.word.x;
      if (fw.word.x + fw.word.w > group.maxX) group.maxX = fw.word.x + fw.word.w;
    }

    const segments: SnappedSegment[] = [];
    for (const group of byLine.values()) {
      segments.push({
        kind: "snapped",
        lineId: group.line.id,
        x0: group.minX,
        x1: group.maxX,
        y: group.line.cy,
        thickness: group.line.h,
      });
    }

    this.stroke.segments = segments;
  }

  currentBox(): Rect {
    // We return a 0-size rect so the marquee is hidden, since we now draw the selection
    // directly as stroke preview segments.
    return { x: 0, y: 0, w: 0, h: 0 };
  }

  preview(): Stroke {
    return this.stroke;
  }

  finish(): Stroke {
    return this.stroke;
  }
}

