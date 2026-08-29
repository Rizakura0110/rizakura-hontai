import { describe, expect, it } from "vitest";
import {
  assertHealthyProductionState,
  normalizeQueueMetrics,
  summarizeQueueOperationGroups,
  summarizeWorkerInvocationGroups,
} from "./cloudflare-health-assertions.mjs";

describe("Cloudflare production health assertions", () => {
  it("normalizes realtime Queue metrics", () => {
    expect(normalizeQueueMetrics({ backlog_bytes: 851, backlog_count: 7 }, "DLQ")).toEqual({
      backlogBytes: 851,
      backlogCount: 7,
    });
  });

  it("rejects missing or invalid Queue metrics", () => {
    expect(() => normalizeQueueMetrics({ backlog_bytes: 0 }, "Queue")).toThrow();
    expect(() => normalizeQueueMetrics({ backlog_bytes: 0, backlog_count: -1 }, "Queue")).toThrow();
  });

  it("summarizes only terminal Queue delivery outcomes", () => {
    expect(
      summarizeQueueOperationGroups([
        { count: 4, dimensions: { actionType: "ReadMessage", outcome: "" } },
        { count: 2, dimensions: { actionType: "DeleteMessage", outcome: "success" } },
        { count: 1, dimensions: { actionType: "DeleteMessage", outcome: "dlq" } },
        { count: 3, dimensions: { actionType: "DeleteMessage", outcome: "fail" } },
      ]),
    ).toEqual({ dlqDeliveries: 1, failedDeliveries: 3 });
  });

  it("summarizes Worker requests, errors, and statuses", () => {
    expect(
      summarizeWorkerInvocationGroups(
        [
          { dimensions: { status: "success" }, sum: { errors: 0, requests: 4 } },
          { dimensions: { status: "exception" }, sum: { errors: 1, requests: 1 } },
        ],
        "app",
      ),
    ).toEqual({
      errors: 1,
      nonSuccessRequests: 1,
      requests: 5,
      scriptName: "app",
      statuses: { exception: 1, success: 4 },
    });
  });

  it("accepts an empty main Queue and successful Workers", () => {
    expect(() =>
      assertHealthyProductionState({
        mainQueue: { backlogBytes: 0, backlogCount: 0 },
        recentQueueOperations: { dlqDeliveries: 0, failedDeliveries: 0 },
        workers: [
          {
            errors: 0,
            nonSuccessRequests: 0,
            requests: 10,
            scriptName: "app",
            statuses: { success: 10 },
          },
        ],
      }),
    ).not.toThrow();
  });

  it.each([
    ["main Queue backlog", { mainQueue: { backlogBytes: 100, backlogCount: 1 } }],
    ["new DLQ delivery", { recentQueueOperations: { dlqDeliveries: 1, failedDeliveries: 0 } }],
    ["Queue failure", { recentQueueOperations: { dlqDeliveries: 0, failedDeliveries: 1 } }],
    [
      "Worker error",
      {
        workers: [
          {
            errors: 1,
            nonSuccessRequests: 0,
            requests: 1,
            scriptName: "app",
            statuses: { success: 1 },
          },
        ],
      },
    ],
    [
      "non-success Worker invocation",
      {
        workers: [
          {
            errors: 0,
            nonSuccessRequests: 1,
            requests: 1,
            scriptName: "app",
            statuses: { exception: 1 },
          },
        ],
      },
    ],
  ])("rejects %s", (_label, override) => {
    expect(() =>
      assertHealthyProductionState({
        mainQueue: { backlogBytes: 0, backlogCount: 0 },
        recentQueueOperations: { dlqDeliveries: 0, failedDeliveries: 0 },
        workers: [],
        ...override,
      }),
    ).toThrow();
  });
});
