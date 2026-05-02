import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createConversationForUser, listConversationsForUser } from "@/lib/conversations";
import { resolveRequestedModel } from "@/lib/ollama";

export const runtime = "nodejs";

type CreateConversationBody = {
  model?: string;
  title?: string;
};

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const conversations = await listConversationsForUser(user.id);
  return NextResponse.json({ conversations });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: CreateConversationBody = {};

  try {
    body = (await request.json()) as CreateConversationBody;
  } catch {
    // keep empty body
  }

  const model = resolveRequestedModel(body.model);
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const conversation = await createConversationForUser(user.id, model, title);

  return NextResponse.json({ conversation }, { status: 201 });
}
