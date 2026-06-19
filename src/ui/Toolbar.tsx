import type { ExportFormat } from "../render/exporter";
import type { Tool } from "./useHighlighter";

const SWATCHES = ["#ffe14d", "#ff9ecb", "#9cff8f", "#8fd3ff", "#d6a3ff"];

interface Props {
  color: string;
  setColor: (c: string) => void;
  opacity: number;
  setOpacity: (o: number) => void;
  tool: Tool;
  setTool: (t: Tool) => void;
  onOpen: (file: File) => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: (f: ExportFormat) => void;
  hasImage: boolean;
}

export function Toolbar(p: Props) {
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
        <input
          type="color"
          value={p.color}
          onChange={(e) => p.setColor(e.target.value)}
        />
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
      <button
        className={"btn" + (p.tool === "highlight" ? " active" : "")}
        onClick={() => p.setTool("highlight")}
      >
        Highlight
      </button>
      <button
        className={"btn" + (p.tool === "erase" ? " active" : "")}
        onClick={() => p.setTool("erase")}
      >
        Erase
      </button>
      <button className="btn" onClick={p.onUndo} disabled={!p.hasImage}>
        Undo
      </button>
      <button className="btn" onClick={p.onRedo} disabled={!p.hasImage}>
        Redo
      </button>
      <button className="btn" onClick={() => p.onSave("png")} disabled={!p.hasImage}>
        Save PNG
      </button>
      <button
        className="btn"
        onClick={() => p.onSave("jpeg")}
        disabled={!p.hasImage}
      >
        Save JPEG
      </button>
    </div>
  );
}
