export const PHASE25_DAYMARK_RECORD_COUNT = 10_950;

export function buildLongTermDaymarkBackup({
  exportedAt,
  recordCount = PHASE25_DAYMARK_RECORD_COUNT,
}) {
  if (typeof exportedAt !== "string" || Number.isNaN(Date.parse(exportedAt))) {
    throw new TypeError("exportedAt must be an ISO-compatible timestamp.");
  }
  if (!Number.isInteger(recordCount) || recordCount < 1 || recordCount > 20_000) {
    throw new RangeError("recordCount must be an integer between 1 and 20,000.");
  }

  const habits = Array.from({ length: 10 }, (_, index) => ({
    id: `long-term-habit-${index}`,
    name: `Long-term ${index}`,
    kind: "check",
    createdOn: "2020-01-01",
    createdAt: exportedAt,
    updatedAt: exportedAt,
  }));

  return {
    product: "daymark",
    schemaVersion: 1,
    exportedAt,
    habits,
    habitVersions: habits.map((habit, index) => ({
      id: `long-term-version-${index}`,
      habitId: habit.id,
      effectiveFrom: habit.createdOn,
      kind: "check",
      status: "active",
      targetMilli: null,
      unit: null,
      comparison: null,
      createdAt: exportedAt,
      updatedAt: exportedAt,
    })),
    records: Array.from({ length: recordCount }, (_, index) => ({
      id: `long-term-record-${index}`,
      habitId: habits[index % habits.length].id,
      recordDate: new Date(Date.UTC(2020, 0, 1 + Math.floor(index / habits.length)))
        .toISOString()
        .slice(0, 10),
      kind: "check",
      checked: true,
      valueMilli: null,
      createdAt: exportedAt,
      updatedAt: exportedAt,
    })),
  };
}
