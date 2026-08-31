import { CONTRACT_LIMITS, type FetchedMetadata } from "@rizakura-hontai/contracts";

export type RawMetadata = {
  title: string;
  ogTitle: string | null;
  twitterTitle: string | null;
  description: string | null;
  ogDescription: string | null;
  siteName: string | null;
  canonicalUrl: string | null;
  faviconUrl: string | null;
  imageUrl: string | null;
  publishedAt: string | null;
};

function sanitizeText(value: string | null, limit: number): string | null {
  if (value === null) return null;
  const withoutControls = Array.from(value, (character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint < 32 || (codePoint >= 127 && codePoint <= 159) ? " " : character;
  }).join("");
  const sanitized = withoutControls.replace(/\s+/gu, " ").trim().slice(0, limit);
  return sanitized === "" ? null : sanitized;
}

function safeAbsoluteHttpUrl(value: string | null, baseUrl: string): string | null {
  const sanitized = sanitizeText(value, CONTRACT_LIMITS.url);
  if (sanitized === null) return null;
  try {
    const url = new URL(sanitized, baseUrl);
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username !== "" ||
      url.password !== "" ||
      url.href.length > CONTRACT_LIMITS.url
    ) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

function utcTimestamp(value: string | null): string | null {
  const sanitized = sanitizeText(value, 100);
  if (sanitized === null) return null;
  const date = new Date(sanitized);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function selectMetadata(raw: RawMetadata, finalUrl: string): FetchedMetadata {
  const title =
    sanitizeText(raw.ogTitle, CONTRACT_LIMITS.title) ??
    sanitizeText(raw.twitterTitle, CONTRACT_LIMITS.title) ??
    sanitizeText(raw.title, CONTRACT_LIMITS.title) ??
    finalUrl.slice(0, CONTRACT_LIMITS.title);

  return {
    title,
    description:
      sanitizeText(raw.ogDescription, CONTRACT_LIMITS.description) ??
      sanitizeText(raw.description, CONTRACT_LIMITS.description),
    siteName: sanitizeText(raw.siteName, CONTRACT_LIMITS.siteName),
    canonicalUrl: safeAbsoluteHttpUrl(raw.canonicalUrl, finalUrl),
    faviconUrl: safeAbsoluteHttpUrl(raw.faviconUrl, finalUrl),
    imageUrl: safeAbsoluteHttpUrl(raw.imageUrl, finalUrl),
    publishedAt: utcTimestamp(raw.publishedAt),
  };
}

export async function parseHtmlMetadata(
  response: Response,
  finalUrl: string,
): Promise<FetchedMetadata> {
  const raw: RawMetadata = {
    title: "",
    ogTitle: null,
    twitterTitle: null,
    description: null,
    ogDescription: null,
    siteName: null,
    canonicalUrl: null,
    faviconUrl: null,
    imageUrl: null,
    publishedAt: null,
  };

  const readContent = (assign: (content: string) => void) => ({
    element(element: Element) {
      assign(element.getAttribute("content") ?? "");
    },
  });
  const readHref = (assign: (href: string) => void) => ({
    element(element: Element) {
      assign(element.getAttribute("href") ?? "");
    },
  });

  const transformed = new HTMLRewriter()
    .on("title", {
      text(text) {
        if (raw.title.length <= CONTRACT_LIMITS.title) raw.title += text.text;
      },
    })
    .on(
      'meta[property="og:title"]',
      readContent((value) => (raw.ogTitle ??= value)),
    )
    .on(
      'meta[name="twitter:title"]',
      readContent((value) => (raw.twitterTitle ??= value)),
    )
    .on(
      'meta[property="og:description"]',
      readContent((value) => (raw.ogDescription ??= value)),
    )
    .on(
      'meta[name="description"]',
      readContent((value) => (raw.description ??= value)),
    )
    .on(
      'meta[property="og:site_name"]',
      readContent((value) => (raw.siteName ??= value)),
    )
    .on(
      'meta[property="og:image"]',
      readContent((value) => (raw.imageUrl ??= value)),
    )
    .on(
      'link[rel="canonical"]',
      readHref((value) => (raw.canonicalUrl ??= value)),
    )
    .on(
      'link[rel~="icon"]',
      readHref((value) => (raw.faviconUrl ??= value)),
    )
    .on(
      'meta[property="article:published_time"]',
      readContent((value) => (raw.publishedAt ??= value)),
    )
    .on(
      'meta[name="date"]',
      readContent((value) => (raw.publishedAt ??= value)),
    )
    .transform(response);

  await transformed.text();
  return selectMetadata(raw, finalUrl);
}
