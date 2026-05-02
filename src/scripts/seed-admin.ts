import { config } from "dotenv";
import { eq, or } from "drizzle-orm";
import { getDb } from "../db/client";
import { users } from "../db/schema";
import { createId } from "../lib/ids";
import { hashPassword } from "../lib/passwords";

config({ path: ".env.local" });
config();

type CliArgs = {
  username?: string;
  name?: string;
  email?: string;
  password?: string;
};

function readArgValue(flag: string) {
  const args = process.argv.slice(2);
  const index = args.findIndex((value) => value === flag);

  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
}

function readSeedArgs(): Required<CliArgs> {
  const name = readArgValue("--name") ?? process.env.ADMIN_NAME;
  const username = readArgValue("--username") ?? process.env.ADMIN_USERNAME;
  const email = readArgValue("--email") ?? process.env.ADMIN_EMAIL;
  const password = readArgValue("--password") ?? process.env.ADMIN_PASSWORD;

  if (!username || !name || !email || !password) {
    throw new Error(
      "Missing required values. Provide --username, --name, --email, --password (or ADMIN_USERNAME, ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD).",
    );
  }

  return {
    username: username.trim().toLowerCase(),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    password,
  };
}

async function main() {
  const { username, name, email, password } = readSeedArgs();
  const db = getDb();
  const passwordHash = await hashPassword(password);
  const now = new Date();

  const [existingUser] = await db
    .select({
      id: users.id,
    })
    .from(users)
    .where(or(eq(users.username, username), eq(users.email, email)))
    .limit(1);

  if (existingUser) {
    await db
      .update(users)
      .set({
        username,
        name,
        email,
        role: "admin",
        passwordHash,
        updatedAt: now,
      })
      .where(eq(users.id, existingUser.id));

    console.log(`Updated existing admin user: ${username} (${email})`);
    return;
  }

  await db.insert(users).values({
    id: createId(),
    username,
    name,
    email,
    passwordHash,
    role: "admin",
    createdAt: now,
    updatedAt: now,
  });

  console.log(`Created admin user: ${username} (${email})`);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to seed admin user: ${message}`);
    process.exit(1);
  });
