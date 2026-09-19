import { describe, expect, it } from "vitest";
import { blocksApiRequest, maintenanceMode } from "./maintenance";

describe("maintenance mode", () => {
  it.each([
    [undefined, "off"],
    ["off", "off"],
    ["read-only", "read-only"],
    ["frozen", "frozen"],
    ["", "frozen"],
    ["OFF", "frozen"],
    [" off ", "frozen"],
    ["typo", "frozen"],
  ])("interprets %s as %s", (value, expected) => {
    expect(maintenanceMode(value === undefined ? {} : { MAINTENANCE_MODE: value })).toBe(expected);
  });

  it.each(["read-only", "frozen", "invalid"])("blocks unsafe methods in %s", (mode) => {
    const bindings = { MAINTENANCE_MODE: mode };
    for (const method of ["GET", "HEAD", "OPTIONS"]) {
      expect(blocksApiRequest(method, bindings)).toBe(false);
    }
    for (const method of ["POST", "PUT", "PATCH", "DELETE", "PROPFIND"]) {
      expect(blocksApiRequest(method, bindings)).toBe(true);
    }
    expect(blocksApiRequest("POST", { MAINTENANCE_MODE: "off" })).toBe(false);
  });
});
