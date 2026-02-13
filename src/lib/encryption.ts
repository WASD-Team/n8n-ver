import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

function getEncryptionKey(): string | null {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    console.warn("ENCRYPTION_KEY not set. Passwords will be stored in plain text (NOT RECOMMENDED for production).");
    return null;
  }
  if (key.length < 32) {
    console.error("ENCRYPTION_KEY must be at least 32 characters long. Passwords will be stored in plain text.");
    return null;
  }
  return key;
}

function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, "sha256");
}

export function encrypt(text: string): string {
  if (!text) return "";

  const masterKey = getEncryptionKey();
  if (!masterKey) {
    // No encryption key - store in plain text with a marker
    return `plain:${text}`;
  }

  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = deriveKey(masterKey, salt);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const tag = cipher.getAuthTag();

  // Format: salt:iv:tag:encrypted
  return `${salt.toString("hex")}:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted}`;
}

export function decrypt(encryptedText: string): string {
  if (!encryptedText) return "";

  try {
    // Check if it's plain text (no encryption)
    if (encryptedText.startsWith("plain:")) {
      return encryptedText.substring(6);
    }

    const masterKey = getEncryptionKey();
    if (!masterKey) {
      console.error("Cannot decrypt: ENCRYPTION_KEY not set");
      return "";
    }

    const parts = encryptedText.split(":");
    if (parts.length !== 4) {
      throw new Error("Invalid encrypted format");
    }

    const salt = Buffer.from(parts[0], "hex");
    const iv = Buffer.from(parts[1], "hex");
    const tag = Buffer.from(parts[2], "hex");
    const encrypted = parts[3];

    const key = deriveKey(masterKey, salt);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (err) {
    console.error("Decryption error:", err);
    throw new Error("Failed to decrypt password. Check ENCRYPTION_KEY.");
  }
}
