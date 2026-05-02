import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { users } from "../db/schema";
import { verifyPassword } from "../lib/passwords";

config({ path: ".env.local" });
config();

function readArgValue(flag: string) {
  const args = process.argv.slice(2);
  const index = args.findIndex((value) => value === flag);

  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
}

function normalizeNpmConfigValue(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();

  if (!trimmed || trimmed === "true" || trimmed === "false") {
    return undefined;
  }

  return trimmed;
}

function readCredentials() {
  const args = process.argv.slice(2);
  const positionalArgs = args.filter((value) => !value.startsWith("--"));

  const username =
    readArgValue("--username") ??
    normalizeNpmConfigValue(process.env.npm_config_username) ??
    positionalArgs[0];
  const password =
    readArgValue("--password") ??
    normalizeNpmConfigValue(process.env.npm_config_password) ??
    positionalArgs[1];

  if (!username || !password) {
    throw new Error(
      'Missing args. Use --username "<username>" --password "<password>" (or positional username/password).',
    );
  }

  return {
    username: username.trim().toLowerCase(),
    password,
  };
}

async function main() {
  const { username, password } = readCredentials();
  const db = getDb();

  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      passwordHash: users.passwordHash,
      role: users.role,
    })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  console.log(`Username lookup for "${username}": ${user ? "FOUND" : "NOT FOUND"}`);

  if (!user) {
    console.log("Password check: SKIPPED (user missing)");
    console.log("Result: FAIL");
    process.exit(1);
  }

  const passwordMatches = await verifyPassword(password, user.passwordHash);

  console.log(`Password check: ${passwordMatches ? "PASS" : "FAIL"}`);
  console.log(`Role: ${user.role}`);
  console.log(`Result: ${passwordMatches ? "PASS" : "FAIL"}`);

  process.exit(passwordMatches ? 0 : 1);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Auth test failed to run: ${message}`);
  process.exit(1);
});
