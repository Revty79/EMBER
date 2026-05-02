import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { getCurrentUser, normalizeUserInput } from "@/lib/auth";
import { createId } from "@/lib/ids";
import { hashPassword } from "@/lib/passwords";

export const runtime = "nodejs";

type CreateUserBody = {
  username?: string;
  name?: string;
  email?: string;
  password?: string;
  role?: "admin" | "user";
};

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (currentUser.role !== "admin") {
    return NextResponse.json({ error: "Only admins can create accounts." }, { status: 403 });
  }

  let body: CreateUserBody;

  try {
    body = (await request.json()) as CreateUserBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const normalized = normalizeUserInput({
    username: typeof body.username === "string" ? body.username : "",
    email: typeof body.email === "string" ? body.email : "",
  });
  const username = normalized.username;
  const email = normalized.email;
  const password = typeof body.password === "string" ? body.password : "";
  const role = body.role === "admin" ? "admin" : "user";

  if (!username || !name || !email || !password) {
    return NextResponse.json(
      { error: "Username, name, email, and password are required." },
      { status: 400 },
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }

  const db = getDb();
  const [existingUser] = await db
    .select({
      id: users.id,
    })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (existingUser) {
    return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
  }

  const [existingEmail] = await db
    .select({
      id: users.id,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingEmail) {
    return NextResponse.json({ error: "A user with that email already exists." }, { status: 409 });
  }

  const now = new Date();
  const passwordHash = await hashPassword(password);

  await db.insert(users).values({
    id: createId(),
    username,
    name,
    email,
    passwordHash,
    role,
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json(
    {
      user: {
        username,
        name,
        email,
        role,
      },
    },
    { status: 201 },
  );
}
