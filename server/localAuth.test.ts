import { afterEach, describe, expect, it } from "vitest";
import { getSessionTokenFromRequest, mintSessionToken, verifySessionToken, validatePassword } from "./localAuth";

const originalJwtSecret = process.env.JWT_SECRET;

afterEach(() => {
  if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalJwtSecret;
});

describe("local session token roundtrip", () => {
  const user = { id: 42, email: "user@example.com" };

  it("mints and verifies a token for the issuing user", () => {
    const token = mintSessionToken(user);
    expect(token).toBeTruthy();
    const parsed = verifySessionToken(token);
    expect(parsed).toEqual({ id: user.id, email: user.email });
  });

  it("rejects a tampered signature", () => {
    const token = mintSessionToken(user);
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const [payload, sig] = decoded.split(":");
    const tampered = Buffer.from(`${payload}:${sig.split("").reverse().join("")}`, "utf8").toString("base64url");
    expect(verifySessionToken(tampered)).toBeNull();
  });

  it("rejects tokens signed for a different user", () => {
    const other = mintSessionToken({ id: 99, email: "other@example.com" });
    expect(verifySessionToken(other)?.id).toBe(99);
  });

  it("rejects malformed tokens", () => {
    expect(verifySessionToken("not-base64!!!")).toBeNull();
    expect(verifySessionToken("")).toBeNull();
  });

  it("fails closed when the signing secret is absent", () => {
    delete process.env.JWT_SECRET;
    expect(() => mintSessionToken(user)).toThrow("JWT_SECRET is required");
  });
});

describe("validatePassword", () => {
  it("accepts valid passwords and rejects weak ones", () => {
    expect(validatePassword("")).toBe("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
    expect(validatePassword("123")).toBe("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
    expect(validatePassword("short")).toBe("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
    expect(validatePassword("Abcdef1234")).toBeNull();
  });
});

describe("getSessionTokenFromRequest", () => {
  it("يستخرج قيمة جلسة محلية موقعة من كوكي الطلب دون تفسيرها", () => {
    const token = "signed-session-token";
    const req = { headers: { cookie: `theme=dark; app_session_id=${token}` } };
    expect(getSessionTokenFromRequest(req as never)).toBe(token);
  });

  it("يدعم كوكي الجلسة المغلف في JSON ولا يعيد قيمة عند غيابه", () => {
    const wrapped = encodeURIComponent(JSON.stringify({ token: "wrapped-token" }));
    expect(getSessionTokenFromRequest({ headers: { cookie: `app_session_id=${wrapped}` } } as never)).toBe("wrapped-token");
    expect(getSessionTokenFromRequest({ headers: {} } as never)).toBeNull();
  });
});
