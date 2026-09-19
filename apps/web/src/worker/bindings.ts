import type { MetadataQueueMessage } from "@rizakura-hontai/contracts";
import type { AccessAuthBindings } from "./platform/access-auth";
import type { RateLimitBindings } from "./platform/rate-limit";
import type { MaintenanceBindings } from "./platform/maintenance";

export type AppBindings = Omit<
  CloudflareBindings,
  "ENVIRONMENT" | "APP_ORIGIN" | "TEAM_DOMAIN" | "POLICY_AUD" | "ALLOWED_EMAIL" | "MAINTENANCE_MODE"
> &
  AccessAuthBindings &
  MaintenanceBindings &
  RateLimitBindings & {
    readonly ENVIRONMENT?: string;
    readonly APP_ORIGIN?: string;
    readonly METADATA_QUEUE: Queue<MetadataQueueMessage>;
    readonly METADATA_FETCHER: Fetcher;
  };
