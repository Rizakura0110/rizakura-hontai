import type { Tag } from "@tech-inbox/core/tag";
import type { TagRow } from "@rizakura-hontai/db";

export function mapTagRow(row: TagRow): Tag {
  return {
    id: row.id,
    name: row.name,
    normalizedName: row.normalizedName,
    colorHue: row.colorHue,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
