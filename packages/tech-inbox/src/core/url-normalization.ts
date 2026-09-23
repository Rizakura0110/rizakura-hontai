export const MAX_URL_LENGTH = 4096;

export const URL_NORMALIZATION_ERROR_CODES = [
  "INVALID_URL",
  "URL_TOO_LONG",
  "UNSUPPORTED_PROTOCOL",
  "CREDENTIALS_NOT_ALLOWED",
] as const;

export type UrlNormalizationErrorCode = (typeof URL_NORMALIZATION_ERROR_CODES)[number];

declare const normalizedUrlBrand: unique symbol;

export type NormalizedUrl = string & {
  readonly [normalizedUrlBrand]: "NormalizedUrl";
};

export type UrlNormalizationResult =
  | {
      readonly ok: true;
      readonly value: NormalizedUrl;
    }
  | {
      readonly ok: false;
      readonly code: UrlNormalizationErrorCode;
    };

type StandardUrlSearchParams = {
  entries(): IterableIterator<[string, string]>;
};

type StandardUrl = {
  readonly protocol: string;
  readonly username: string;
  readonly password: string;
  hostname: string;
  hash: string;
  pathname: string;
  search: string;
  readonly searchParams: StandardUrlSearchParams;
  readonly href: string;
};

declare const URL: {
  new (input: string): StandardUrl;
};

const TRACKING_PARAMETER_NAMES = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "fbclid",
  "gclid",
  "dclid",
  "mc_cid",
  "mc_eid",
  "_ga",
  "_gl",
]);

type QueryEntry = {
  readonly key: string;
  readonly value: string;
  readonly raw: string;
  readonly originalIndex: number;
};

function compareCodeUnits(left: string, right: string): number {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
}

function compareQueryEntries(left: QueryEntry, right: QueryEntry): number {
  return (
    compareCodeUnits(left.key, right.key) ||
    compareCodeUnits(left.value, right.value) ||
    left.originalIndex - right.originalIndex
  );
}

function isTrackingParameter(name: string): boolean {
  return TRACKING_PARAMETER_NAMES.has(name);
}

function normalizeQuery(url: StandardUrl): void {
  const rawEntries = url.search.slice(1).split("&").filter(Boolean);
  const entries = Array.from(url.searchParams.entries(), ([key, value], originalIndex) => {
    const raw =
      rawEntries[originalIndex] ?? `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;

    return { key, value, raw, originalIndex };
  })
    .filter(({ key }) => !isTrackingParameter(key))
    .sort(compareQueryEntries);

  url.search = entries.length === 0 ? "" : `?${entries.map(({ raw }) => raw).join("&")}`;
}

export function normalizeUrl(input: string): UrlNormalizationResult {
  const trimmedInput = input.trim();

  if (trimmedInput.length > MAX_URL_LENGTH) {
    return { ok: false, code: "URL_TOO_LONG" };
  }

  let url: StandardUrl;

  try {
    url = new URL(trimmedInput);
  } catch {
    return { ok: false, code: "INVALID_URL" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, code: "UNSUPPORTED_PROTOCOL" };
  }

  if (url.username !== "" || url.password !== "") {
    return { ok: false, code: "CREDENTIALS_NOT_ALLOWED" };
  }

  url.hostname = url.hostname.toLowerCase();
  url.hash = "";

  if (url.pathname !== "/" && url.pathname.endsWith("/") && !url.pathname.endsWith("//")) {
    url.pathname = url.pathname.slice(0, -1);
  }

  normalizeQuery(url);

  // This is the only constructor for the brand; every returned value passed all normalization steps.
  return { ok: true, value: url.href as NormalizedUrl };
}
