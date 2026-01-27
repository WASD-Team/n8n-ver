const { pbkdf2, randomBytes, randomUUID } = require("node:crypto");
const { promisify } = require("node:util");
const { Pool } = require("pg");

const pbkdf2Async = promisify(pbkdf2);

const PASSWORD_ITERATIONS = 120000;
const PASSWORD_KEYLEN = 64;
const PASSWORD_DIGEST = "sha512";

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = await pbkdf2Async(password, salt, PASSWORD_ITERATIONS, PASSWORD_KEYLEN, PASSWORD_DIGEST);
  return `${PASSWORD_ITERATIONS}:${salt}:${derived.toString("hex")}`;
}

async function main() {
  const email = "test@te.st";
  const name = "Alex";
  const password = "1qw23er4";
  const role = "User";
  const status = "Active";

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set. Define it in web/.env.local.");
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    options: "-c client_encoding=UTF8",
  });

  const passwordHash = await hashPassword(password);
  const id = randomUUID();

  try {
    await pool.query(
      `
      INSERT INTO app_users (id, name, email, role, status, password_hash)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (email)
      DO UPDATE SET name = $2, role = $4, status = $5, password_hash = $6
      `,
      [id, name, email, role, status, passwordHash],
    );
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
