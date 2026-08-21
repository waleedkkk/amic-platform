import { describe, expect, it } from "vitest";
import type { Request } from "express";
import { getSessionCookieOptions } from "./cookies";

function requestFor(protocol: "http" | "https", forwardedProto?: string): Request {
  return {
    protocol,
    headers: forwardedProto ? { "x-forwarded-proto": forwardedProto } : {},
  } as Request;
}

describe("getSessionCookieOptions", () => {
  it("uses a cross-site secure cookie for HTTPS", () => {
    expect(getSessionCookieOptions(requestFor("https"))).toMatchObject({
      sameSite: "none",
      secure: true,
      httpOnly: true,
    });
  });

  it("uses a browser-valid Lax cookie for plain HTTP", () => {
    expect(getSessionCookieOptions(requestFor("http"))).toMatchObject({
      sameSite: "lax",
      secure: false,
      httpOnly: true,
    });
  });

  it("honors HTTPS reported by a trusted reverse proxy", () => {
    expect(getSessionCookieOptions(requestFor("http", "https"))).toMatchObject({
      sameSite: "none",
      secure: true,
    });
  });
});
