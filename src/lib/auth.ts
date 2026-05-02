import { createHmac, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { sessions, users } from "@/db/schema";
import { createId } from "@/lib/ids";
import { verifyPassword } from "@/lib/passwords";
import { requireEnv } from "@/lib/env";

const SESSION_COOKIE_NAME = "ember_session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30;

export type AuthenticatedUser = {
  id: string;
  username: string;
  name: string;
  email: string;
  role: "admin" | "user";
};

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function hashSessionToken(token: string) {
  const appSecret = requireEnv("APP_SECRET");
  return createHmac("sha256", appSecret).update(token).digest("hex");
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

export async function findUserByUsername(username: string) {
  const db = getDb();
  const normalizedUsername = normalizeUsername(username);

  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      name: users.name,
      email: users.email,
      passwordHash: users.passwordHash,
      role: users.role,
    })
    .from(users)
    .where(eq(users.username, normalizedUsername))
    .limit(1);

  return user ?? null;
}

export async function validateCredentials(username: string, password: string) {
  const user = await findUserByUsername(username);

  if (!user) {
    return null;
  }

  const isValidPassword = await verifyPassword(password, user.passwordHash);

  if (!isValidPassword) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    role: user.role,
  } satisfies AuthenticatedUser;
}

export function normalizeUserInput(input: { username?: string; email?: string }) {
  return {
    username: input.username ? normalizeUsername(input.username) : "",
    email: input.email ? normalizeEmail(input.email) : "",
  };
}

export async function createSession(userId: string) {
  const db = getDb();
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await db.insert(sessions).values({
    id: createId(),
    userId,
    tokenHash,
    expiresAt,
  });

  return { token, expiresAt };
}

export function attachSessionCookie(response: NextResponse, token: string, expiresAt: Date) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction(),
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction(),
    path: "/",
    expires: new Date(0),
  });
}

export async function deleteSessionByToken(token: string) {
  const db = getDb();
  const tokenHash = hashSessionToken(token);

  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!rawToken) {
    return null;
  }

  const db = getDb();
  const tokenHash = hashSessionToken(rawToken);

  const [row] = await db
    .select({
      sessionId: sessions.id,
      userId: users.id,
      username: users.username,
      name: users.name,
      email: users.email,
      role: users.role,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date())))
    .limit(1);

  if (!row) {
    await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
    return null;
  }

  return {
    id: row.userId,
    username: row.username,
    name: row.name,
    email: row.email,
    role: row.role,
  } satisfies AuthenticatedUser;
}

export async function hasAnyUsers() {
  const db = getDb();
  const [existingUser] = await db
    .select({
      id: users.id,
    })
    .from(users)
    .limit(1);

  return Boolean(existingUser);
}

export async function requireUserOrRedirect() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}
