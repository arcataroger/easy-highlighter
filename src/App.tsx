import { useEffect } from "react";
import { Toolbar } from "./ui/Toolbar";
import { Canvas } from "./ui/Canvas";
import { useHighlighter } from "./ui/useHighlighter";
import "./index.css";

const DEBUG =
  typeof location !== "undefined" &&
  new URLSearchParams(location.search).has("debug");

export default function App() {
  const h = useHighlighter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) h.redo();
        else h.undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [h]);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) =>
        i.type.startsWith("image/")
      );
      const file = item?.getAsFile();
      if (file) h.open(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [h]);

  return (
    <div className="app">
      <Toolbar
        color={h.color}
        setColor={h.setColor}
        opacity={h.opacity}
        setOpacity={h.setOpacity}
        tool={h.tool}
        setTool={h.setTool}
        onOpen={h.open}
        onUndo={h.undo}
        onRedo={h.redo}
        onSave={h.save}
        hasImage={!!h.image}
      />
      <div
        className="stage"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) h.open(f);
        }}
      >
        {h.image ? (
          <Canvas
            image={h.image}
            strokes={h.strokes}
            textMap={h.textMap}
            debug={DEBUG}
            cursor={h.tool}
            onDown={h.pointerDown}
            onMove={h.pointerMove}
            onUp={h.pointerUp}
          />
        ) : (
          <div className="empty">Drop an image here, paste, or click Open</div>
        )}
        {h.analyzing && <div className="analyzing">Analyzing text…</div>}
      </div>
    </div>
  );
}
