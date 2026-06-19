import { describe, it, expect } from "vitest";
import { HighlightModel } from "../../src/engine/highlightModel";
import { makeStroke } from "../../src/engine/types";

describe("HighlightModel", () => {
  it("adds strokes and lists them in order", () => {
    const m = new HighlightModel();
    m.add(makeStroke({ id: "a", color: "#ff0" }));
    m.add(makeStroke({ id: "b", color: "#f0f" }));
    expect(m.strokes.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("undo removes the last stroke; redo restores it", () => {
    const m = new HighlightModel();
    m.add(makeStroke({ id: "a", color: "#ff0" }));
    m.add(makeStroke({ id: "b", color: "#f0f" }));
    m.undo();
    expect(m.strokes.map((s) => s.id)).toEqual(["a"]);
    m.redo();
    expect(m.strokes.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("a new action after undo clears the redo stack", () => {
    const m = new HighlightModel();
    m.add(makeStroke({ id: "a", color: "#ff0" }));
    m.undo();
    m.add(makeStroke({ id: "c", color: "#0ff" }));
    m.redo(); // nothing to redo
    expect(m.strokes.map((s) => s.id)).toEqual(["c"]);
  });

  it("remove deletes a stroke by id and is undoable", () => {
    const m = new HighlightModel();
    m.add(makeStroke({ id: "a", color: "#ff0" }));
    m.add(makeStroke({ id: "b", color: "#f0f" }));
    m.remove("a");
    expect(m.strokes.map((s) => s.id)).toEqual(["b"]);
    m.undo();
    expect(m.strokes.map((s) => s.id)).toEqual(["a", "b"]);
  });
});
