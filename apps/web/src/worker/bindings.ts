import type { MetadataQueueMessage } from "@rizakura-me/contracts";
import type { AccessAuthBindings } from "./platform/access-auth";
import type { RateLimitBindings } from "./platform/rate-limit";

export type AppBindings = Omit<
  CloudflareBindings,
  "ENVIRONMENT" | "APP_ORIGIN" | "TEAM_DOMAIN" | "POLICY_AUD" | "ALLOWED_EMAIL"
> &
  AccessAuthBindings &
  RateLimitBindings & {
    readonly ENVIRONMENT?: string;
    readonly APP_ORIGIN?: string;
    readonly METADATA_QUEUE: Queue<MetadataQueueMessage>;
    readonly METADATA_FETCHER: Fetcher;
  };
