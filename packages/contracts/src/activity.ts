import {
  TECH_INBOX_ACTIVITY_TIME_ZONE,
  TECH_INBOX_ACTIVITY_WINDOW_DAYS,
} from "@tech-inbox/core/activity";
import { z } from "zod";

export const articleActivityDaySchema = z.strictObject({
  date: z.iso.date(),
  count: z.number().int().nonnegative(),
});

export const articleActivityResponseSchema = z
  .strictObject({
    timeZone: z.literal(TECH_INBOX_ACTIVITY_TIME_ZONE),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    totalReadCount: z.number().int().nonnegative(),
    currentMonthReadCount: z.number().int().nonnegative(),
    currentStreakDays: z.number().int().min(0).max(TECH_INBOX_ACTIVITY_WINDOW_DAYS),
    days: z.array(articleActivityDaySchema).length(TECH_INBOX_ACTIVITY_WINDOW_DAYS),
  })
  .superRefine((activity, context) => {
    if (activity.days[0]?.date !== activity.startDate) {
      context.addIssue({
        code: "custom",
        message: "Activity days must begin on startDate",
        path: ["days", 0, "date"],
      });
    }
    if (activity.days.at(-1)?.date !== activity.endDate) {
      context.addIssue({
        code: "custom",
        message: "Activity days must end on endDate",
        path: ["days", TECH_INBOX_ACTIVITY_WINDOW_DAYS - 1, "date"],
      });
    }
    if (activity.currentMonthReadCount > activity.totalReadCount) {
      context.addIssue({
        code: "custom",
        message: "Current month count must not exceed total read count",
        path: ["currentMonthReadCount"],
      });
    }
  });

export type ArticleActivityDay = z.output<typeof articleActivityDaySchema>;
export type ArticleActivityResponse = z.output<typeof articleActivityResponseSchema>;
