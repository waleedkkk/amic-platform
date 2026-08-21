import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ENCRYPTION_VERSION = "v1";
export const PROVIDER_KEY_CIPHER = "aes-256-gcm";

function getEncryptionKey() {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) throw new Error("مفتاح تشفير الخادم غير متاح حاليًا.");
  return createHash("sha256").update(`amic-ai-provider-key:${secret}`).digest();
}

export function encryptProviderKey(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(PROVIDER_KEY_CIPHER, getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value.trim(), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [ENCRYPTION_VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptProviderKey(value: string) {
  const [version, ivPart, tagPart, ciphertextPart] = value.split(".");
  if (version !== ENCRYPTION_VERSION || !ivPart || !tagPart || !ciphertextPart) {
    throw new Error("صيغة مفتاح الذكاء الاصطناعي المحفوظ غير مدعومة.");
  }
  const decipher = createDecipheriv(PROVIDER_KEY_CIPHER, getEncryptionKey(), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextPart, "base64url")), decipher.final()]).toString("utf8");
}

export function getKeyHint(value: string) {
  const trimmed = value.trim();
  return trimmed.length >= 4 ? `••••${trimmed.slice(-4)}` : "••••";
}
