import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { ApiError } from "./errors";

export type AuthPrincipal = {
  readonly subject: string;
  readonly email: string;
  readonly provider: "cloudflare-access";
};

export type AccessAuthBindings = {
  readonly TEAM_DOMAIN?: string;
  readonly POLICY_AUD?: string;
  readonly ALLOWED_EMAIL?: string;
};

export type AccessAuthDependencies = {
  readonly getJwks: (issuer: string) => JWTVerifyGetKey;
};

const jwksByIssuer = new Map<string, JWTVerifyGetKey>();

function normalizeIssuer(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;

  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      !url.hostname.endsWith(".cloudflareaccess.com") ||
      url.username !== "" ||
      url.password !== "" ||
      url.port !== "" ||
      url.pathname !== "/" ||
      url.search !== "" ||
      url.hash !== ""
    ) {
      return undefined;
    }

    return url.origin;
  } catch {
    return undefined;
  }
}

function remoteJwks(issuer: string): JWTVerifyGetKey {
  const existing = jwksByIssuer.get(issuer);
  if (existing !== undefined) return existing;

  const jwks = createRemoteJWKSet(new URL("/cdn-cgi/access/certs", issuer));
  jwksByIssuer.set(issuer, jwks);
  return jwks;
}

const defaultDependencies: AccessAuthDependencies = {
  getJwks: remoteJwks,
};

function requiredConfig(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === "" ? undefined : trimmed;
}

export async function authenticateAccessRequest(
  request: Request,
  bindings: AccessAuthBindings,
  dependencies: AccessAuthDependencies = defaultDependencies,
): Promise<AuthPrincipal> {
  const issuer = normalizeIssuer(bindings.TEAM_DOMAIN);
  const audience = requiredConfig(bindings.POLICY_AUD);
  const allowedEmail = requiredConfig(bindings.ALLOWED_EMAIL);

  if (issuer === undefined || audience === undefined || allowedEmail === undefined) {
    throw new ApiError(403, "FORBIDDEN", "このAPIは現在利用できません。");
  }

  const token = request.headers.get("Cf-Access-Jwt-Assertion")?.trim();
  if (token === undefined || token === "") {
    throw new ApiError(401, "UNAUTHORIZED", "認証が必要です。");
  }

  try {
    const { payload } = await jwtVerify(token, dependencies.getJwks(issuer), {
      algorithms: ["RS256"],
      issuer,
      audience,
    });
    const email = payload.email;

    if (
      typeof payload.exp !== "number" ||
      typeof payload.sub !== "string" ||
      payload.sub === "" ||
      typeof email !== "string" ||
      email !== allowedEmail
    ) {
      throw new Error("Access JWT claims did not match the application policy.");
    }

    return {
      subject: payload.sub,
      email,
      provider: "cloudflare-access",
    };
  } catch {
    throw new ApiError(401, "UNAUTHORIZED", "認証情報を確認できませんでした。");
  }
}
