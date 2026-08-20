import bcrypt from "bcryptjs";
import { parse as parseCookieHeader } from "cookie";
import { eq, or } from "drizzle-orm";
import type { Request } from "express";
import { createHmac } from "crypto";
import { COOKIE_NAME } from "@shared/const";
import { users, type User } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { getSessionCookieOptions } from "./_core/cookies";
import { getDb } from "./db";

async function requireDb() {
  const database = await getDb();
  if (!database) throw new AuthError("not_signed_in", "قاعدة البيانات غير متاحة حاليًا");
  return database;
}

export { COOKIE_NAME };

const MIN_PASSWORD_LENGTH = 8;

export class AuthError extends Error {
  code: "invalid_email" | "email_taken" | "weak_password" | "wrong_password" | "not_signed_in";
  constructor(code: AuthError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

function validateEmail(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  if (normalized.length > 320) return "البريد الإلكتروني طويل جدًا";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized)) return "صيغة البريد الإلكتروني غير صحيحة";
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH)
    return `كلمة المرور يجب أن تكون ${MIN_PASSWORD_LENGTH} أحرف على الأقل`;
  if (password.length > 128) return "كلمة المرور طويلة جدًا";
  return null;
}

function readAuthCookieValue(req: Request): string | null {
  const raw = parseCookieHeader(req.headers.cookie ?? "")[COOKIE_NAME] ?? null;
  if (!raw) return null;
  // The token may arrive wrapped in JSON if the legacy SDK wrote it; accept a
  // plain string token directly.
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.token === "string") return parsed.token;
  } catch {
    // not JSON — treat as raw token
  }
  return typeof raw === "string" ? raw : null;
}

/** Local session token = base64(userId:email:random) signed by JWT_SECRET via HMAC. */
export function mintSessionToken(user: { id: number; email: string | null }): string {
  const secret = ENV.cookieSecret || process.env.JWT_SECRET || "amic-local-secret";
  const random = crypto.randomUUID().replaceAll("-", "");
  const payload = `${user.id}:${user.email ?? ""}:${random}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex").slice(0, 16);
  return Buffer.from(`${payload}:${sig}`, "utf8").toString("base64url");
}

export function verifySessionToken(token: string): { id: number; email: string } | null {
  const secret = ENV.cookieSecret || process.env.JWT_SECRET || "amic-local-secret";
  let decoded: string;
  try {
    decoded = Buffer.from(token, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const lastColon = decoded.lastIndexOf(":");
  if (lastColon < 0) return null;
  const payload = decoded.slice(0, lastColon);
  const sig = decoded.slice(lastColon + 1);
  const expected = createHmac("sha256", secret).update(payload).digest("hex").slice(0, 16);
  if (sig.length !== 16 || sig !== expected) return null;
  const parts = payload.split(":");
  if (parts.length !== 3) return null;
  const id = Number(parts[0]);
  if (!Number.isFinite(id)) return null;
  return { id, email: parts[1] };
}

export async function createUserWithEmail(
  email: string,
  password: string,
  name?: string | null
): Promise<User> {
  const emailError = validateEmail(email);
  if (emailError) throw new AuthError("invalid_email", emailError);
  const passwordError = validatePassword(password);
  if (passwordError) throw new AuthError("weak_password", passwordError);

  const normalized = email.trim().toLowerCase();
  const existing = await (await requireDb()).select().from(users).where(eq(users.email, normalized)).limit(1);
  if (existing.length > 0) throw new AuthError("email_taken", "هذا البريد الإلكتروني مستخدم بالفعل");

  const hash = await bcrypt.hash(password, 12);
  const [inserted] = await (await requireDb())
    .insert(users)
    .values({
      email: normalized,
      passwordHash: hash,
      name: name?.trim() || null,
      loginMethod: "email",
    })
    .$returningId();

  const [user] = await (await requireDb()).select().from(users).where(eq(users.id, inserted.id)).limit(1);
  if (!user) throw new AuthError("not_signed_in", "تعذّر إنشاء الحساب");
  return user;
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const normalized = email.trim().toLowerCase();
  const [user] = await (await requireDb())
    .select()
    .from(users)
    .where(or(eq(users.email, normalized), eq(users.openId, normalized)))
    .limit(1);
  if (!user) throw new AuthError("wrong_password", "البريد الإلكتروني أو كلمة المرور غير صحيحة");

  const hash = user.passwordHash;
  if (!hash) {
    // Legacy OAuth-created users have no password — ask them to set one first.
    throw new AuthError(
      "wrong_password",
      "هذا الحساب مسجّل عبر طريقة دخول أخرى. أعد ضبط كلمة المرور أولًا أو سجّل الدخول بالطريقة السابقة."
    );
  }
  const ok = await bcrypt.compare(password, hash);
  if (!ok) throw new AuthError("wrong_password", "البريد الإلكتروني أو كلمة المرور غير صحيحة");

  await (await requireDb()).update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));
  return user;
}

export function setSessionCookie(
  req: Request,
  res: { cookie: (name: string, value: string, opts: object) => void },
  user: { id: number; email: string | null }
): void {
  const cookieOptions = getSessionCookieOptions(req);
  res.cookie(COOKIE_NAME, mintSessionToken(user), {
    ...cookieOptions,
    maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
  });
}

export function clearSessionCookie(
  req: Request,
  res: { clearCookie: (name: string, opts: object) => void }
): void {
  const cookieOptions = getSessionCookieOptions(req);
  res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
}

/** Look up the user matching the session token (if any). */
export async function resolveSessionUser(req: Request): Promise<User | null> {
  const token = readAuthCookieValue(req);
  if (!token) return null;
  const parsed = verifySessionToken(token);
  if (!parsed) return null;
  const [user] = await (await requireDb()).select().from(users).where(eq(users.id, parsed.id)).limit(1);
  if (!user) return null;
  // Email mismatch → token forged after email change.
  if (user.email && user.email.toLowerCase() !== parsed.email.toLowerCase()) return null;
  return user;
}
