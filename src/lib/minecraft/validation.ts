import {
  DEFAULT_SUPERVISED_ACTION_KEYS,
  SUPERVISED_ACTION_KEY_TO_TYPES,
  type MinecraftDecisionConfidence,
  type MinecraftObservation,
  type MinecraftRecentEvent,
  type MinecraftSupervisedActionKey,
} from "@/lib/minecraft/types";

export type BridgeTokenValidationResult =
  | {
      ok: true;
      token: string;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown, maxLength = 240) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}...` : trimmed;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function normalizeEvent(event: unknown): MinecraftRecentEvent | null {
  if (!isRecord(event)) {
    return null;
  }

  return {
    ...event,
    timestamp: readString(event.timestamp, 80),
    type: readString(event.type, 80),
    detail: readString(event.detail, 280),
    severity: readString(event.severity, 40),
  };
}

function toStringList(values: unknown, maxCount = 8) {
  if (!Array.isArray(values)) {
    return undefined;
  }

  const normalized = values
    .map((value) => {
      if (typeof value === "string") {
        return readString(value, 80);
      }

      if (isRecord(value)) {
        const name = readString(value.name, 80);
        const type = readString(value.type, 80);
        return name ?? type;
      }

      return undefined;
    })
    .filter((value): value is string => Boolean(value));

  if (normalized.length === 0) {
    return undefined;
  }

  return normalized.slice(0, maxCount);
}

function normalizeTargetBlock(value: unknown) {
  if (typeof value === "string") {
    return readString(value, 120);
  }

  if (!isRecord(value)) {
    return undefined;
  }

  const name = readString(value.name, 120);
  const type = readString(value.type, 120);
  return name ?? type;
}

export function validateBridgeToken(request: Request): BridgeTokenValidationResult {
  const configuredToken = process.env.MINECRAFT_BRIDGE_TOKEN?.trim();

  if (!configuredToken) {
    return {
      ok: false,
      status: 503,
      error: "Minecraft bridge token is not configured.",
    };
  }

  const authorization = request.headers.get("authorization");

  if (!authorization || !authorization.toLowerCase().startsWith("bearer ")) {
    return {
      ok: false,
      status: 401,
      error: "Unauthorized.",
    };
  }

  const providedToken = authorization.slice(7).trim();

  if (!providedToken || providedToken !== configuredToken) {
    return {
      ok: false,
      status: 401,
      error: "Unauthorized.",
    };
  }

  return {
    ok: true,
    token: providedToken,
  };
}

export function parseMinecraftObservation(body: unknown): MinecraftObservation {
  if (!isRecord(body)) {
    throw new Error("Minecraft observation payload must be a JSON object.");
  }

  const observation: MinecraftObservation = {
    ...body,
  };

  const timestamp = readString(body.timestamp, 80);
  observation.timestamp = timestamp;

  if (isRecord(body.bot)) {
    observation.bot = { ...body.bot };
  } else {
    delete observation.bot;
  }

  if (isRecord(body.perception)) {
    observation.perception = { ...body.perception };
  } else {
    delete observation.perception;
  }

  if (isRecord(body.survival)) {
    const survival = { ...body.survival };

    if (isRecord(survival.vitals)) {
      survival.vitals = { ...survival.vitals };
    } else {
      delete survival.vitals;
    }

    if (isRecord(survival.equipment)) {
      survival.equipment = { ...survival.equipment };
    } else {
      delete survival.equipment;
    }

    if (isRecord(survival.food)) {
      survival.food = { ...survival.food };
    } else {
      delete survival.food;
    }

    if (isRecord(survival.mining)) {
      survival.mining = { ...survival.mining };
    } else {
      delete survival.mining;
    }

    if (isRecord(survival.harvesting)) {
      survival.harvesting = { ...survival.harvesting };
    } else {
      delete survival.harvesting;
    }

    if (Array.isArray(survival.visibleOres)) {
      survival.visibleOres = [...survival.visibleOres];
    } else {
      delete survival.visibleOres;
    }

    if (Array.isArray(survival.mineableOres)) {
      survival.mineableOres = [...survival.mineableOres];
    } else {
      delete survival.mineableOres;
    }

    if (typeof survival.targetBlock === "string" || isRecord(survival.targetBlock)) {
      // Keep targetBlock when it is either a label or a shaped payload.
    } else {
      delete survival.targetBlock;
    }

    if (isRecord(survival.homeProtection)) {
      survival.homeProtection = { ...survival.homeProtection };
    } else {
      delete survival.homeProtection;
    }

    if (isRecord(survival.yard)) {
      survival.yard = { ...survival.yard };
    } else {
      delete survival.yard;
    }

    if (isRecord(survival.safetyFlags)) {
      survival.safetyFlags = { ...survival.safetyFlags };
    } else {
      delete survival.safetyFlags;
    }

    observation.survival = survival;
  } else {
    delete observation.survival;
  }

  if (isRecord(body.actionQueue)) {
    observation.actionQueue = { ...body.actionQueue };
  } else {
    delete observation.actionQueue;
  }

  if (Array.isArray(body.recentEvents)) {
    observation.recentEvents = body.recentEvents
      .map((event) => normalizeEvent(event))
      .filter((event): event is MinecraftRecentEvent => Boolean(event))
      .slice(-25);
  } else {
    delete observation.recentEvents;
  }

  return observation;
}

export function sanitizeObservationForPrompt(observation: MinecraftObservation) {
  const bot = isRecord(observation.bot) ? observation.bot : undefined;
  const survival = isRecord(observation.survival) ? observation.survival : undefined;
  const vitals = isRecord(survival?.vitals) ? survival.vitals : undefined;
  const yard = isRecord(survival?.yard) ? survival.yard : undefined;
  const safetyFlags = isRecord(survival?.safetyFlags) ? survival.safetyFlags : undefined;
  const actionQueue = isRecord(observation.actionQueue) ? observation.actionQueue : undefined;

  const sanitized: Record<string, unknown> = {
    timestamp: readString(observation.timestamp, 80),
    bot: {
      username: readString(bot?.username, 80),
      ownerUsername: readString(bot?.ownerUsername, 80),
      dimension: readString(bot?.dimension, 40),
      x: readNumber(bot?.x),
      y: readNumber(bot?.y),
      z: readNumber(bot?.z),
    },
    survival: {
      vitals: {
        health: readNumber(vitals?.health),
        maxHealth: readNumber(vitals?.maxHealth),
        food: readNumber(vitals?.food),
        saturation: readNumber(vitals?.saturation),
        oxygen: readNumber(vitals?.oxygen),
        danger: readString(vitals?.danger, 80),
        status: readString(vitals?.status, 120),
      },
      yard: {
        enabled: readBoolean(yard?.enabled),
        insideRadius: readBoolean(yard?.insideRadius),
        distanceFromHome: readNumber(yard?.distanceFromHome),
        homeName: readString(yard?.homeName, 80),
      },
      safetyFlags,
      visibleOres: toStringList(survival?.visibleOres),
      mineableOres: toStringList(survival?.mineableOres),
      targetBlock: normalizeTargetBlock(survival?.targetBlock),
    },
    actionQueue: {
      active: readString(actionQueue?.active, 80),
      queuedCount: readNumber(actionQueue?.queuedCount),
      busy: readBoolean(actionQueue?.busy),
      paused: readBoolean(actionQueue?.paused),
      blockedReason: readString(actionQueue?.blockedReason, 140),
    },
    recentEvents: Array.isArray(observation.recentEvents)
      ? observation.recentEvents
          .map((event) => normalizeEvent(event))
          .filter((event): event is MinecraftRecentEvent => Boolean(event))
          .slice(-8)
      : [],
  };

  return sanitized;
}

function formatNumber(value: unknown) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "unknown";
  }

  if (Number.isInteger(value)) {
    return `${value}`;
  }

  return value.toFixed(1);
}

function formatBoolean(value: unknown, trueText = "yes", falseText = "no") {
  if (typeof value !== "boolean") {
    return "unknown";
  }

  return value ? trueText : falseText;
}

export function summarizeObservation(observation: MinecraftObservation) {
  const sanitized = sanitizeObservationForPrompt(observation);
  const bot = isRecord(sanitized.bot) ? sanitized.bot : {};
  const survival = isRecord(sanitized.survival) ? sanitized.survival : {};
  const vitals = isRecord(survival.vitals) ? survival.vitals : {};
  const yard = isRecord(survival.yard) ? survival.yard : {};
  const actionQueue = isRecord(sanitized.actionQueue) ? sanitized.actionQueue : {};
  const recentEvents = Array.isArray(sanitized.recentEvents)
    ? sanitized.recentEvents.filter(isRecord)
    : [];

  const eventSummary = recentEvents
    .map((event) => {
      const type = readString(event.type, 60) ?? "event";
      const detail = readString(event.detail, 120) ?? "";
      return detail ? `${type}: ${detail}` : type;
    })
    .slice(-3);

  return [
    `timestamp=${readString(sanitized.timestamp, 80) ?? "unknown"}`,
    `bot=${readString(bot.username, 80) ?? "unknown"}`,
    `position=${formatNumber(bot.x)},${formatNumber(bot.y)},${formatNumber(bot.z)}`,
    `health=${formatNumber(vitals.health)}/${formatNumber(vitals.maxHealth)}`,
    `food=${formatNumber(vitals.food)} saturation=${formatNumber(vitals.saturation)}`,
    `danger=${readString(vitals.danger, 80) ?? "unknown"}`,
    `yard_enabled=${formatBoolean(yard.enabled)}`,
    `inside_yard=${formatBoolean(yard.insideRadius)}`,
    `queue_active=${readString(actionQueue.active, 80) ?? "none"}`,
    `queue_busy=${formatBoolean(actionQueue.busy)}`,
    eventSummary.length > 0 ? `recent=${eventSummary.join(" | ")}` : "recent=none",
  ].join("; ");
}

export function normalizeConfidence(value: unknown): MinecraftDecisionConfidence {
  if (typeof value !== "string") {
    return "low";
  }

  const normalized = value.trim().toLowerCase();

  if (normalized.startsWith("high")) {
    return "high";
  }

  if (normalized.startsWith("med")) {
    return "medium";
  }

  if (normalized.startsWith("low")) {
    return "low";
  }

  return "low";
}

export function normalizeAllowedActionsFromEnv() {
  const raw = process.env.MINECRAFT_SUPERVISED_ALLOWED_ACTIONS;
  const source = raw && raw.trim().length > 0 ? raw : DEFAULT_SUPERVISED_ACTION_KEYS.join(",");

  const normalized: MinecraftSupervisedActionKey[] = [];

  for (const item of source.split(",")) {
    const key = item.trim().toLowerCase() as MinecraftSupervisedActionKey;

    if (!key || !(key in SUPERVISED_ACTION_KEY_TO_TYPES)) {
      continue;
    }

    if (!normalized.includes(key)) {
      normalized.push(key);
    }
  }

  if (normalized.length === 0) {
    return [...DEFAULT_SUPERVISED_ACTION_KEYS];
  }

  return normalized;
}
