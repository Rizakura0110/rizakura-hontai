import type { DaymarkClient } from "@rizakura-hontai/daymark/app";
import {
  daymarkBackupImportPreviewResponseSchema,
  daymarkBackupImportResponseSchema,
  type DaymarkBackupSnapshot,
  daymarkBackupSnapshotSchema,
  dayResponseSchema,
  deleteHabitRecordResponseSchema,
  habitResponseSchema,
  listHabitsResponseSchema,
  monthResponseSchema,
  weekResponseSchema,
} from "@rizakura-hontai/daymark/contracts";
import { apiFetch, assertSuccess } from "../platform/http";

const daymarkApi = "/api/v1/daymark";

function habitPath(id: string): string {
  return `${daymarkApi}/habits/${encodeURIComponent(id)}`;
}

export const daymarkClient: DaymarkClient = {
  async exportBackup(signal) {
    const response = await apiFetch(`${daymarkApi}/export`, {}, signal);
    return daymarkBackupSnapshotSchema.parse(await assertSuccess(response));
  },
  async previewBackup(backup: DaymarkBackupSnapshot, signal) {
    const response = await apiFetch(
      `${daymarkApi}/import/preview`,
      { method: "POST", body: JSON.stringify({ backup }) },
      signal,
    );
    return daymarkBackupImportPreviewResponseSchema.parse(await assertSuccess(response));
  },
  async importBackup(backup: DaymarkBackupSnapshot, signal) {
    const response = await apiFetch(
      `${daymarkApi}/import`,
      { method: "POST", body: JSON.stringify({ backup }) },
      signal,
    );
    return daymarkBackupImportResponseSchema.parse(await assertSuccess(response));
  },
  async listHabits(signal) {
    const response = await apiFetch(`${daymarkApi}/habits`, {}, signal);
    return listHabitsResponseSchema.parse(await assertSuccess(response));
  },
  async createHabit(request, signal) {
    const response = await apiFetch(
      `${daymarkApi}/habits`,
      { method: "POST", body: JSON.stringify(request) },
      signal,
    );
    return habitResponseSchema.parse(await assertSuccess(response)).habit;
  },
  async renameHabit(id, name, signal) {
    const response = await apiFetch(
      habitPath(id),
      { method: "PATCH", body: JSON.stringify({ name }) },
      signal,
    );
    return habitResponseSchema.parse(await assertSuccess(response)).habit;
  },
  async putConfiguration(id, date, request, signal) {
    const response = await apiFetch(
      `${habitPath(id)}/configurations/${encodeURIComponent(date)}`,
      { method: "PUT", body: JSON.stringify(request) },
      signal,
    );
    return habitResponseSchema.parse(await assertSuccess(response)).habit;
  },
  async getDay(date, signal) {
    const query = new URLSearchParams({ date });
    const response = await apiFetch(`${daymarkApi}/day?${query.toString()}`, {}, signal);
    return dayResponseSchema.parse(await assertSuccess(response));
  },
  async putRecord(id, date, request, signal) {
    const response = await apiFetch(
      `${habitPath(id)}/records/${encodeURIComponent(date)}`,
      { method: "PUT", body: JSON.stringify(request) },
      signal,
    );
    return dayResponseSchema.parse(await assertSuccess(response));
  },
  async deleteRecord(id, date, signal) {
    const response = await apiFetch(
      `${habitPath(id)}/records/${encodeURIComponent(date)}`,
      { method: "DELETE", body: "{}" },
      signal,
    );
    deleteHabitRecordResponseSchema.parse(await assertSuccess(response));
  },
  async getWeek(start, signal) {
    const query = new URLSearchParams({ start });
    const response = await apiFetch(`${daymarkApi}/history/week?${query.toString()}`, {}, signal);
    return weekResponseSchema.parse(await assertSuccess(response));
  },
  async getMonth(month, signal) {
    const query = new URLSearchParams({ month });
    const response = await apiFetch(`${daymarkApi}/history/month?${query.toString()}`, {}, signal);
    return monthResponseSchema.parse(await assertSuccess(response));
  },
};
