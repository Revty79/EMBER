import EmberChat from "@/components/ember-chat";
import { requireUserOrRedirect } from "@/lib/auth";
import { listConversationsForUser, listMessagesForConversation } from "@/lib/conversations";
import { MODEL_OPTIONS, RESPONSE_MODE_OPTIONS, resolveDefaultModel } from "@/lib/ollama";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireUserOrRedirect();
  const defaultModel = resolveDefaultModel(process.env.OLLAMA_MODEL);
  const initialConversations = await listConversationsForUser(user.id);
  const initialConversationId = initialConversations[0]?.id ?? null;
  const initialMessages = initialConversationId
    ? await listMessagesForConversation(initialConversationId, user.id)
    : [];

  return (
    <EmberChat
      userName={user.name}
      userRole={user.role}
      defaultModel={defaultModel}
      models={[...MODEL_OPTIONS]}
      defaultResponseMode="helpful"
      responseModes={[...RESPONSE_MODE_OPTIONS]}
      initialConversations={initialConversations}
      initialConversationId={initialConversationId}
      initialMessages={initialMessages}
    />
  );
}
