import { describe, expect, it } from "vitest";
import {
  isUnsafeHostname,
  isUnsafeIpv4,
  isUnsafeIpv6,
  parseIpv4,
  parseIpv6,
  validateFetchUrl,
} from "./url-policy";

describe("IP address parsing", () => {
  it("parses strict IPv4 octets and rejects malformed forms", () => {
    expect(parseIpv4("8.8.8.8")).toEqual([8, 8, 8, 8]);
    expect(parseIpv4("1.2.3")).toBeNull();
    expect(parseIpv4("1.2.3.999")).toBeNull();
    expect(parseIpv4("1.2.3.nope")).toBeNull();
  });

  it("parses full, compressed, and IPv4-embedded IPv6 forms defensively", () => {
    expect(parseIpv6("2606:4700:4700:0000:0000:0000:0000:1111")).toHaveLength(8);
    expect(parseIpv6("::ffff:127.0.0.1")).toEqual([0, 0, 0, 0, 0, 0xffff, 0x7f00, 1]);
    expect(parseIpv6("8.8.8.8")).toBeNull();
    expect(parseIpv6("1::2::3")).toBeNull();
    expect(parseIpv6("1:2:3:4:5:6:7")).toBeNull();
    expect(parseIpv6("1:2:3:4:5:6:7:8::")).toBeNull();
    expect(parseIpv6("::ffff:999.0.0.1")).toBeNull();
    expect(parseIpv6("::gggg")).toBeNull();
  });

  it("classifies incomplete and public address groups without unsafe defaults", () => {
    expect(isUnsafeIpv4([])).toBe(false);
    expect(isUnsafeIpv4([100])).toBe(false);
    expect(isUnsafeIpv6([])).toBe(true);
    expect(isUnsafeIpv6([0, 0, 0, 0, 0, 0xffff])).toBe(true);
    expect(isUnsafeIpv6([0, 0, 0, 0, 0, 0xffff, 0x0808, 0x0808])).toBe(false);
    expect(isUnsafeHostname("service")).toBe(true);
    expect(isUnsafeHostname("public.example.org")).toBe(false);
  });
});

describe("validateFetchUrl", () => {
  it.each([
    "",
    "not a URL",
    "file:///etc/passwd",
    "javascript:alert(1)",
    "http://localhost/",
    "http://LOCALHOST./",
    "http://api.local/",
    "http://service.internal/",
    "http://printer/",
    "http://0.0.0.0/",
    "http://10.0.0.1/",
    "http://127.0.0.1/",
    "http://100.64.0.1/",
    "http://100.127.255.254/",
    "http://169.254.169.254/latest/meta-data/",
    "http://172.16.1.2/",
    "http://172.31.255.254/",
    "http://192.0.2.1/",
    "http://192.168.1.2/",
    "http://198.18.0.1/",
    "http://198.19.255.254/",
    "http://198.51.100.1/",
    "http://203.0.113.1/",
    "http://224.0.0.1/",
    "http://255.255.255.255/",
    "http://[::]/",
    "http://[::1]/",
    "http://[fc00::1]/",
    "http://[fe80::1]/",
    "http://[ff00::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://[2001:0001::1]/",
    "http://[2001:db8::1]/",
    "http://[2002:7f00:1::]/",
    "http://[3fff::1]/",
    "http://example.com:8080/",
    "https://user:password@example.com/",
  ])("rejects unsafe destination %s", (url) => {
    expect(validateFetchUrl(url).ok).toBe(false);
  });

  it("rejects a URL beyond the application length limit before parsing", () => {
    expect(validateFetchUrl(`https://example.org/${"a".repeat(5_000)}`)).toEqual({
      ok: false,
      errorCode: "INVALID_URL",
    });
  });

  it.each([
    "https://example.org/article",
    "https://example.org:443/article",
    "http://8.8.8.8/",
    "http://11.0.0.1/",
    "http://100.63.255.255/",
    "http://172.15.255.255/",
    "http://172.32.0.1/",
    "http://198.17.255.255/",
    "http://199.1.1.1/",
    "https://[2606:4700::1111]/",
    "https://[::ffff:8.8.8.8]/",
  ])("allows a public HTTP destination %s", (url) => {
    expect(validateFetchUrl(url)).toMatchObject({ ok: true });
  });
});
