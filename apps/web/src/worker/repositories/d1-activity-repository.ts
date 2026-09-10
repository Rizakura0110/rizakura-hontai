import type { ReadActivityDayCount } from "@tech-inbox/core/activity";
import type { ActivityRepository, ActivityRepositoryRange } from "./activity-repository";

type ActivityResultRow = {
  readonly total_read_count?: unknown;
  readonly activity_date?: unknown;
  readonly read_count?: unknown;
};

export class ActivityDataIntegrityError extends Error {
  constructor() {
    super("Stored article activity violates a data invariant.");
    this.name = "ActivityDataIntegrityError";
  }
}

function nonNegativeInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new ActivityDataIntegrityError();
  }
  return value;
}

class D1ActivityRepository implements ActivityRepository {
  readonly #binding: D1Database;

  constructor(binding: D1Database) {
    this.#binding = binding;
  }

  async loadReadActivity(range: ActivityRepositoryRange) {
    const [totalResult, dailyResult] = await this.#binding.batch<ActivityResultRow>([
      this.#binding.prepare(
        "SELECT COUNT(*) AS total_read_count FROM articles WHERE status = 'read' AND read_at IS NOT NULL",
      ),
      this.#binding
        .prepare(
          `SELECT substr(datetime(read_at, '+9 hours'), 1, 10) AS activity_date,
                  COUNT(*) AS read_count
           FROM articles
           WHERE status = 'read' AND read_at >= ? AND read_at < ?
           GROUP BY activity_date
           ORDER BY activity_date`,
        )
        .bind(range.startAt, range.endAtExclusive),
    ]);
    const totalRow = totalResult?.results[0];
    if (totalRow === undefined || dailyResult === undefined) {
      throw new ActivityDataIntegrityError();
    }
    const days: ReadActivityDayCount[] = dailyResult.results.map((row) => {
      if (
        typeof row.activity_date !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/u.test(row.activity_date)
      ) {
        throw new ActivityDataIntegrityError();
      }
      const count = nonNegativeInteger(row.read_count);
      if (count === 0) throw new ActivityDataIntegrityError();
      return { date: row.activity_date, count };
    });
    return { totalReadCount: nonNegativeInteger(totalRow.total_read_count), days };
  }
}

export function createD1ActivityRepository(binding: D1Database): ActivityRepository {
  return new D1ActivityRepository(binding);
}
