import type { Stroke } from "./types";

/** Immutable snapshots on an undo/redo stack. Simple and correct for v1 sizes. */
export class HighlightModel {
  private _strokes: Stroke[] = [];
  private undoStack: Stroke[][] = [];
  private redoStack: Stroke[][] = [];

  get strokes(): Stroke[] {
    return this._strokes;
  }

  private commit(next: Stroke[]) {
    this.undoStack.push(this._strokes);
    this.redoStack = [];
    this._strokes = next;
  }

  add(stroke: Stroke) {
    this.commit([...this._strokes, stroke]);
  }

  remove(id: string) {
    this.commit(this._strokes.filter((s) => s.id !== id));
  }

  setStrokes(strokes: Stroke[]) {
    this.commit(strokes);
  }

  setStrokeColor(id: string, color: string) {
    this.commit(this._strokes.map((s) => (s.id === id ? { ...s, color } : s)));
  }

  undo() {
    const prev = this.undoStack.pop();
    if (!prev) return;
    this.redoStack.push(this._strokes);
    this._strokes = prev;
  }

  redo() {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(this._strokes);
    this._strokes = next;
  }

  canUndo() {
    return this.undoStack.length > 0;
  }
  canRedo() {
    return this.redoStack.length > 0;
  }

  serialize() {
    return {
      strokes: this._strokes,
      undoStack: this.undoStack,
      redoStack: this.redoStack,
    };
  }

  deserialize(data: any) {
    if (!data) return;
    this._strokes = data.strokes || [];
    this.undoStack = data.undoStack || [];
    this.redoStack = data.redoStack || [];
  }
}
