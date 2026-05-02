import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { emberProfiles } from "@/db/schema";

export const EMBER_PROFILE_ID = "default";

export type EmberIdentityProfile = {
  name: string;
  acronym: string;
  tone: string;
  familyAssistantRole: string;
  privacyBoundaries: string;
  responseStyle: string;
  allowedInitiative: string;
  forbiddenActions: string;
  uncertaintyBehavior: string;
  memoryBehavior: string;
  additionalInstructions: string;
};

const DEFAULT_EMBER_PROFILE: EmberIdentityProfile = {
  name: "EMBER",
  acronym: "Enhanced Memory Backbone for Everyday Reasoning",
  tone: "Warm, direct, practical, and grounded in truth.",
  familyAssistantRole:
    "Serve as Brannan's local family assistant for planning, writing, organizing ideas, and everyday reasoning.",
  privacyBoundaries:
    "Treat family conversations as private local data. Do not suggest sharing private details publicly unless explicitly requested.",
  responseStyle:
    "Lead with the answer, then concise supporting detail. Expand depth when asked, and keep language natural and non-corporate.",
  allowedInitiative:
    "Proactively suggest next steps, point out hidden tradeoffs, and gently challenge weak assumptions when useful.",
  forbiddenActions:
    "Do not fabricate facts, credentials, or external events. Do not claim to have completed actions that were not actually performed.",
  uncertaintyBehavior:
    "State uncertainty plainly, provide best-effort reasoning, and ask a focused follow-up when clarification is required.",
  memoryBehavior:
    "Use only conversation context and stored app history. Do not claim hidden long-term memory beyond what is present in this app.",
  additionalInstructions: "",
};

function normalizeValue(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

function mapRowToProfile(row: typeof emberProfiles.$inferSelect): EmberIdentityProfile {
  return {
    name: normalizeValue(row.name, DEFAULT_EMBER_PROFILE.name),
    acronym: normalizeValue(row.acronym, DEFAULT_EMBER_PROFILE.acronym),
    tone: normalizeValue(row.tone, DEFAULT_EMBER_PROFILE.tone),
    familyAssistantRole: normalizeValue(
      row.familyAssistantRole,
      DEFAULT_EMBER_PROFILE.familyAssistantRole,
    ),
    privacyBoundaries: normalizeValue(
      row.privacyBoundaries,
      DEFAULT_EMBER_PROFILE.privacyBoundaries,
    ),
    responseStyle: normalizeValue(row.responseStyle, DEFAULT_EMBER_PROFILE.responseStyle),
    allowedInitiative: normalizeValue(
      row.allowedInitiative,
      DEFAULT_EMBER_PROFILE.allowedInitiative,
    ),
    forbiddenActions: normalizeValue(row.forbiddenActions, DEFAULT_EMBER_PROFILE.forbiddenActions),
    uncertaintyBehavior: normalizeValue(
      row.uncertaintyBehavior,
      DEFAULT_EMBER_PROFILE.uncertaintyBehavior,
    ),
    memoryBehavior: normalizeValue(row.memoryBehavior, DEFAULT_EMBER_PROFILE.memoryBehavior),
    additionalInstructions: row.additionalInstructions?.trim() ?? "",
  };
}

async function ensureEmberProfileRow() {
  const db = getDb();
  const now = new Date();

  await db
    .insert(emberProfiles)
    .values({
      id: EMBER_PROFILE_ID,
      ...DEFAULT_EMBER_PROFILE,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();
}

export async function getEmberIdentityProfile() {
  await ensureEmberProfileRow();
  const db = getDb();
  const [profileRow] = await db
    .select()
    .from(emberProfiles)
    .where(eq(emberProfiles.id, EMBER_PROFILE_ID))
    .limit(1);

  if (!profileRow) {
    return DEFAULT_EMBER_PROFILE;
  }

  return mapRowToProfile(profileRow);
}

export async function updateEmberIdentityProfile(
  profileUpdate: EmberIdentityProfile,
  updatedByUserId: string,
) {
  await ensureEmberProfileRow();
  const db = getDb();
  const now = new Date();

  const nextProfile: EmberIdentityProfile = {
    name: normalizeValue(profileUpdate.name, DEFAULT_EMBER_PROFILE.name),
    acronym: normalizeValue(profileUpdate.acronym, DEFAULT_EMBER_PROFILE.acronym),
    tone: normalizeValue(profileUpdate.tone, DEFAULT_EMBER_PROFILE.tone),
    familyAssistantRole: normalizeValue(
      profileUpdate.familyAssistantRole,
      DEFAULT_EMBER_PROFILE.familyAssistantRole,
    ),
    privacyBoundaries: normalizeValue(
      profileUpdate.privacyBoundaries,
      DEFAULT_EMBER_PROFILE.privacyBoundaries,
    ),
    responseStyle: normalizeValue(profileUpdate.responseStyle, DEFAULT_EMBER_PROFILE.responseStyle),
    allowedInitiative: normalizeValue(
      profileUpdate.allowedInitiative,
      DEFAULT_EMBER_PROFILE.allowedInitiative,
    ),
    forbiddenActions: normalizeValue(
      profileUpdate.forbiddenActions,
      DEFAULT_EMBER_PROFILE.forbiddenActions,
    ),
    uncertaintyBehavior: normalizeValue(
      profileUpdate.uncertaintyBehavior,
      DEFAULT_EMBER_PROFILE.uncertaintyBehavior,
    ),
    memoryBehavior: normalizeValue(
      profileUpdate.memoryBehavior,
      DEFAULT_EMBER_PROFILE.memoryBehavior,
    ),
    additionalInstructions: profileUpdate.additionalInstructions?.trim() ?? "",
  };

  await db
    .update(emberProfiles)
    .set({
      ...nextProfile,
      updatedByUserId,
      updatedAt: now,
    })
    .where(eq(emberProfiles.id, EMBER_PROFILE_ID));

  return nextProfile;
}

export function buildEmberIdentityInstruction(profile: EmberIdentityProfile) {
  const customInstructionBlock = profile.additionalInstructions
    ? `- Additional Instructions: ${profile.additionalInstructions}`
    : "";

  return [
    "EMBER Identity Profile (authoritative):",
    `- Name: ${profile.name}`,
    `- Acronym: ${profile.acronym}`,
    `- Tone: ${profile.tone}`,
    `- Family Assistant Role: ${profile.familyAssistantRole}`,
    `- Privacy Boundaries: ${profile.privacyBoundaries}`,
    `- Response Style: ${profile.responseStyle}`,
    `- Allowed Initiative: ${profile.allowedInitiative}`,
    `- Forbidden Actions: ${profile.forbiddenActions}`,
    `- Uncertainty Behavior: ${profile.uncertaintyBehavior}`,
    `- Memory Behavior: ${profile.memoryBehavior}`,
    customInstructionBlock,
  ]
    .filter((line) => line.length > 0)
    .join("\n");
}
