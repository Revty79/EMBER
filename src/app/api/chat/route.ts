import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { conversations, messages } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { buildConversationTitle } from "@/lib/conversations";
import { createId } from "@/lib/ids";
import {
  EMBER_SYSTEM_INSTRUCTION,
  resolveRequestedModel,
  sendOllamaChatRequest,
} from "@/lib/ollama";

export const runtime = "nodejs";

type ChatRequestBody = {
  conversationId?: string;
  model?: string;
  content?: string;
};

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: ChatRequestBody;

  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const content = typeof body.content === "string" ? body.content.trim() : "";

  if (!content) {
    return NextResponse.json({ error: "Message content is required." }, { status: 400 });
  }

  const model = resolveRequestedModel(body.model);
  const db = getDb();
  const now = new Date();
  let activeConversationId = body.conversationId?.trim();
  let createdAt = now;
  let title = "New conversation";

  if (activeConversationId) {
    const [existingConversation] = await db
      .select({
        id: conversations.id,
        title: conversations.title,
        createdAt: conversations.createdAt,
      })
      .from(conversations)
      .where(and(eq(conversations.id, activeConversationId), eq(conversations.userId, user.id)))
      .limit(1);

    if (!existingConversation) {
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }

    title = existingConversation.title;
    createdAt = existingConversation.createdAt;
  } else {
    activeConversationId = createId();
    title = buildConversationTitle(content);

    await db.insert(conversations).values({
      id: activeConversationId,
      userId: user.id,
      title,
      model,
      createdAt: now,
      updatedAt: now,
    });
  }

  const userMessageId = createId();
  await db.insert(messages).values({
    id: userMessageId,
    conversationId: activeConversationId,
    role: "user",
    content,
    createdAt: now,
  });

  const storedMessages = await db
    .select({
      id: messages.id,
      role: messages.role,
      content: messages.content,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(
      and(eq(messages.conversationId, activeConversationId), eq(conversations.userId, user.id)),
    )
    .orderBy(asc(messages.createdAt));

  if (title === "New conversation" && storedMessages.length === 1 && storedMessages[0].role === "user") {
    title = buildConversationTitle(content);
  }

  if (title !== "New conversation" || !body.conversationId) {
    await db
      .update(conversations)
      .set({
        title,
        model,
        updatedAt: now,
      })
      .where(and(eq(conversations.id, activeConversationId), eq(conversations.userId, user.id)));
  } else {
    await db
      .update(conversations)
      .set({
        model,
        updatedAt: now,
      })
      .where(and(eq(conversations.id, activeConversationId), eq(conversations.userId, user.id)));
  }

  try {
    const assistantReply = await sendOllamaChatRequest(model, [
      {
        role: "system",
        content: EMBER_SYSTEM_INSTRUCTION,
      },
      ...storedMessages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    ]);

    const assistantMessageId = createId();
    const assistantCreatedAt = new Date();

    await db.insert(messages).values({
      id: assistantMessageId,
      conversationId: activeConversationId,
      role: "assistant",
      content: assistantReply,
      createdAt: assistantCreatedAt,
    });

    await db
      .update(conversations)
      .set({
        model,
        title,
        updatedAt: assistantCreatedAt,
      })
      .where(and(eq(conversations.id, activeConversationId), eq(conversations.userId, user.id)));

    return NextResponse.json({
      conversation: {
        id: activeConversationId,
        title,
        model,
        createdAt: createdAt.toISOString(),
        updatedAt: assistantCreatedAt.toISOString(),
      },
      userMessage: {
        id: userMessageId,
        conversationId: activeConversationId,
        role: "user",
        content,
        createdAt: now.toISOString(),
      },
      assistantMessage: {
        id: assistantMessageId,
        conversationId: activeConversationId,
        role: "assistant",
        content: assistantReply,
        createdAt: assistantCreatedAt.toISOString(),
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Could not reach Ollama: ${detail}` }, { status: 502 });
  }
}
