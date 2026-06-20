import { useEffect, useState } from "react";
import { WandIcon, PenIcon, BoxIcon, HandIcon, EraserIcon } from "./icons";

export function Help() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Shift + / generates '?' on standard US keyboards
      if (e.key === "?") {
        setOpen((o) => !o);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button 
        className="help-btn"
        onClick={() => setOpen(!open)}
        title="Help & Shortcuts (?)"
      >
        ?
      </button>

      {open && (
        <div className="help-popup">
          <div className="help-header">
            <h3>How to Use</h3>
            <button className="help-close" onClick={() => setOpen(false)}>×</button>
          </div>
          <div className="help-content">
            <p>Upload an image, pick a color, and draw to highlight. The app will intelligently detect and snap to lines of text.</p>
            
            <h4>Tools & Shortcuts</h4>
            <ul className="help-shortcuts">
              <li>
                <div className="help-shortcut-icon"><WandIcon /></div>
                <span><strong>Smart:</strong> Automatically snaps to words and lines.</span>
              </li>
              <li>
                <div className="help-shortcut-icon"><PenIcon /></div>
                <span><strong>Manual:</strong> Freeform drawing.</span>
              </li>
              <li>
                <div className="help-shortcut-icon"><BoxIcon /></div>
                <span><strong>Box:</strong> Draw axis-aligned rectangles.</span>
              </li>
              <li>
                <div className="help-shortcut-icon"><EraserIcon /></div>
                <span><strong>Erase:</strong> Click a stroke to delete it completely.</span>
              </li>
              <li>
                <div className="help-shortcut-icon"><HandIcon /></div>
                <span><strong>Pan:</strong> Hold <kbd>Space</kbd> or use middle-mouse to pan.</span>
              </li>
            </ul>

            <h4>Modifiers & Shortcuts</h4>
            <ul className="help-shortcuts">
              <li>
                <div className="help-shortcut-icon" style={{ opacity: 0 }}></div>
                <span><strong>Hold Alt / Option</strong> (in Smart mode) to precisely erase parts of existing highlights.</span>
              </li>
              <li>
                <div className="help-shortcut-icon" style={{ opacity: 0 }}></div>
                <span><strong>Ctrl / Cmd + Z</strong> to Undo, plus <strong>Shift</strong> to Redo.</span>
              </li>
              <li>
                <div className="help-shortcut-icon" style={{ opacity: 0 }}></div>
                <span><strong>Ctrl / Cmd + S</strong> to Export your highlighted image.</span>
              </li>
              <li>
                <div className="help-shortcut-icon" style={{ opacity: 0 }}></div>
                <span><strong>-</strong> / <strong>=</strong> to Zoom In/Out, and <strong>0</strong> to Fit to Screen.</span>
              </li>
              <li>
                <div className="help-shortcut-icon" style={{ opacity: 0 }}></div>
                <span><strong>. (period)</strong> to toggle the Debug Grid.</span>
              </li>
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
