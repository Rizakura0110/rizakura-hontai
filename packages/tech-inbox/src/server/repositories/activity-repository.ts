import type { ReadActivitySnapshot, ReadActivityWindow } from "../../core/activity";

export type ActivityRepositoryRange = Pick<ReadActivityWindow, "startAt" | "endAtExclusive">;

export interface ActivityRepository {
  loadReadActivity(range: ActivityRepositoryRange): Promise<ReadActivitySnapshot>;
}
