import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { minecraftBridgeLogs } from "@/db/schema";
import { createId } from "@/lib/ids";
import {
  resolveRequestedModel,
  resolveRequestedResponseMode,
  resolveRuntimeOptions,
  type EmberResponseMode,
  type OllamaRuntimeOptions,
} from "@/lib/ollama";
import {
  normalizeAllowedActionsFromEnv,
  normalizeConfidence,
} from "@/lib/minecraft/validation";
import {
  SUPERVISED_ACTION_KEY_TO_TYPES,
  type MinecraftBridgeMode,
  type MinecraftDecisionConfidence,
  type MinecraftObservation,
  type MinecraftRequestedAction,
  type MinecraftSupervisedActionKey,
  type MinecraftSupervisedActionType,
} from "@/lib/minecraft/types";

const CONFIDENCE_RANK: Record<MinecraftDecisionConfidence, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

const ACTION_TYPE_ALIASES: Record<string, MinecraftSupervisedActionType> = {
  REPORT_STATUS: "REPORT_STATUS",
  STATUS: "REPORT_STATUS",
  LOOK_AT_OWNER: "LOOK_AT_OWNER",
  REPORT_LOOK: "REPORT_LOOK",
  LOOK: "LOOK_AT_OWNER",
  EAT_FOOD: "EAT_FOOD",
  EAT_IF_HUNGRY: "EAT_FOOD",
  GO_HOME: "GO_HOME",
  FLEE_DANGER: "FLEE_DANGER",
  FLEE: "FLEE_DANGER",
  WANDER_SAFE: "WANDER_SAFE",
  WANDER_YARD: "WANDER_SAFE",
  STOP_MOVING: "STOP_MOVING",
  STOP: "STOP_MOVING",
};

export type MinecraftBridgeConfig = {
  shadowEnabled: boolean;
  shadowModel: string;
  shadowResponseMode: EmberResponseMode;
  shadowStoreObservations: boolean;
  shadowMaxRecent: number;
  supervisedEnabled: boolean;
  supervisedModel: string;
  supervisedResponseMode: EmberResponseMode;
  supervisedAllowedActionKeys: MinecraftSupervisedActionKey[];
  supervisedAllowedActionTypes: MinecraftSupervisedActionType[];
  supervisedMaxActions: number;
  supervisedRequireConfidence: MinecraftDecisionConfidence;
  bridgeDebug: boolean;
  actionsEnabled: false;
};

export type CreateMinecraftBridgeLogInput = {
  mode: MinecraftBridgeMode;
  observation: MinecraftObservation;
  observationSummary?: string;
  model?: string;
  responseMode?: string;
  promptText?: string;
  shadowReply?: string;
  wouldDo?: string;
  confidence?: MinecraftDecisionConfidence;
  requestedActions?: MinecraftRequestedAction[];
  error?: string;
};

export type MinecraftBridgeBodyResultUpdate = {
  accepted?: boolean;
  executed?: boolean;
  reason?: string;
  bodyState?: unknown;
};

export type MinecraftBridgeLogView = {
  id: string;
  createdAt: string;
  mode: string;
  observationTimestamp: string | null;
  botUsername: string | null;
  observation: MinecraftObservation;
  observationSummary: string | null;
  model: string | null;
  responseMode: string | null;
  promptText: string | null;
  shadowReply: string | null;
  wouldDo: string | null;
  confidence: string | null;
  requestedActions: MinecraftRequestedAction[];
  executed: boolean;
  acceptedByBody: boolean | null;
  bodyResult: unknown;
  error: string | null;
};

export type ParsedSupervisedModelResponse = {
  reply: string;
  wouldDo: string;
  confidence: MinecraftDecisionConfidence;
  actions: MinecraftRequestedAction[];
  parserError?: string;
};

function readBooleanEnv(name: string, fallback: boolean) {
  const raw = process.env[name];

  if (!raw) {
    return fallback;
  }

  const normalized = raw.trim().toLowerCase();

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function readIntegerEnv(name: string, fallback: number, minValue: number, maxValue: number) {
  const raw = process.env[name];

  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);

  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return Math.max(minValue, Math.min(maxValue, parsed));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeStringify(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return "{}";
  }
}

function safeParseJson(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function normalizeActionType(value: unknown): MinecraftSupervisedActionType | null {
  if (typeof value !== "string") {
    return null;
  }

  const key = value.trim().toUpperCase();

  if (!key) {
    return null;
  }

  return ACTION_TYPE_ALIASES[key] ?? null;
}

function isConfidenceAtLeast(
  confidence: MinecraftDecisionConfidence,
  minimum: MinecraftDecisionConfidence,
) {
  return CONFIDENCE_RANK[confidence] >= CONFIDENCE_RANK[minimum];
}

function extractJsonCandidate(raw: string) {
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  return raw.slice(firstBrace, lastBrace + 1);
}

function bridgeDebugLog(enabled: boolean, event: string, details: Record<string, unknown>) {
  if (!enabled) {
    return;
  }

  console.info(`[minecraft-bridge] ${event}`, details);
}

export function resolveBridgeModel(modelFromEnv?: string | null) {
  const requested = modelFromEnv?.trim();

  if (requested) {
    return requested;
  }

  return resolveRequestedModel(undefined);
}

export function expandAllowedActionTypes(keys: MinecraftSupervisedActionKey[]) {
  const types: MinecraftSupervisedActionType[] = [];

  for (const key of keys) {
    for (const actionType of SUPERVISED_ACTION_KEY_TO_TYPES[key]) {
      if (!types.includes(actionType)) {
        types.push(actionType);
      }
    }
  }

  return types;
}

export function getMinecraftBridgeConfig(): MinecraftBridgeConfig {
  const shadowModel = resolveBridgeModel(process.env.MINECRAFT_SHADOW_MODEL);
  const supervisedModel = resolveBridgeModel(process.env.MINECRAFT_SUPERVISED_MODEL);
  const supervisedAllowedActionKeys = normalizeAllowedActionsFromEnv();

  return {
    shadowEnabled: readBooleanEnv("MINECRAFT_SHADOW_ENABLED", false),
    shadowModel,
    shadowResponseMode: resolveRequestedResponseMode(process.env.MINECRAFT_SHADOW_RESPONSE_MODE),
    shadowStoreObservations: readBooleanEnv("MINECRAFT_SHADOW_STORE_OBSERVATIONS", true),
    shadowMaxRecent: readIntegerEnv("MINECRAFT_SHADOW_MAX_RECENT", 25, 1, 200),
    supervisedEnabled: readBooleanEnv("MINECRAFT_SUPERVISED_ENABLED", false),
    supervisedModel,
    supervisedResponseMode: resolveRequestedResponseMode(
      process.env.MINECRAFT_SUPERVISED_RESPONSE_MODE,
    ),
    supervisedAllowedActionKeys,
    supervisedAllowedActionTypes: expandAllowedActionTypes(supervisedAllowedActionKeys),
    supervisedMaxActions: readIntegerEnv("MINECRAFT_SUPERVISED_MAX_ACTIONS", 1, 0, 5),
    supervisedRequireConfidence: normalizeConfidence(
      process.env.MINECRAFT_SUPERVISED_REQUIRE_CONFIDENCE ?? "medium",
    ),
    bridgeDebug: readBooleanEnv("MINECRAFT_BRIDGE_DEBUG", false),
    actionsEnabled: false,
  };
}

export function resolveBridgeRuntimeOptions(mode: EmberResponseMode): OllamaRuntimeOptions {
  return resolveRuntimeOptions(mode);
}

export function hasDangerSignals(observation: MinecraftObservation) {
  const survival = isRecord(observation.survival) ? observation.survival : undefined;
  const vitals = isRecord(survival?.vitals) ? survival.vitals : undefined;
  const safetyFlags = isRecord(survival?.safetyFlags) ? survival.safetyFlags : undefined;

  const dangerText =
    typeof vitals?.danger === "string" ? vitals.danger.trim().toLowerCase() : undefined;

  if (dangerText && !["none", "safe", "low", "normal", "clear"].includes(dangerText)) {
    return true;
  }

  if (typeof vitals?.health === "number" && vitals.health <= 8) {
    return true;
  }

  if (typeof vitals?.food === "number" && vitals.food <= 5) {
    return true;
  }

  if (safetyFlags) {
    for (const [key, value] of Object.entries(safetyFlags)) {
      if (typeof value === "boolean" && value) {
        if (["hostilenearby", "takingdamage", "lowhealth", "outsideSafeArea", "outsidesafearea"].includes(key.toLowerCase())) {
          return true;
        }
      }
    }
  }

  return false;
}

export function parseMinecraftSupervisedModelResponse(
  rawModelReply: string,
  options: {
    allowedActionTypes: MinecraftSupervisedActionType[];
    maxActions: number;
    requiredConfidence: MinecraftDecisionConfidence;
    dangerPresent: boolean;
    debug?: boolean;
  },
): ParsedSupervisedModelResponse {
  const trimmedReply = rawModelReply.trim();
  let parsed: unknown = null;
  let parserError: string | undefined;

  try {
    parsed = JSON.parse(trimmedReply) as unknown;
  } catch {
    const candidate = extractJsonCandidate(trimmedReply);

    if (candidate) {
      try {
        parsed = JSON.parse(candidate) as unknown;
      } catch {
        parserError = "Failed to parse JSON from supervised model response.";
      }
    } else {
      parserError = "No JSON object found in supervised model response.";
    }
  }

  let reply = trimmedReply;
  let wouldDo = trimmedReply;
  let confidence: MinecraftDecisionConfidence = "low";
  let actions: MinecraftRequestedAction[] = [];

  if (isRecord(parsed)) {
    const rawReply = typeof parsed.reply === "string" ? parsed.reply.trim() : "";
    const rawWouldDo = typeof parsed.wouldDo === "string" ? parsed.wouldDo.trim() : "";

    if (rawReply) {
      reply = rawReply;
    }

    if (rawWouldDo) {
      wouldDo = rawWouldDo;
    } else {
      wouldDo = reply;
    }

    confidence = normalizeConfidence(parsed.confidence);

    if (Array.isArray(parsed.actions)) {
      const mapped = parsed.actions
        .map((item): MinecraftRequestedAction | null => {
          if (!isRecord(item)) {
            return null;
          }

          const type = normalizeActionType(item.type);

          if (!type) {
            return null;
          }

          const reason =
            typeof item.reason === "string" && item.reason.trim().length > 0
              ? item.reason.trim()
              : "Model requested this action based on observed conditions.";

          return {
            type,
            reason,
          };
        })
        .filter((item): item is MinecraftRequestedAction => Boolean(item));

      const allowedSet = new Set(options.allowedActionTypes);
      const unique: MinecraftRequestedAction[] = [];

      for (const action of mapped) {
        if (!allowedSet.has(action.type)) {
          continue;
        }

        if (unique.some((existing) => existing.type === action.type)) {
          continue;
        }

        unique.push(action);
      }

      actions = unique;
    }
  }

  if (!isConfidenceAtLeast(confidence, options.requiredConfidence)) {
    actions = [];
  } else {
    actions = actions.slice(0, options.maxActions);

    if (options.dangerPresent) {
      const preferredType = options.allowedActionTypes.includes("FLEE_DANGER")
        ? "FLEE_DANGER"
        : options.allowedActionTypes.includes("GO_HOME")
          ? "GO_HOME"
          : null;

      if (preferredType && (actions.length === 0 || !["FLEE_DANGER", "GO_HOME"].includes(actions[0].type))) {
        actions = [
          {
            type: preferredType,
            reason: "Danger signal detected from observation; prioritize immediate safety.",
          },
        ];
      }
    }
  }

  bridgeDebugLog(Boolean(options.debug), "supervised_parse", {
    parserError,
    confidence,
    actionCount: actions.length,
  });

  return {
    reply,
    wouldDo,
    confidence,
    actions,
    parserError,
  };
}

export async function createMinecraftBridgeLog(input: CreateMinecraftBridgeLogInput) {
  const db = getDb();
  const id = createId();

  const observationTimestamp =
    typeof input.observation.timestamp === "string" ? input.observation.timestamp : null;
  const botUsername =
    input.observation.bot && typeof input.observation.bot.username === "string"
      ? input.observation.bot.username
      : null;

  await db.insert(minecraftBridgeLogs).values({
    id,
    mode: input.mode,
    observationTimestamp,
    botUsername,
    observationJson: safeStringify(input.observation),
    observationSummary: input.observationSummary ?? null,
    model: input.model ?? null,
    responseMode: input.responseMode ?? null,
    promptText: input.promptText ?? null,
    shadowReply: input.shadowReply ?? null,
    wouldDo: input.wouldDo ?? null,
    confidence: input.confidence ?? null,
    requestedActionsJson:
      input.requestedActions && input.requestedActions.length > 0
        ? safeStringify(input.requestedActions)
        : null,
    executed: false,
    error: input.error ?? null,
  });

  return id;
}

export async function getRecentMinecraftBridgeLogs(limit: number): Promise<MinecraftBridgeLogView[]> {
  const db = getDb();
  const normalizedLimit = Math.max(1, Math.min(200, limit));

  const rows = await db
    .select()
    .from(minecraftBridgeLogs)
    .orderBy(desc(minecraftBridgeLogs.createdAt))
    .limit(normalizedLimit);

  return rows.map((row) => {
    const observation = safeParseJson(row.observationJson);
    const requestedActions = safeParseJson(row.requestedActionsJson);
    const bodyResult = safeParseJson(row.bodyResultJson);

    return {
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      mode: row.mode,
      observationTimestamp: row.observationTimestamp,
      botUsername: row.botUsername,
      observation: (observation as MinecraftObservation | null) ?? {},
      observationSummary: row.observationSummary,
      model: row.model,
      responseMode: row.responseMode,
      promptText: row.promptText,
      shadowReply: row.shadowReply,
      wouldDo: row.wouldDo,
      confidence: row.confidence,
      requestedActions: Array.isArray(requestedActions)
        ? (requestedActions as MinecraftRequestedAction[])
        : [],
      executed: row.executed,
      acceptedByBody: row.acceptedByBody,
      bodyResult,
      error: row.error,
    };
  });
}

export async function updateMinecraftBridgeBodyResult(
  logId: string,
  result: MinecraftBridgeBodyResultUpdate,
) {
  const db = getDb();
  const normalizedId = logId.trim();

  if (!normalizedId) {
    throw new Error("logId is required.");
  }

  const bodyResultPayload = {
    accepted: typeof result.accepted === "boolean" ? result.accepted : undefined,
    executed: typeof result.executed === "boolean" ? result.executed : false,
    reason: typeof result.reason === "string" ? result.reason : undefined,
    bodyState: result.bodyState,
  };

  const [updated] = await db
    .update(minecraftBridgeLogs)
    .set({
      acceptedByBody: typeof result.accepted === "boolean" ? result.accepted : null,
      executed: typeof result.executed === "boolean" ? result.executed : false,
      bodyResultJson: safeStringify(bodyResultPayload),
    })
    .where(eq(minecraftBridgeLogs.id, normalizedId))
    .returning({
      id: minecraftBridgeLogs.id,
    });

  return updated ?? null;
}
