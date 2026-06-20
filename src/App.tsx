import { useEffect, useRef, useState } from "react";
import { Toolbar } from "./ui/Toolbar";
import { Canvas } from "./ui/Canvas";
import { Help } from "./ui/Help";
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
  const [pendingFile, setPendingFile] = useState<File | "picker" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const requestOpen = (file?: File) => {
    if (h.dirty) {
      setPendingFile(file || "picker");
    } else {
      if (file) h.open(file);
      else fileInputRef.current?.click();
    }
  };

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

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Don't intercept if typing in an input
      const target = e.target as HTMLElement;
      if (target && /INPUT|TEXTAREA/.test(target.tagName)) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) h.redo();
        else h.undo();
      } else if (e.key === ".") {
        e.preventDefault();
        setDebug((d) => !d);
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        vp.zoomOut();
      } else if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        vp.zoomIn();
      } else if (e.key === "0") {
        e.preventDefault();
        if (h.image) vp.fit(h.image.width, h.image.height);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [h, vp]);

  // Paste an image from the clipboard.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) =>
        i.type.startsWith("image/")
      );
      const file = item?.getAsFile();
      if (file) requestOpen(file);
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
        pushRecent={h.pushRecent}
        opacity={h.opacity}
        setOpacity={h.setOpacity}
        thickness={h.thickness}
        setThickness={h.setThickness}
        recent={h.recent}
        tool={h.tool}
        setTool={h.setTool}
        onRequestOpen={() => requestOpen()}
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
          if (f) requestOpen(f);
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
              panMode={vp.spaceHeld || h.tool === "pan"}
              altHeld={vp.altHeld && h.tool === "smart"}
              onDown={h.pointerDown}
              onMove={h.pointerMove}
              onUp={h.pointerUp}
              onHover={h.setHover}
              onPanStart={vp.startPan}
            />
          </div>
        ) : (
          <div style={{ position: "absolute", inset: 0, margin: "auto", width: "max-content", height: "max-content", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
            <label className="empty" style={{ position: "static", margin: 0 }}>
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => e.target.files?.[0] && requestOpen(e.target.files[0])}
              />
              <strong>Drop an image here</strong>
              <span>or click to choose · or paste from clipboard</span>
            </label>
            <div style={{ fontSize: "13px", color: "#8a8a93", textAlign: "center", lineHeight: 1.5 }}>
              Supported formats: JPG, PNG, WEBP, GIF, AVIF, BMP, SVG, and more.
              <br />
              PDFs are not currently supported.
            </div>
          </div>
        )}
        {h.analyzing && <div className="analyzing">Analyzing text…</div>}
        <Help />
        <input
          type="file"
          accept="image/*"
          hidden
          ref={fileInputRef}
          onChange={(e) => {
            if (e.target.files?.[0]) h.open(e.target.files[0]);
            e.target.value = "";
          }}
        />
        {pendingFile && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <div style={{
              background: "var(--bg-help-popup)", padding: 24, borderRadius: 12,
              boxShadow: "var(--shadow-help)", maxWidth: 400,
              border: "1px solid var(--border-help)", color: "var(--text)"
            }}>
              <h3 style={{ margin: "0 0 12px 0", fontSize: 18, color: "var(--text-heading)" }}>Discard unsaved highlights?</h3>
              <p style={{ margin: "0 0 24px 0", fontSize: 14, color: "var(--text-dim)", lineHeight: 1.5 }}>
                You have unsaved highlights. Are you sure you want to open a new image? All changes will be lost unless you export first.
              </p>
              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                <button 
                  onClick={() => setPendingFile(null)}
                  style={{ padding: "8px 16px", borderRadius: 6, background: "transparent", border: "1px solid var(--border)", color: "var(--text)", cursor: "pointer", fontSize: 14, whiteSpace: "nowrap" }}>
                  Go back
                </button>
                <button 
                  onClick={() => {
                    if (pendingFile === "picker") {
                      fileInputRef.current?.click();
                    } else {
                      h.open(pendingFile);
                    }
                    setPendingFile(null);
                  }}
                  style={{ padding: "8px 16px", borderRadius: 6, background: "#d93b3b", border: "none", color: "#fff", cursor: "pointer", fontSize: 14 }}>
                  Discard changes and open another file
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
