import { describe, expect, it } from "vitest";
import {
  allocateTagColorHue,
  FIRST_TAG_COLOR_HUE,
  MAX_TAG_NAME_LENGTH,
  normalizeTagName,
  TAG_COLOR_HUE_COUNT,
} from "./tag";

describe("tag names", () => {
  it("normalizes width, whitespace, and case for duplicate detection", () => {
    expect(normalizeTagName("  Ｒｅａｃｔ\n 入門  ")).toEqual({
      ok: true,
      name: "React 入門",
      normalizedName: "react 入門",
    });
  });

  it("rejects empty and overlong names", () => {
    expect(normalizeTagName(" \n ")).toEqual({ ok: false, reason: "EMPTY" });
    expect(normalizeTagName("a".repeat(MAX_TAG_NAME_LENGTH + 1))).toEqual({
      ok: false,
      reason: "TOO_LONG",
    });
  });
});

describe("tag color allocation", () => {
  it("starts from the preferred blue hue and maximizes separation", () => {
    const first = allocateTagColorHue([]);
    const second = allocateTagColorHue([FIRST_TAG_COLOR_HUE]);
    const third = allocateTagColorHue([FIRST_TAG_COLOR_HUE, second ?? -1]);

    expect(first).toBe(FIRST_TAG_COLOR_HUE);
    expect(second).toBe(40);
    expect([130, 310]).toContain(third);
  });

  it("does not repeat an exact hue for the supported tag count", () => {
    const hues: number[] = [];
    for (let index = 0; index < 100; index += 1) {
      const hue = allocateTagColorHue(hues);
      expect(hue).not.toBeNull();
      hues.push(hue ?? -1);
    }

    expect(new Set(hues).size).toBe(100);
  });

  it("returns null only when every hue is occupied", () => {
    expect(
      allocateTagColorHue(Array.from({ length: TAG_COLOR_HUE_COUNT }, (_, hue) => hue)),
    ).toBeNull();
  });
});
