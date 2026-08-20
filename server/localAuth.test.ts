import { describe, expect, it } from "vitest";
import { mintSessionToken, verifySessionToken, validatePassword } from "./localAuth";

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
});

describe("validatePassword", () => {
  it("accepts valid passwords and rejects weak ones", () => {
    expect(validatePassword("")).toBe("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
    expect(validatePassword("123")).toBe("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
    expect(validatePassword("short")).toBe("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
    expect(validatePassword("Abcdef1234")).toBeNull();
  });
});
