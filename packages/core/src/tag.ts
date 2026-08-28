export const MAX_TAG_NAME_LENGTH = 30;
export const MAX_TAGS = 100;
export const MAX_TAGS_PER_ARTICLE = 10;
export const TAG_COLOR_HUE_COUNT = 360;
export const FIRST_TAG_COLOR_HUE = 220;

export type Tag = {
  readonly id: string;
  readonly name: string;
  readonly normalizedName: string;
  readonly colorHue: number;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type NormalizeTagNameResult =
  | {
      readonly ok: true;
      readonly name: string;
      readonly normalizedName: string;
    }
  | {
      readonly ok: false;
      readonly reason: "EMPTY" | "TOO_LONG";
    };

export function normalizeTagName(value: string): NormalizeTagNameResult {
  const name = value.normalize("NFKC").replace(/\s+/gu, " ").trim();
  if (name.length === 0) return { ok: false, reason: "EMPTY" };
  if (Array.from(name).length > MAX_TAG_NAME_LENGTH) {
    return { ok: false, reason: "TOO_LONG" };
  }

  return { ok: true, name, normalizedName: name.toLowerCase() };
}

function circularHueDistance(left: number, right: number): number {
  const direct = Math.abs(left - right);
  return Math.min(direct, TAG_COLOR_HUE_COUNT - direct);
}

export function allocateTagColorHue(usedHues: readonly number[]): number | null {
  const used = new Set(
    usedHues.filter((hue) => Number.isInteger(hue) && hue >= 0 && hue < TAG_COLOR_HUE_COUNT),
  );
  if (used.size >= TAG_COLOR_HUE_COUNT) return null;

  let selectedHue = FIRST_TAG_COLOR_HUE;
  let selectedDistance = -1;

  for (let offset = 0; offset < TAG_COLOR_HUE_COUNT; offset += 1) {
    const candidate = (FIRST_TAG_COLOR_HUE + offset) % TAG_COLOR_HUE_COUNT;
    if (used.has(candidate)) continue;

    const nearestDistance =
      used.size === 0
        ? TAG_COLOR_HUE_COUNT
        : Math.min(...Array.from(used, (hue) => circularHueDistance(candidate, hue)));
    if (nearestDistance > selectedDistance) {
      selectedHue = candidate;
      selectedDistance = nearestDistance;
    }
  }

  return selectedHue;
}
