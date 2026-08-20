import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { users } from "../drizzle/schema";
import { getDb } from "./db";

/**
 * Create (or refresh) the platform admin from environment variables.
 *
 * ADMIN_EMAIL + ADMIN_PASSWORD + optional ADMIN_NAME (defaults to "المدير")
 * define a privileged account that is created on boot if it does not exist,
 * and kept as role=admin even if an earlier row used a different role.
 * The password is re-hashed on every boot so rotating ADMIN_PASSWORD works.
 */
export async function seedAdminUser(): Promise<void> {
  const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  const name = (process.env.ADMIN_NAME ?? "المدير").trim();
  if (!email || !password) return;

  if (password.length < 8) {
    console.warn("[Admin seed] ADMIN_PASSWORD must be at least 8 characters; skipping.");
    return;
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Admin seed] database not available; skipping admin creation.");
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    await db
      .update(users)
      .set({ role: "admin", passwordHash: hash, name: name || existing.name })
      .where(eq(users.id, existing.id));
    console.log(`[Admin seed] admin account (${email}) ensured.`);
  } else {
    await db.insert(users).values({
      email,
      passwordHash: hash,
      name,
      loginMethod: "email",
      role: "admin",
    });
    console.log(`[Admin seed] admin account (${email}) created.`);
  }
}
