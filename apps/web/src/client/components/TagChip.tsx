import type { TagDto } from "@rizakura-hontai/contracts";

type TagChipProps = {
  readonly tag: TagDto;
};

export function TagChip({ tag }: TagChipProps) {
  return (
    <span
      className="inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-xs font-semibold"
      style={{
        backgroundColor: `hsl(${tag.colorHue} 72% 93%)`,
        borderColor: `hsl(${tag.colorHue} 50% 78%)`,
        color: `hsl(${tag.colorHue} 55% 24%)`,
      }}
      title={tag.name}
    >
      <span className="truncate">{tag.name}</span>
    </span>
  );
}
