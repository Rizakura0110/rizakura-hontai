export type MaintenanceBindings = {
  readonly MAINTENANCE_MODE?: string;
};

export const MAINTENANCE_RETRY_SECONDS = 60;

// Missing is compatible with older local fixtures. Explicit but invalid values
// fail closed; only an exact "off" may intentionally reopen writes.
export function maintenanceMode(bindings: MaintenanceBindings): "off" | "read-only" | "frozen" {
  const mode = bindings.MAINTENANCE_MODE;
  if (mode === undefined || mode === "off") return "off";
  return mode === "read-only" ? "read-only" : "frozen";
}

export function blocksApiRequest(method: string, bindings: MaintenanceBindings): boolean {
  return (
    maintenanceMode(bindings) !== "off" &&
    method !== "GET" &&
    method !== "HEAD" &&
    method !== "OPTIONS"
  );
}
