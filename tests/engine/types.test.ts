import { describe, it, expect } from "vitest";
import { makeLineBox, makeStroke } from "../../src/engine/types";

describe("type factories", () => {
  it("makeLineBox fills derived fields", () => {
    const lb = makeLineBox({ id: 0, x: 10, y: 20, w: 100, h: 16, words: [] });
    expect(lb.baseline).toBe(20 + 16); // bottom by default
    expect(lb.cy).toBe(20 + 8);
  });

  it("makeStroke generates an id and defaults", () => {
    const s = makeStroke({ color: "#ffe14d" });
    expect(s.id).toMatch(/.+/);
    expect(s.opacity).toBe(0.4);
    expect(s.segments).toEqual([]);
  });
});
