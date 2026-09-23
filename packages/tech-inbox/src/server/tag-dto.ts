import type { TagDto } from "../contracts";
import type { Tag } from "../core/tag";

export function toTagDto(tag: Tag): TagDto {
  return {
    id: tag.id,
    name: tag.name,
    colorHue: tag.colorHue,
    createdAt: tag.createdAt,
    updatedAt: tag.updatedAt,
  };
}
