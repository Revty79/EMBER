import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["admin", "user"]);
export const messageRoleEnum = pgEnum("message_role", ["system", "user", "assistant"]);

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRoleEnum("role").notNull().default("user"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    usernameUnique: uniqueIndex("users_username_unique").on(table.username),
    emailUnique: uniqueIndex("users_email_unique").on(table.email),
  }),
);

export const conversations = pgTable(
  "conversations",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    model: text("model").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    byUserUpdated: index("conversations_user_updated_idx").on(table.userId, table.updatedAt),
  }),
);

export const messages = pgTable(
  "messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: messageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    byConversationCreated: index("messages_conversation_created_idx").on(
      table.conversationId,
      table.createdAt,
    ),
  }),
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    tokenHashUnique: uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
    byUser: index("sessions_user_idx").on(table.userId),
    byExpiry: index("sessions_expiry_idx").on(table.expiresAt),
  }),
);

export const emberProfiles = pgTable(
  "ember_profiles",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    acronym: text("acronym").notNull(),
    tone: text("tone").notNull(),
    familyAssistantRole: text("family_assistant_role").notNull(),
    privacyBoundaries: text("privacy_boundaries").notNull(),
    responseStyle: text("response_style").notNull(),
    allowedInitiative: text("allowed_initiative").notNull(),
    forbiddenActions: text("forbidden_actions").notNull(),
    uncertaintyBehavior: text("uncertainty_behavior").notNull(),
    memoryBehavior: text("memory_behavior").notNull(),
    additionalInstructions: text("additional_instructions").notNull().default(""),
    updatedByUserId: text("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    byUpdatedAt: index("ember_profiles_updated_idx").on(table.updatedAt),
  }),
);

export const minecraftBridgeLogs = pgTable(
  "minecraft_bridge_logs",
  {
    id: text("id").primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    mode: text("mode").notNull(),
    observationTimestamp: text("observation_timestamp"),
    botUsername: text("bot_username"),
    observationJson: text("observation_json").notNull(),
    observationSummary: text("observation_summary"),
    model: text("model"),
    responseMode: text("response_mode"),
    promptText: text("prompt_text"),
    shadowReply: text("shadow_reply"),
    wouldDo: text("would_do"),
    confidence: text("confidence"),
    requestedActionsJson: text("requested_actions_json"),
    executed: boolean("executed").notNull().default(false),
    acceptedByBody: boolean("accepted_by_body"),
    bodyResultJson: text("body_result_json"),
    error: text("error"),
  },
  (table) => ({
    byCreatedAt: index("minecraft_bridge_logs_created_idx").on(table.createdAt),
    byModeCreatedAt: index("minecraft_bridge_logs_mode_created_idx").on(table.mode, table.createdAt),
  }),
);

export const usersRelations = relations(users, ({ many }) => ({
  conversations: many(conversations),
  sessions: many(sessions),
  updatedEmberProfiles: many(emberProfiles),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  user: one(users, {
    fields: [conversations.userId],
    references: [users.id],
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const emberProfilesRelations = relations(emberProfiles, ({ one }) => ({
  updatedByUser: one(users, {
    fields: [emberProfiles.updatedByUserId],
    references: [users.id],
  }),
}));

export type UserRecord = typeof users.$inferSelect;
export type ConversationRecord = typeof conversations.$inferSelect;
export type MessageRecord = typeof messages.$inferSelect;
export type EmberProfileRecord = typeof emberProfiles.$inferSelect;
export type MinecraftBridgeLogRecord = typeof minecraftBridgeLogs.$inferSelect;
