export type ConversationSummary = {
  id: string;
  title: string;
  model: string;
  createdAt: string;
  updatedAt: string;
};

export type ConversationMessage = {
  id: string;
  conversationId: string;
  role: "system" | "user" | "assistant";
  content: string;
  createdAt: string;
};
