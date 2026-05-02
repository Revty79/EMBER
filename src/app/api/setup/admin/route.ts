import { eq, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createSession, attachSessionCookie, hasAnyUsers, normalizeUserInput } from "@/lib/auth";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { hashPassword } from "@/lib/passwords";
import { createId } from "@/lib/ids";

export const runtime = "nodejs";

type SetupAdminBody = {
  username?: string;
  name?: string;
  email?: string;
  password?: string;
};

export async function POST(request: Request) {
  if (await hasAnyUsers()) {
    return NextResponse.json(
      {
        error: "Initial setup is closed because an account already exists.",
      },
      { status: 403 },
    );
  }

  let body: SetupAdminBody;

  try {
    body = (await request.json()) as SetupAdminBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const normalized = normalizeUserInput({
    username: typeof body.username === "string" ? body.username : "",
    email: typeof body.email === "string" ? body.email : "",
  });
  const username = normalized.username;
  const email = normalized.email;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!username || !name || !email || !password) {
    return NextResponse.json(
      {
        error: "Username, name, email, and password are required.",
      },
      { status: 400 },
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      {
        error: "Password must be at least 8 characters.",
      },
      { status: 400 },
    );
  }

  const db = getDb();
  const [existingUser] = await db
    .select({
      id: users.id,
    })
    .from(users)
    .where(or(eq(users.username, username), eq(users.email, email)))
    .limit(1);

  if (existingUser) {
    return NextResponse.json(
      {
        error: "Username or email already exists.",
      },
      { status: 409 },
    );
  }

  const userId = createId();
  const passwordHash = await hashPassword(password);
  const now = new Date();

  await db.insert(users).values({
    id: userId,
    username,
    name,
    email,
    passwordHash,
    role: "admin",
    createdAt: now,
    updatedAt: now,
  });

  const session = await createSession(userId);
  const response = NextResponse.json(
    {
      user: {
        id: userId,
        username,
        name,
        email,
        role: "admin" as const,
      },
    },
    { status: 201 },
  );

  attachSessionCookie(response, session.token, session.expiresAt, request);
  return response;
}
