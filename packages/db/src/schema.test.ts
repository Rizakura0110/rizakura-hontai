import { getTableConfig } from "drizzle-orm/sqlite-core/utils";
import { describe, expect, it } from "vitest";
import { daymarkHabits, daymarkHabitVersions, daymarkRecords } from "./schema";

describe("Daymark schema integration", () => {
  it("re-exports only product-prefixed habit tables into the shared migration graph", () => {
    expect(
      [daymarkHabits, daymarkHabitVersions, daymarkRecords].map(
        (table) => getTableConfig(table).name,
      ),
    ).toEqual(["daymark_habits", "daymark_habit_versions", "daymark_records"]);
  });

  it("keeps Daymark relationships internal to the product", () => {
    expect(getTableConfig(daymarkHabitVersions).foreignKeys[0]?.reference().foreignTable).toBe(
      daymarkHabits,
    );
    expect(getTableConfig(daymarkRecords).foreignKeys[0]?.reference().foreignTable).toBe(
      daymarkHabits,
    );
  });
});
