import { pbkdf2, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const pbkdf2Async = promisify(pbkdf2);

const PASSWORD_ITERATIONS = 120000;
const PASSWORD_KEYLEN = 64;
const PASSWORD_DIGEST = "sha512";

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = await pbkdf2Async(password, salt, PASSWORD_ITERATIONS, PASSWORD_KEYLEN, PASSWORD_DIGEST);
  return `${PASSWORD_ITERATIONS}:${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [iterationsRaw, salt, hash] = storedHash.split(":");
  const iterations = Number(iterationsRaw);
  if (!iterations || !salt || !hash) return false;
  const derived = await pbkdf2Async(password, salt, iterations, PASSWORD_KEYLEN, PASSWORD_DIGEST);
  const expected = Buffer.from(hash, "hex");
  if (expected.length !== derived.length) return false;
  return timingSafeEqual(expected, derived);
}
