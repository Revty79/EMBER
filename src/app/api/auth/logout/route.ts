import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { clearSessionCookie, deleteSessionByToken } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get("ember_session")?.value;

  if (token) {
    await deleteSessionByToken(token);
  }

  const response = NextResponse.json({ success: true });
  clearSessionCookie(response);
  return response;
}
