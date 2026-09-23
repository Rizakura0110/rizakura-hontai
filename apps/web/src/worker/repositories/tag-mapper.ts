import type { TagRow } from "@rizakura-hontai/db";
import type { Tag } from "@rizakura-hontai/tech-inbox/core/tag";

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
