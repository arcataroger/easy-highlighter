import type { ExportFormat } from "../render/exporter";
import type { Tool } from "./useHighlighter";
import { ColorPicker } from "./ColorPicker";

const SWATCHES = ["#ffe14d", "#ff9ecb", "#9cff8f", "#8fd3ff", "#d6a3ff"];

const TOOLS: { id: Tool; label: string; title: string }[] = [
  { id: "smart", label: "✨ Smart", title: "Smart highlighter — snaps to & follows text lines" },
  { id: "manual", label: "✍️ Manual", title: "Manual highlighter — freehand, fixed thickness" },
  { id: "smart-box", label: "▦ Paragraph", title: "Smart paragraph — drag a box, auto-highlight each line" },
  { id: "box", label: "▭ Box", title: "Box — highlight a whole rectangle" },
  { id: "erase", label: "⌫ Erase", title: "Erase — click a highlight to remove it" },
];

interface Props {
  color: string;
  setColor: (c: string) => void;
  opacity: number;
  setOpacity: (o: number) => void;
  thickness: number;
  setThickness: (t: number) => void;
  recent: string[];
  tool: Tool;
  setTool: (t: Tool) => void;
  onOpen: (file: File) => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: (f: ExportFormat) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  zoomPct: number;
  hasImage: boolean;
}

export function Toolbar(p: Props) {
  const showThickness = p.tool === "manual" || p.tool === "box";
  return (
    <div className="toolbar">
      <label className="btn">
        Open
        <input
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => e.target.files?.[0] && p.onOpen(e.target.files[0])}
        />
      </label>

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
            style={{ background: c }}
            onClick={() => p.setColor(c)}
            aria-label={c}
          />
        ))}
        <ColorPicker value={p.color} onChange={p.setColor} recent={p.recent} />
      </div>

      <label className="opacity">
        Opacity
        <input
          type="range"
          min={0.1}
          max={1}
          step={0.05}
          value={p.opacity}
          onChange={(e) => p.setOpacity(Number(e.target.value))}
        />
      </label>

      {showThickness && (
        <label className="opacity">
          Size
          <input
            type="range"
            min={4}
            max={80}
            step={1}
            value={p.thickness}
            onChange={(e) => p.setThickness(Number(e.target.value))}
          />
        </label>
      )}

      <span className="sep" />

      <button className="btn" onClick={p.onUndo} disabled={!p.hasImage}>Undo</button>
      <button className="btn" onClick={p.onRedo} disabled={!p.hasImage}>Redo</button>

      <span className="sep" />

      <div className="zoom">
        <button className="btn" onClick={p.onZoomOut} disabled={!p.hasImage}>−</button>
        <button className="btn zoom-pct" onClick={p.onFit} disabled={!p.hasImage} title="Fit">
          {Math.round(p.zoomPct)}%
        </button>
        <button className="btn" onClick={p.onZoomIn} disabled={!p.hasImage}>+</button>
      </div>

      <span className="sep" />

      <button className="btn" onClick={() => p.onSave("png")} disabled={!p.hasImage}>Save PNG</button>
      <button className="btn" onClick={() => p.onSave("jpeg")} disabled={!p.hasImage}>Save JPEG</button>
    </div>
  );
}
