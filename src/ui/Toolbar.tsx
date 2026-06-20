import { useState, useEffect } from "react";
import type { Tool } from "./useHighlighter";
import { ColorPicker } from "./ColorPicker";
import { hexToRgb } from "./color";
import {
  FolderIcon, WandIcon, PenIcon, BoxIcon, EraserIcon, HandIcon,
  MinusIcon, PlusIcon, FitIcon, UndoIcon, RedoIcon, GridIcon, DownloadIcon
} from "./icons";

const SWATCHES = ["#ffe14d", "#ff9ecb", "#9cff8f", "#8fd3ff", "#d6a3ff"];

const TOOLS: { id: Tool; label: React.ReactNode; title: string }[] = [
  { id: "smart", label: <><WandIcon style={{ width: 16, height: 16, display: "inline-block", verticalAlign: "middle", marginRight: 6 }} /> Smart</>, title: "Smart paragraph — acts as a digital text selector" },
  { id: "manual", label: <><PenIcon style={{ width: 16, height: 16, display: "inline-block", verticalAlign: "middle", marginRight: 6 }} /> Manual</>, title: "Manual highlighter — freehand, fixed thickness" },
  { id: "box", label: <><BoxIcon style={{ width: 16, height: 16, display: "inline-block", verticalAlign: "middle", marginRight: 6 }} /> Box</>, title: "Box — highlight a whole rectangle" },
  { 
    id: "erase", 
    label: (
      <>
        <EraserIcon style={{ width: 16, height: 16, display: "inline-block", verticalAlign: "middle", marginRight: 6 }} />
        Eraser
      </>
    ), 
    title: "Eraser — click a highlight to remove it" 
  },
];

interface Props {
  color: string;
  setColor: (c: string) => void;
  pushRecent: (c: string) => void;
  opacity: number;
  setOpacity: (o: number) => void;
  thickness: number;
  setThickness: (t: number) => void;
  recent: string[];
  tool: Tool;
  setTool: (t: Tool) => void;
  onRequestOpen: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: (format: "png" | "jpeg" | "webp") => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  zoomPct: number;
  debug: boolean;
  onToggleDebug: () => void;
  hasImage: boolean;
}

export function Toolbar(p: Props) {
  const showThickness = p.tool === "manual";
  const [previewing, setPreviewing] = useState<boolean>(false);
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (p.hasImage) setExportOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [p.hasImage]);

  const rgb = hexToRgb(p.color);
  const trackColor = rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${p.opacity})` : p.color;

  return (
    <div className="toolbar">
      {previewing && (
        <div className="brush-preview-popup" style={{ 
          position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", 
          marginTop: "8px", background: "#fff", padding: "24px 32px", borderRadius: "8px", 
          border: "1px solid #ccc", boxShadow: "0 8px 30px rgba(0,0,0,0.15)", 
          zIndex: 100 
        }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center", gap: "16px", color: "#222", fontFamily: "Georgia, serif", whiteSpace: "nowrap", userSelect: "none", lineHeight: 1 }}>
            <span style={{ fontSize: 12 }}>12px</span>
            <span style={{ fontSize: 16 }}>16px</span>
            <span style={{ fontSize: 24 }}>24px</span>
            <span style={{ fontSize: 36 }}>36px</span>
            <span style={{ fontSize: 48 }}>48px</span>
            <span style={{ fontSize: 72 }}>72px</span>
            <span style={{ width: 16 }} />

            {/* The Highlight */}
            <div style={{ 
              position: "absolute", 
              left: -12, 
              right: 12, 
              top: "56%", 
              transform: "translateY(-50%)", 
              height: p.thickness, 
              background: trackColor, 
              borderRadius: p.thickness / 2,
              mixBlendMode: "multiply",
              pointerEvents: "none"
            }} />

            {/* The Cursor */}
            <div style={{
              position: "absolute",
              right: 0,
              top: "56%",
              transform: "translateY(-50%)",
              width: 2,
              height: p.thickness,
              background: p.color,
              pointerEvents: "none"
            }} />
          </div>
        </div>
      )}

      <div className="toolbar-section">
        <div className="file-actions">
        <button className="btn" title="Open Image" onClick={p.onRequestOpen} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <FolderIcon style={{ width: 18, height: 18 }} />
        </button>
      </div>

      <span className="sep" />

      <div className="tools">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            className={"btn" + (p.tool === t.id ? " active" : "")}
            title={t.title}
            onClick={() => p.setTool(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <span className="sep" />

      <div className="swatches">
        {SWATCHES.map((c) => (
          <button
            key={c}
            className={"swatch" + (c === p.color ? " active" : "")}
            style={{ background: c, opacity: p.opacity }}
            onClick={() => {
              p.setColor(c);
              p.pushRecent(c);
            }}
            aria-label={c}
          />
        ))}
        <ColorPicker 
          value={p.color} 
          onChange={p.setColor} 
          onChangeComplete={p.pushRecent}
          recent={p.recent} 
          opacity={p.opacity} 
          isCustom={!SWATCHES.includes(p.color)}
        />
      </div>

      <label className="opacity">
        Opacity
        <input
          type="range"
          className="opacity-slider"
          min={0.1}
          max={1}
          step={0.05}
          value={p.opacity}
          onChange={(e) => p.setOpacity(Number(e.target.value))}
          onPointerDown={() => setPreviewing(true)}
          onPointerUp={() => setPreviewing(false)}
          onPointerLeave={() => setPreviewing(false)}
          style={{ '--thumb-color': p.color, background: trackColor } as React.CSSProperties}
        />
      </label>

      {showThickness && (
        <label className="opacity" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          Size
          <div className="size-slider-wrapper">
            <div className="size-slider-ramp" />
            <input
              type="range"
              className="size-slider"
              min={4}
              max={80}
              step={1}
              value={p.thickness}
              onChange={(e) => p.setThickness(Number(e.target.value))}
              onPointerDown={() => setPreviewing(true)}
              onPointerUp={() => setPreviewing(false)}
              onPointerLeave={() => setPreviewing(false)}
              style={{ '--thumb-color': p.color } as React.CSSProperties}
            />
          </div>
          <input
            type="number"
            className="no-arrows"
            value={p.thickness}
            onChange={(e) => p.setThickness(Number(e.target.value))}
            min={4}
            max={80}
            style={{ width: "36px", background: "transparent", border: "1px solid #44444c", borderRadius: "4px", color: "inherit", padding: "2px 4px", fontSize: "12px", outline: "none", textAlign: "center" }}
          />
        </label>
      )}
      </div>

      <div className="toolbar-section">
        <button className="btn" onClick={p.onUndo} disabled={!p.hasImage} title="Undo" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <UndoIcon style={{ width: 18, height: 18 }} />
        </button>
      <button className="btn" onClick={p.onRedo} disabled={!p.hasImage} title="Redo" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <RedoIcon style={{ width: 18, height: 18 }} />
      </button>

      <span className="sep" />

      <div className="zoom">
        <button className={"btn" + (p.tool === "pan" ? " active" : "")} onClick={() => p.setTool("pan")} disabled={!p.hasImage} title="Pan Tool (Spacebar)" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <HandIcon style={{ width: 18, height: 18 }} />
        </button>
        <button className="btn" onClick={p.onZoomOut} disabled={!p.hasImage} title="Zoom Out" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <MinusIcon style={{ width: 18, height: 18 }} />
        </button>
        <button className="btn zoom-pct" onClick={p.onFit} disabled={!p.hasImage} title="Fit" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
          <FitIcon style={{ width: 16, height: 16 }} /> {Math.round(p.zoomPct)}%
        </button>
        <button className="btn" onClick={p.onZoomIn} disabled={!p.hasImage} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <PlusIcon style={{ width: 18, height: 18 }} />
        </button>
      </div>

      <span className="sep" />

      <button className={"btn" + (p.debug ? " active" : "")} onClick={p.onToggleDebug} disabled={!p.hasImage} title="Debug Grid" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <GridIcon style={{ width: 18, height: 18 }} />
      </button>

      <span className="sep" />

      <div className="save-actions" style={{ position: "relative" }}>
        <button 
          className={"btn" + (exportOpen ? " active" : "")}
          onClick={() => setExportOpen(!exportOpen)} 
          disabled={!p.hasImage} 
          title="Export as..." 
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", background: "#5b5bd6", borderColor: "#7b7bf0", fontWeight: "bold" }}
        >
          <DownloadIcon style={{ width: 16, height: 16 }} />
          Export
        </button>
        {exportOpen && (
          <div style={{ position: "absolute", top: "100%", right: 0, marginTop: "8px", background: "#26262c", border: "1px solid #44444c", borderRadius: "6px", padding: "4px", display: "flex", flexDirection: "column", gap: "2px", zIndex: 100, boxShadow: "0 8px 30px rgba(0,0,0,0.5)", width: "120px" }}>
            <button className="btn" onClick={() => { setExportOpen(false); p.onSave("png"); }} style={{ textAlign: "left", padding: "8px", border: "none" }}>PNG Image</button>
            <button className="btn" onClick={() => { setExportOpen(false); p.onSave("jpeg"); }} style={{ textAlign: "left", padding: "8px", border: "none" }}>JPEG Image</button>
            <button className="btn" onClick={() => { setExportOpen(false); p.onSave("webp"); }} style={{ textAlign: "left", padding: "8px", border: "none" }}>WebP Image</button>
          </div>
        )}
      </div>
    </div>
    </div>
  );
}
