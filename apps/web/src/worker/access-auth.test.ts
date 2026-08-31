import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTVerifyGetKey } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { authenticateAccessRequest, type AccessAuthBindings } from "./platform/access-auth";

const issuer = "https://tech-inbox-test.cloudflareaccess.com";
const audience = "test-access-audience";
const allowedEmail = "owner@example.com";
const subject = "access-user-subject";

const bindings: AccessAuthBindings = {
  TEAM_DOMAIN: issuer,
  POLICY_AUD: audience,
  ALLOWED_EMAIL: allowedEmail,
};

let privateKey: CryptoKey;
let getJwks: (issuer: string) => JWTVerifyGetKey;

beforeAll(async () => {
  const keyPair = await generateKeyPair("RS256", { extractable: true });
  privateKey = keyPair.privateKey;
  const publicJwk = await exportJWK(keyPair.publicKey);
  const jwks = createLocalJWKSet({
    keys: [{ ...publicJwk, alg: "RS256", kid: "test-key", use: "sig" }],
  });
  getJwks = () => jwks;
});

async function token(
  claims: {
    aud?: string;
    email?: string;
    exp?: number;
    iss?: string;
    nbf?: number;
    sub?: string;
  } = {},
): Promise<string> {
  const now = Math.floor(Date.now() / 1_000);
  const jwt = new SignJWT({ email: claims.email ?? allowedEmail })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(claims.iss ?? issuer)
    .setAudience(claims.aud ?? audience)
    .setSubject(claims.sub ?? subject)
    .setIssuedAt(now);

  if (claims.exp !== 0) jwt.setExpirationTime(claims.exp ?? now + 300);
  if (claims.nbf !== undefined) jwt.setNotBefore(claims.nbf);
  return jwt.sign(privateKey);
}

async function authenticate(jwt: string, configuredBindings = bindings) {
  return authenticateAccessRequest(
    new Request("https://inbox.example/api/v1/articles", {
      headers: { "Cf-Access-Jwt-Assertion": jwt },
    }),
    configuredBindings,
    { getJwks },
  );
}

async function expectApiError(promise: Promise<unknown>, status: number, code: string) {
  await expect(promise).rejects.toMatchObject({ status, code });
}

describe("Cloudflare Access JWT authentication", () => {
  it("accepts a valid RS256 JWT and exposes only the internal principal", async () => {
    await expect(authenticate(await token())).resolves.toEqual({
      subject,
      email: allowedEmail,
      provider: "cloudflare-access",
    });
  });

  it("rejects a missing JWT", async () => {
    await expectApiError(
      authenticateAccessRequest(new Request("https://inbox.example/api/v1/articles"), bindings, {
        getJwks,
      }),
      401,
      "UNAUTHORIZED",
    );
  });

  it("rejects an audience mismatch", async () => {
    await expectApiError(authenticate(await token({ aud: "wrong-audience" })), 401, "UNAUTHORIZED");
  });

  it("rejects an issuer mismatch", async () => {
    await expectApiError(
      authenticate(await token({ iss: "https://other.cloudflareaccess.com" })),
      401,
      "UNAUTHORIZED",
    );
  });

  it("rejects an email mismatch", async () => {
    await expectApiError(
      authenticate(await token({ email: "attacker@example.com" })),
      401,
      "UNAUTHORIZED",
    );
  });

  it("rejects a JWT that is not signed with RS256", async () => {
    const now = Math.floor(Date.now() / 1_000);
    const hmacToken = await new SignJWT({ email: allowedEmail })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(issuer)
      .setAudience(audience)
      .setSubject(subject)
      .setIssuedAt(now)
      .setExpirationTime(now + 300)
      .sign(new TextEncoder().encode("local-test-key-that-is-at-least-32-bytes"));

    await expectApiError(authenticate(hmacToken), 401, "UNAUTHORIZED");
  });

  it("rejects expired, not-yet-valid, and expiration-free JWTs", async () => {
    const now = Math.floor(Date.now() / 1_000);
    await expectApiError(authenticate(await token({ exp: now - 1 })), 401, "UNAUTHORIZED");
    await expectApiError(authenticate(await token({ nbf: now + 300 })), 401, "UNAUTHORIZED");
    await expectApiError(authenticate(await token({ exp: 0 })), 401, "UNAUTHORIZED");
  });

  it.each([
    ["missing team domain", { POLICY_AUD: audience, ALLOWED_EMAIL: allowedEmail }],
    ["non-HTTPS team domain", { ...bindings, TEAM_DOMAIN: "http://test.cloudflareaccess.com" }],
    ["non-Access team domain", { ...bindings, TEAM_DOMAIN: "https://example.com" }],
    ["missing audience", { ...bindings, POLICY_AUD: "" }],
    ["missing allowed email", { TEAM_DOMAIN: issuer, POLICY_AUD: audience }],
  ])("fails closed for %s", async (_name, invalidBindings) => {
    await expectApiError(authenticate(await token(), invalidBindings), 403, "FORBIDDEN");
  });
});
