import type { MetadataErrorCode } from "@tech-inbox/core/metadata";
import { MAX_URL_LENGTH } from "@tech-inbox/core/url-normalization";

export type FetchUrlValidation =
  | { readonly ok: true; readonly url: URL }
  | { readonly ok: false; readonly errorCode: MetadataErrorCode };

const INTERNAL_HOST_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".lan",
  ".home",
  ".corp",
  ".test",
  ".invalid",
  ".example",
] as const;

function parseIpv4(hostname: string): readonly number[] | null {
  const parts = hostname.split(".");
  if (parts.length !== 4) return null;

  const octets = parts.map(Number);
  return octets.every((part) => Number.isInteger(part) && part >= 0 && part <= 255) ? octets : null;
}

function isUnsafeIpv4(octets: readonly number[]): boolean {
  const [a = -1, b = -1] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51) ||
    (a === 203 && b === 0) ||
    a >= 224
  );
}

function parseIpv6(hostname: string): readonly number[] | null {
  const value = hostname.replace(/^\[|\]$/gu, "").toLowerCase();
  if (!value.includes(":")) return null;

  const halves = value.split("::");
  if (halves.length > 2) return null;

  function groups(part: string): number[] | null {
    if (part === "") return [];
    const result: number[] = [];
    for (const group of part.split(":")) {
      if (group.includes(".")) {
        const ipv4 = parseIpv4(group);
        if (ipv4 === null) return null;
        result.push((ipv4[0] ?? 0) * 256 + (ipv4[1] ?? 0));
        result.push((ipv4[2] ?? 0) * 256 + (ipv4[3] ?? 0));
      } else if (!/^[\da-f]{1,4}$/u.test(group)) {
        return null;
      } else {
        result.push(Number.parseInt(group, 16));
      }
    }
    return result;
  }

  const left = groups(halves[0] ?? "");
  const right = groups(halves[1] ?? "");
  if (left === null || right === null) return null;

  if (halves.length === 1) return left.length === 8 ? left : null;
  const omitted = 8 - left.length - right.length;
  return omitted >= 1 ? [...left, ...Array<number>(omitted).fill(0), ...right] : null;
}

function isUnsafeIpv6(groups: readonly number[]): boolean {
  const [first = -1, second = -1, third = -1, fourth = -1, fifth = -1, sixth = -1] = groups;
  const isIpv4Mapped =
    first === 0 && second === 0 && third === 0 && fourth === 0 && fifth === 0 && sixth === 0xffff;
  if (isIpv4Mapped) {
    const seventh = groups[6] ?? 0;
    const eighth = groups[7] ?? 0;
    return isUnsafeIpv4([seventh >> 8, seventh & 255, eighth >> 8, eighth & 255]);
  }

  const isSpecialPurpose2001 = first === 0x2001 && second < 0x0200;
  const isDocumentation =
    (first === 0x2001 && second === 0x0db8) ||
    (first === 0x3fff && second >= 0 && second <= 0x0fff);
  const isSixToFour = first === 0x2002;
  const isGlobalUnicast = first >= 0x2000 && first <= 0x3fff;
  return !isGlobalUnicast || isSpecialPurpose2001 || isDocumentation || isSixToFour;
}

function isUnsafeHostname(hostname: string): boolean {
  const normalized = hostname
    .replace(/^\[|\]$/gu, "")
    .toLowerCase()
    .replace(/\.$/u, "");
  if (normalized === "localhost") return true;
  if (INTERNAL_HOST_SUFFIXES.some((suffix) => normalized.endsWith(suffix))) return true;

  const ipv4 = parseIpv4(normalized);
  if (ipv4 !== null) return isUnsafeIpv4(ipv4);

  const ipv6 = parseIpv6(normalized);
  if (ipv6 !== null) return isUnsafeIpv6(ipv6);

  return !normalized.includes(".");
}

export function validateFetchUrl(value: string): FetchUrlValidation {
  if (value.trim().length > MAX_URL_LENGTH) {
    return { ok: false, errorCode: "INVALID_URL" };
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, errorCode: "INVALID_URL" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, errorCode: "INVALID_URL" };
  }
  if (url.username !== "" || url.password !== "") {
    return { ok: false, errorCode: "UNSAFE_URL" };
  }

  const port = url.port === "" ? (url.protocol === "http:" ? "80" : "443") : url.port;
  if (port !== "80" && port !== "443") {
    return { ok: false, errorCode: "UNSAFE_URL" };
  }
  if (isUnsafeHostname(url.hostname)) {
    return { ok: false, errorCode: "UNSAFE_URL" };
  }

  return { ok: true, url };
}
