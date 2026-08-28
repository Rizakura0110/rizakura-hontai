import type { TagRow } from "@tech-inbox/db";
import { describe, expect, it } from "vitest";
import { mapTagRow } from "./tag-mapper";

describe("mapTagRow", () => {
  it("maps every persisted tag field without exposing database names", () => {
    const row: TagRow = {
      id: "tag-1",
      name: "React",
      normalizedName: "react",
      colorHue: 220,
      createdAt: "2026-08-28T00:00:00.000Z",
      updatedAt: "2026-08-28T00:00:00.000Z",
    };

    expect(mapTagRow(row)).toEqual(row);
  });
});
