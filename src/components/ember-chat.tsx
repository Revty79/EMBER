"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./ember-chat.module.css";
import type { ConversationMessage, ConversationSummary } from "@/lib/chat-types";
import type { EmberModel, EmberResponseMode } from "@/lib/ollama";

type EmberChatProps = {
  userName: string;
  userRole: "admin" | "user";
  defaultModel: EmberModel;
  models: EmberModel[];
  defaultResponseMode: EmberResponseMode;
  responseModes: EmberResponseMode[];
  initialConversations: ConversationSummary[];
  initialConversationId: string | null;
  initialMessages: ConversationMessage[];
};

type ChatApiResponse = {
  responseMode?: EmberResponseMode;
  conversation?: ConversationSummary;
  userMessage?: ConversationMessage;
  assistantMessage?: ConversationMessage;
  error?: string;
};

type ConversationMessagesResponse = {
  messages?: ConversationMessage[];
  error?: string;
};

type CreateConversationResponse = {
  conversation?: ConversationSummary;
  error?: string;
};

type CreateUserResponse = {
  user?: {
    username: string;
    name: string;
    email: string;
    role: "admin" | "user";
  };
  error?: string;
};

function compareIsoDatesDescending(a: string, b: string) {
  return new Date(b).getTime() - new Date(a).getTime();
}

export default function EmberChat({
  userName,
  userRole,
  defaultModel,
  models,
  defaultResponseMode,
  responseModes,
  initialConversations,
  initialConversationId,
  initialMessages,
}: EmberChatProps) {
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationSummary[]>(initialConversations);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    initialConversationId,
  );
  const [messagesByConversation, setMessagesByConversation] = useState<
    Record<string, ConversationMessage[]>
  >(() => (initialConversationId ? { [initialConversationId]: initialMessages } : {}));
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState<EmberModel>(defaultModel);
  const [selectedResponseMode, setSelectedResponseMode] =
    useState<EmberResponseMode>(defaultResponseMode);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState("");
  const [accountError, setAccountError] = useState("");
  const [accountNotice, setAccountNotice] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "user">("user");

  const activeMessages = activeConversationId
    ? messagesByConversation[activeConversationId] ?? []
    : [];
  const isReadyToSend = input.trim().length > 0 && !isSending && !isLoadingConversation;

  const syncConversation = (conversation: ConversationSummary) => {
    setConversations((current) => {
      const withoutCurrent = current.filter((item) => item.id !== conversation.id);
      return [conversation, ...withoutCurrent].sort((left, right) =>
        compareIsoDatesDescending(left.updatedAt, right.updatedAt),
      );
    });
  };

  const loadConversationMessages = async (conversationId: string) => {
    if (messagesByConversation[conversationId]) {
      return;
    }

    setIsLoadingConversation(true);
    setError("");

    try {
      const response = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "GET",
      });

      const data = (await response.json().catch(() => null)) as ConversationMessagesResponse | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "Could not load conversation history.");
      }

      setMessagesByConversation((current) => ({
        ...current,
        [conversationId]: data?.messages ?? [],
      }));
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Could not load conversation history.",
      );
    } finally {
      setIsLoadingConversation(false);
    }
  };

  const handleSelectConversation = async (conversationId: string) => {
    setActiveConversationId(conversationId);
    await loadConversationMessages(conversationId);
  };

  const handleCreateConversation = async () => {
    if (isCreatingConversation || isSending) {
      return;
    }

    setIsCreatingConversation(true);
    setError("");

    try {
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: selectedModel,
          title: "New conversation",
        }),
      });

      const data = (await response.json().catch(() => null)) as CreateConversationResponse | null;

      if (!response.ok || !data?.conversation) {
        throw new Error(data?.error ?? "Could not create a conversation.");
      }

      syncConversation(data.conversation);
      setActiveConversationId(data.conversation.id);
      setMessagesByConversation((current) => ({
        ...current,
        [data.conversation!.id]: [],
      }));
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Could not create a conversation.",
      );
    } finally {
      setIsCreatingConversation(false);
    }
  };

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);

    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  };

  const handleCreateUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (userRole !== "admin" || isCreatingUser) {
      return;
    }

    setIsCreatingUser(true);
    setAccountError("");
    setAccountNotice("");

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: newUsername.trim(),
          name: newName.trim(),
          email: newEmail.trim(),
          password: newPassword,
          role: newRole,
        }),
      });

      const data = (await response.json().catch(() => null)) as CreateUserResponse | null;

      if (!response.ok || !data?.user) {
        throw new Error(data?.error ?? "Could not create account.");
      }

      setAccountNotice(`Created account for @${data.user.username}.`);
      setNewUsername("");
      setNewName("");
      setNewEmail("");
      setNewPassword("");
      setNewRole("user");
    } catch (requestError) {
      setAccountError(
        requestError instanceof Error ? requestError.message : "Could not create account.",
      );
    } finally {
      setIsCreatingUser(false);
    }
  };

  const messageCountText = useMemo(() => {
    if (activeMessages.length === 0) {
      return "No messages yet.";
    }

    return `${activeMessages.length} message${activeMessages.length === 1 ? "" : "s"} in this conversation.`;
  }, [activeMessages.length]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isReadyToSend) {
      return;
    }

    const content = input.trim();
    setInput("");
    setIsSending(true);
    setError("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId: activeConversationId,
          model: selectedModel,
          responseMode: selectedResponseMode,
          content,
        }),
      });

      const data = (await response.json().catch(() => null)) as ChatApiResponse | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "Could not reach EMBER's backend route.");
      }

      if (!data?.conversation || !data.userMessage || !data.assistantMessage) {
        throw new Error("Unexpected chat response shape.");
      }

      syncConversation(data.conversation);
      setActiveConversationId(data.conversation.id);
      setMessagesByConversation((current) => {
        const existingMessages = current[data.conversation!.id] ?? [];
        return {
          ...current,
          [data.conversation!.id]: [...existingMessages, data.userMessage!, data.assistantMessage!],
        };
      });
    } catch (requestError) {
      if (!activeConversationId) {
        setInput(content);
      }
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Something went wrong while sending your message.",
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <aside className={styles.sidebar}>
          <header className={styles.sidebarHeader}>
            <p className={styles.kicker}>Enhanced Memory Backbone for Everyday Reasoning</p>
            <h1 className={styles.title}>EMBER</h1>
            <p className={styles.user}>
              {userName} ({userRole})
            </p>
            <button
              type="button"
              className={styles.newConversationButton}
              onClick={handleCreateConversation}
              disabled={isCreatingConversation || isSending}
            >
              {isCreatingConversation ? "Creating..." : "New conversation"}
            </button>
          </header>

          <div className={styles.conversationList}>
            {conversations.length === 0 ? (
              <p className={styles.emptyList}>No conversations yet.</p>
            ) : (
              conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  className={`${styles.conversationButton} ${
                    activeConversationId === conversation.id ? styles.conversationButtonActive : ""
                  }`}
                  onClick={() => void handleSelectConversation(conversation.id)}
                >
                  <span className={styles.conversationTitle}>{conversation.title}</span>
                  <span className={styles.conversationMeta}>{conversation.model}</span>
                </button>
              ))
            )}
          </div>

          {userRole === "admin" ? (
            <section className={styles.adminCard}>
              <h2 className={styles.adminTitle}>Create Family Account</h2>
              <form className={styles.adminForm} onSubmit={handleCreateUser}>
                <input
                  type="text"
                  autoComplete="username"
                  className={styles.adminInput}
                  placeholder="username"
                  value={newUsername}
                  onChange={(event) => setNewUsername(event.target.value)}
                />
                <input
                  type="text"
                  autoComplete="name"
                  className={styles.adminInput}
                  placeholder="full name"
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                />
                <input
                  type="email"
                  autoComplete="email"
                  className={styles.adminInput}
                  placeholder="email"
                  value={newEmail}
                  onChange={(event) => setNewEmail(event.target.value)}
                />
                <input
                  type="password"
                  autoComplete="new-password"
                  className={styles.adminInput}
                  placeholder="temporary password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
                <select
                  className={styles.adminSelect}
                  value={newRole}
                  onChange={(event) => setNewRole(event.target.value as "admin" | "user")}
                >
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
                <button
                  type="submit"
                  className={styles.adminButton}
                  disabled={isCreatingUser}
                >
                  {isCreatingUser ? "Creating..." : "Create account"}
                </button>
              </form>
              {accountError ? <p className={styles.accountError}>{accountError}</p> : null}
              {!accountError && accountNotice ? (
                <p className={styles.accountNotice}>{accountNotice}</p>
              ) : null}
              <Link className={styles.adminLink} href="/admin/ember-instructions">
                Edit EMBER Instructions
              </Link>
            </section>
          ) : null}

          <button
            type="button"
            className={styles.logoutButton}
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? "Signing out..." : "Logout"}
          </button>
        </aside>

        <section className={styles.chatPanel}>
          <header className={styles.chatHeader}>
            <p className={styles.subtitle}>
              Local family assistant for writing, organizing ideas, and practical planning.
            </p>
            <div className={styles.toolbar}>
              <label htmlFor="model">Model</label>
              <select
                id="model"
                name="model"
                value={selectedModel}
                disabled={isSending}
                onChange={(event) => setSelectedModel(event.target.value as EmberModel)}
                className={styles.select}
              >
                {models.map((modelName) => (
                  <option key={modelName} value={modelName}>
                    {modelName}
                  </option>
                ))}
              </select>
              <label htmlFor="response-mode">Mode</label>
              <select
                id="response-mode"
                name="response-mode"
                value={selectedResponseMode}
                disabled={isSending}
                onChange={(event) => setSelectedResponseMode(event.target.value as EmberResponseMode)}
                className={styles.select}
              >
                {responseModes.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </div>
          </header>

          <section className={styles.history} aria-live="polite">
            {activeMessages.length === 0 ? (
              <p className={styles.empty}>
                {isLoadingConversation ? "Loading conversation..." : "Start with a note, task, or question."}
              </p>
            ) : (
              activeMessages.map((message) => (
                <article
                  key={message.id}
                  className={`${styles.message} ${
                    message.role === "assistant" || message.role === "system"
                      ? styles.assistant
                      : styles.userMessage
                  }`}
                >
                  {message.content}
                </article>
              ))
            )}
            {isSending ? (
              <p className={`${styles.message} ${styles.assistant} ${styles.loading}`}>Thinking...</p>
            ) : null}
          </section>

          <form onSubmit={handleSubmit} className={styles.form}>
            <textarea
              id="prompt"
              name="prompt"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Write your message..."
              className={styles.input}
              rows={3}
            />
            <div className={styles.formFooter}>
              <p className={error ? styles.error : styles.hint}>{error || messageCountText}</p>
              <button type="submit" className={styles.sendButton} disabled={!isReadyToSend}>
                {isSending ? "Sending..." : "Send"}
              </button>
            </div>
          </form>
        </section>
      </section>
    </main>
  );
}
