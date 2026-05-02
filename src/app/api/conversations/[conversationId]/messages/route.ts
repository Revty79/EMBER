import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getConversationForUser, listMessagesForConversation } from "@/lib/conversations";

export const runtime = "nodejs";

type Params = {
  params: Promise<{
    conversationId: string;
  }>;
};

export async function GET(_: Request, context: Params) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { conversationId } = await context.params;

  const conversation = await getConversationForUser(conversationId, user.id);

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  const messages = await listMessagesForConversation(conversationId, user.id);
  return NextResponse.json({ messages });
}
