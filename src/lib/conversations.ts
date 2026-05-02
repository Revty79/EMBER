import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { conversations, messages } from "@/db/schema";
import type { ConversationMessage, ConversationSummary } from "@/lib/chat-types";
import { createId } from "@/lib/ids";
import type { EmberModel } from "@/lib/ollama";

export function buildConversationTitle(firstUserMessage: string) {
  const oneLine = firstUserMessage.replace(/\s+/g, " ").trim();

  if (!oneLine) {
    return "New conversation";
  }

  return oneLine.length <= 60 ? oneLine : `${oneLine.slice(0, 57)}...`;
}

export async function listConversationsForUser(userId: string) {
  const db = getDb();
  const rows = await db
    .select({
      id: conversations.id,
      title: conversations.title,
      model: conversations.model,
      createdAt: conversations.createdAt,
      updatedAt: conversations.updatedAt,
    })
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.updatedAt));

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    model: row.model,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  })) satisfies ConversationSummary[];
}

export async function getConversationForUser(conversationId: string, userId: string) {
  const db = getDb();
  const [row] = await db
    .select({
      id: conversations.id,
      userId: conversations.userId,
      title: conversations.title,
      model: conversations.model,
      createdAt: conversations.createdAt,
      updatedAt: conversations.updatedAt,
    })
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
    .limit(1);

  return row ?? null;
}

export async function listMessagesForConversation(conversationId: string, userId: string) {
  const db = getDb();
  const rows = await db
    .select({
      id: messages.id,
      conversationId: messages.conversationId,
      role: messages.role,
      content: messages.content,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(and(eq(messages.conversationId, conversationId), eq(conversations.userId, userId)))
    .orderBy(asc(messages.createdAt));

  return rows.map((row) => ({
    id: row.id,
    conversationId: row.conversationId,
    role: row.role,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
  })) satisfies ConversationMessage[];
}

export async function createConversationForUser(userId: string, model: EmberModel, title?: string) {
  const db = getDb();
  const now = new Date();
  const id = createId();
  const finalTitle = title && title.trim().length > 0 ? title.trim() : "New conversation";

  await db.insert(conversations).values({
    id,
    userId,
    title: finalTitle,
    model,
    createdAt: now,
    updatedAt: now,
  });

  return {
    id,
    title: finalTitle,
    model,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  } satisfies ConversationSummary;
}
