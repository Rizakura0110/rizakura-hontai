import { describe, expect, it } from "vitest";
import { validateFetchUrl } from "./url-policy";

describe("validateFetchUrl", () => {
  it.each([
    "file:///etc/passwd",
    "javascript:alert(1)",
    "http://localhost/",
    "http://api.local/",
    "http://service.internal/",
    "http://10.0.0.1/",
    "http://127.0.0.1/",
    "http://169.254.169.254/latest/meta-data/",
    "http://172.16.1.2/",
    "http://192.168.1.2/",
    "http://[::1]/",
    "http://[fc00::1]/",
    "http://[fe80::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://[2001:db8::1]/",
    "http://[2002:7f00:1::]/",
    "http://[3fff::1]/",
    "http://example.com:8080/",
    "https://user:password@example.com/",
  ])("rejects unsafe destination %s", (url) => {
    expect(validateFetchUrl(url).ok).toBe(false);
  });

  it.each(["https://example.org/article", "http://8.8.8.8/", "https://[2606:4700::1111]/"])(
    "allows a public HTTP destination %s",
    (url) => {
      expect(validateFetchUrl(url)).toMatchObject({ ok: true });
    },
  );
});
