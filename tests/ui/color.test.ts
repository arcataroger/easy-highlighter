import { describe, it, expect } from "vitest";
import { hsvToHex, hexToHsv, hexToRgb, rgbToHex } from "../../src/ui/color";

describe("color conversions", () => {
  it("round-trips hex -> hsv -> hex for saturated colors", () => {
    for (const hex of ["#ff0000", "#00ff00", "#0000ff", "#ffe14d", "#8fd3ff"]) {
      const hsv = hexToHsv(hex)!;
      expect(hsvToHex(hsv)).toBe(hex);
    }
  });

  it("expands 3-digit hex", () => {
    expect(hexToRgb("#f80")).toEqual({ r: 255, g: 136, b: 0 });
  });

  it("rejects invalid hex", () => {
    expect(hexToRgb("nope")).toBeNull();
    expect(hexToRgb("#12")).toBeNull();
  });

  it("formats rgb to lowercase hex", () => {
    expect(rgbToHex({ r: 255, g: 225, b: 77 })).toBe("#ffe14d");
  });
});
