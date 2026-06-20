import { useEffect, useRef, useState } from "react";
import { Toolbar } from "./ui/Toolbar";
import { Canvas } from "./ui/Canvas";
import { useHighlighter } from "./ui/useHighlighter";
import { useViewport } from "./ui/useViewport";
import "./index.css";

const INITIAL_DEBUG =
  typeof location !== "undefined" &&
  new URLSearchParams(location.search).has("debug");

export default function App() {
  const h = useHighlighter();
  const stageRef = useRef<HTMLDivElement>(null);
  const vp = useViewport(stageRef);
  const [debug, setDebug] = useState(INITIAL_DEBUG);

  // Keep the URL's ?debug flag in sync with the toggle, so the address bar
  // always reflects (and is shareable as) the current UI state.
  useEffect(() => {
    if (typeof location === "undefined") return;
    const url = new URL(location.href);
    if (debug) url.searchParams.set("debug", "");
    else url.searchParams.delete("debug");
    // `?debug=` reads cleaner as `?debug`.
    const search = url.searchParams.toString().replace(/=(?=&|$)/g, "");
    const next = url.pathname + (search ? `?${search}` : "") + url.hash;
    history.replaceState(null, "", next);
  }, [debug]);

  // Fit the image into view whenever a new one loads.
  const imgId = h.image ? `${h.image.width}x${h.image.height}` : null;
  useEffect(() => {
    if (h.image) vp.fit(h.image.width, h.image.height);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgId]);

  // Undo/redo shortcuts.
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

  // Paste an image from the clipboard.
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

  const cursor = vp.spaceHeld ? "pan" : h.tool;

  return (
    <div className="app">
      <Toolbar
        color={h.color}
        setColor={h.setColor}
        opacity={h.opacity}
        setOpacity={h.setOpacity}
        thickness={h.thickness}
        setThickness={h.setThickness}
        recent={h.recent}
        tool={h.tool}
        setTool={h.setTool}
        onOpen={h.open}
        onUndo={h.undo}
        onRedo={h.redo}
        onSave={h.save}
        onZoomIn={vp.zoomIn}
        onZoomOut={vp.zoomOut}
        onFit={() => h.image && vp.fit(h.image.width, h.image.height)}
        zoomPct={vp.zoom * 100}
        debug={debug}
        onToggleDebug={() => setDebug((d) => !d)}
        hasImage={!!h.image}
      />
      <div
        className="stage"
        ref={stageRef}
        data-space={vp.spaceHeld ? "1" : undefined}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) h.open(f);
        }}
      >
        {h.image ? (
          <div
            className="content"
            style={{
              transform: `translate(${vp.panX}px, ${vp.panY}px) scale(${vp.zoom})`,
              transformOrigin: "0 0",
            }}
          >
            <Canvas
              image={h.image}
              strokes={h.strokes}
              preview={h.preview}
              hoverPreview={h.hoverPreview}
              textMap={h.textMap}
              marquee={h.marquee}
              debug={debug}
              cursor={cursor}
              panMode={vp.spaceHeld}
              onDown={h.pointerDown}
              onMove={h.pointerMove}
              onUp={h.pointerUp}
              onHover={h.setHover}
              onPanStart={vp.startPan}
            />
          </div>
        ) : (
          <label className="empty">
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => e.target.files?.[0] && h.open(e.target.files[0])}
            />
            <strong>Drop an image here</strong>
            <span>or click to choose · or paste from clipboard</span>
          </label>
        )}
        {h.analyzing && <div className="analyzing">Analyzing text…</div>}
      </div>
    </div>
  );
}
