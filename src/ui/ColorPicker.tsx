import { useEffect, useRef, useState } from "react";
import { hexToHsv, hsvToHex, hexToRgb, type HSV } from "./color";

interface Props {
  value: string;
  onChange: (hex: string) => void;
  recent: string[];
}

/** Pointer position within an element, clamped to 0..1 on each axis. */
function relPos(el: HTMLElement, clientX: number, clientY: number) {
  const r = el.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1, (clientX - r.left) / r.width)),
    y: Math.max(0, Math.min(1, (clientY - r.top) / r.height)),
  };
}

export function ColorPicker({ value, onChange, recent }: Props) {
  const [open, setOpen] = useState(false);
  const [hsv, setHsv] = useState<HSV>(() => hexToHsv(value) ?? { h: 50, s: 0.7, v: 1 });
  const [hexText, setHexText] = useState(value);
  const rootRef = useRef<HTMLDivElement>(null);

  // Keep internal state in sync when the value changes externally.
  useEffect(() => {
    const h = hexToHsv(value);
    if (h) setHsv(h);
    setHexText(value);
  }, [value]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const commit = (next: HSV) => {
    setHsv(next);
    const hex = hsvToHex(next);
    setHexText(hex);
    onChange(hex);
  };

  const dragSV = (el: HTMLElement, clientX: number, clientY: number) => {
    const { x, y } = relPos(el, clientX, clientY);
    commit({ ...hsv, s: x, v: 1 - y });
  };

  const dragHue = (el: HTMLElement, clientX: number) => {
    const r = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    commit({ ...hsv, h: x * 360 });
  };

  const hueHex = hsvToHex({ h: hsv.h, s: 1, v: 1 });

  return (
    <div className="cp-root" ref={rootRef}>
      <button
        className="cp-trigger"
        style={{ background: value }}
        onClick={() => setOpen((o) => !o)}
        aria-label="Custom color"
        title="Custom color"
      >
        +
      </button>
      {open && (
        <div className="cp-popover">
          <div
            className="cp-sv"
            style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueHex})` }}
            onPointerDown={(e) => {
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
              dragSV(e.currentTarget, e.clientX, e.clientY);
            }}
            onPointerMove={(e) => {
              if (e.buttons) dragSV(e.currentTarget, e.clientX, e.clientY);
            }}
          >
            <div
              className="cp-sv-thumb"
              style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: value }}
            />
          </div>
          <div
            className="cp-hue"
            onPointerDown={(e) => {
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
              dragHue(e.currentTarget, e.clientX);
            }}
            onPointerMove={(e) => {
              if (e.buttons) dragHue(e.currentTarget, e.clientX);
            }}
          >
            <div className="cp-hue-thumb" style={{ left: `${(hsv.h / 360) * 100}%` }} />
          </div>
          <div className="cp-row">
            <span className="cp-preview" style={{ background: value }} />
            <input
              className="cp-hex"
              value={hexText}
              spellCheck={false}
              onChange={(e) => {
                setHexText(e.target.value);
                const rgb = hexToRgb(e.target.value);
                if (rgb) {
                  const next = hexToHsv(e.target.value)!;
                  setHsv(next);
                  onChange(hsvToHex(next));
                }
              }}
            />
          </div>
          {recent.length > 0 && (
            <div className="cp-recent">
              {recent.map((c) => (
                <button
                  key={c}
                  className="cp-recent-swatch"
                  style={{ background: c }}
                  onClick={() => {
                    const h = hexToHsv(c);
                    if (h) commit(h);
                  }}
                  aria-label={c}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
