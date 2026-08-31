import type { TagDto } from "@rizakura-me/contracts";
import type { Tag } from "@tech-inbox/core/tag";

export function toTagDto(tag: Tag): TagDto {
  return {
    id: tag.id,
    name: tag.name,
    colorHue: tag.colorHue,
    createdAt: tag.createdAt,
    updatedAt: tag.updatedAt,
  };
}
