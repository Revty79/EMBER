import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  minecraftBridgeSettings,
  type MinecraftBridgeSettingsRecord,
} from "@/db/schema";

const SETTINGS_ROW_ID = "default";
const SHADOW_INTERVAL_MIN_MS = 30_000;
const SHADOW_INTERVAL_MAX_MS = 3_600_000;
const SHADOW_TIMEOUT_MIN_MS = 30_000;
const SHADOW_TIMEOUT_MAX_MS = 3_600_000;
const NOTES_MAX_LENGTH = 4_000;

export const MINECRAFT_SETTINGS_VERSION = 1;

export const MINECRAFT_DANGEROUS_SETTING_FIELDS = [
  "supervisedEnabled",
  "aiBridgeEnabled",
  "allowCropHarvest",
  "allowCombat",
  "allowBuilding",
  "allowCrafting",
  "allowContainers",
] as const;

const MINECRAFT_SAFE_MUTABLE_SETTING_FIELDS = [
  "shadowEnabled",
  "shadowStoreObservations",
  "shadowChatSummary",
  "shadowObservationIntervalMs",
  "shadowTimeoutMs",
  "bridgeDebug",
  "taskSystemEnabled",
  "allowEating",
  "allowEquip",
  "allowFlee",
  "allowMining",
  "allowHarvest",
  "allowWander",
  "notes",
] as const;

const MINECRAFT_MUTABLE_SETTING_FIELDS = [
  ...MINECRAFT_SAFE_MUTABLE_SETTING_FIELDS,
  ...MINECRAFT_DANGEROUS_SETTING_FIELDS,
] as const;

type MinecraftMutableSettingField = (typeof MINECRAFT_MUTABLE_SETTING_FIELDS)[number];

type MinecraftBooleanSettingField = Exclude<
  MinecraftMutableSettingField,
  "shadowObservationIntervalMs" | "shadowTimeoutMs" | "notes"
>;

export type MinecraftBridgeDesiredSettings = {
  shadowEnabled: boolean;
  shadowStoreObservations: boolean;
  shadowChatSummary: boolean;
  shadowObservationIntervalMs: number;
  shadowTimeoutMs: number;
  bridgeDebug: boolean;
  supervisedEnabled: boolean;
  aiBridgeEnabled: boolean;
  taskSystemEnabled: boolean;
  allowEating: boolean;
  allowEquip: boolean;
  allowFlee: boolean;
  allowMining: boolean;
  allowHarvest: boolean;
  allowWander: boolean;
  allowCropHarvest: boolean;
  allowCombat: boolean;
  allowBuilding: boolean;
  allowCrafting: boolean;
  allowContainers: boolean;
  notes: string | null;
};

export type MinecraftBridgeServiceSettings = Omit<MinecraftBridgeDesiredSettings, "notes">;

export type MinecraftDesiredSettingsSnapshot = {
  settingsVersion: number;
  updatedAt: string;
  updatedBy: string | null;
  settings: MinecraftBridgeDesiredSettings;
};

export class MinecraftSettingsValidationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "MinecraftSettingsValidationError";
    this.status = status;
  }
}

const DEFAULT_SETTINGS: MinecraftBridgeDesiredSettings = {
  shadowEnabled: false,
  shadowStoreObservations: true,
  shadowChatSummary: false,
  shadowObservationIntervalMs: 180_000,
  shadowTimeoutMs: 180_000,
  bridgeDebug: false,
  supervisedEnabled: false,
  aiBridgeEnabled: false,
  taskSystemEnabled: true,
  allowEating: true,
  allowEquip: true,
  allowFlee: true,
  allowMining: true,
  allowHarvest: true,
  allowWander: true,
  allowCropHarvest: false,
  allowCombat: false,
  allowBuilding: false,
  allowCrafting: false,
  allowContainers: false,
  notes: null,
};

const BOOLEAN_SETTING_FIELDS: MinecraftBooleanSettingField[] = [
  "shadowEnabled",
  "shadowStoreObservations",
  "shadowChatSummary",
  "bridgeDebug",
  "supervisedEnabled",
  "aiBridgeEnabled",
  "taskSystemEnabled",
  "allowEating",
  "allowEquip",
  "allowFlee",
  "allowMining",
  "allowHarvest",
  "allowWander",
  "allowCropHarvest",
  "allowCombat",
  "allowBuilding",
  "allowCrafting",
  "allowContainers",
];

const BOOLEAN_SETTING_FIELD_SET = new Set<string>(BOOLEAN_SETTING_FIELDS);
const DANGEROUS_SETTING_FIELD_SET = new Set<string>(MINECRAFT_DANGEROUS_SETTING_FIELDS);
const MUTABLE_SETTING_FIELD_SET = new Set<string>(MINECRAFT_MUTABLE_SETTING_FIELDS);

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneDefaultSettings(): MinecraftBridgeDesiredSettings {
  return { ...DEFAULT_SETTINGS };
}

function normalizeSettingsRow(
  row: MinecraftBridgeSettingsRecord | null | undefined,
): MinecraftBridgeDesiredSettings {
  if (!row) {
    return cloneDefaultSettings();
  }

  return {
    shadowEnabled: row.shadowEnabled,
    shadowStoreObservations: row.shadowStoreObservations,
    shadowChatSummary: row.shadowChatSummary,
    shadowObservationIntervalMs: row.shadowObservationIntervalMs,
    shadowTimeoutMs: row.shadowTimeoutMs,
    bridgeDebug: row.bridgeDebug,
    supervisedEnabled: row.supervisedEnabled,
    aiBridgeEnabled: row.aiBridgeEnabled,
    taskSystemEnabled: row.taskSystemEnabled,
    allowEating: row.allowEating,
    allowEquip: row.allowEquip,
    allowFlee: row.allowFlee,
    allowMining: row.allowMining,
    allowHarvest: row.allowHarvest,
    allowWander: row.allowWander,
    allowCropHarvest: row.allowCropHarvest,
    allowCombat: row.allowCombat,
    allowBuilding: row.allowBuilding,
    allowCrafting: row.allowCrafting,
    allowContainers: row.allowContainers,
    notes: row.notes,
  };
}

function parseBooleanSetting(field: string, value: unknown) {
  if (typeof value !== "boolean") {
    throw new MinecraftSettingsValidationError(`${field} must be a boolean.`);
  }

  return value;
}

function parseIntegerSetting(
  field: string,
  value: unknown,
  minValue: number,
  maxValue: number,
) {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new MinecraftSettingsValidationError(`${field} must be an integer.`);
  }

  if (value < minValue || value > maxValue) {
    throw new MinecraftSettingsValidationError(
      `${field} must be between ${minValue} and ${maxValue}.`,
    );
  }

  return value;
}

function parseNotes(value: unknown) {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new MinecraftSettingsValidationError("notes must be a string or null.");
  }

  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  if (normalized.length > NOTES_MAX_LENGTH) {
    throw new MinecraftSettingsValidationError(
      `notes must be ${NOTES_MAX_LENGTH} characters or fewer.`,
    );
  }

  return normalized;
}

function parseSettingsPatch(
  patch: unknown,
  allowDangerousUpdates: boolean,
): Partial<MinecraftBridgeDesiredSettings> {
  if (!isRecord(patch)) {
    throw new MinecraftSettingsValidationError("Settings patch body must be a JSON object.");
  }

  const keys = Object.keys(patch);

  if (keys.length === 0) {
    throw new MinecraftSettingsValidationError("At least one settings field is required.");
  }

  for (const key of keys) {
    if (!MUTABLE_SETTING_FIELD_SET.has(key)) {
      throw new MinecraftSettingsValidationError(`Unknown settings field: ${key}.`);
    }

    if (!allowDangerousUpdates && DANGEROUS_SETTING_FIELD_SET.has(key)) {
      throw new MinecraftSettingsValidationError(
        `${key} is locked. Enable MINECRAFT_ADMIN_ALLOW_DANGEROUS_SETTINGS=true to override.`,
        403,
      );
    }
  }

  const updates: Partial<MinecraftBridgeDesiredSettings> = {};

  for (const key of keys) {
    const value = patch[key];

    if (BOOLEAN_SETTING_FIELD_SET.has(key)) {
      const typedKey = key as MinecraftBooleanSettingField;
      updates[typedKey] = parseBooleanSetting(key, value);
      continue;
    }

    if (key === "shadowObservationIntervalMs") {
      updates.shadowObservationIntervalMs = parseIntegerSetting(
        key,
        value,
        SHADOW_INTERVAL_MIN_MS,
        SHADOW_INTERVAL_MAX_MS,
      );
      continue;
    }

    if (key === "shadowTimeoutMs") {
      updates.shadowTimeoutMs = parseIntegerSetting(
        key,
        value,
        SHADOW_TIMEOUT_MIN_MS,
        SHADOW_TIMEOUT_MAX_MS,
      );
      continue;
    }

    if (key === "notes") {
      updates.notes = parseNotes(value);
      continue;
    }
  }

  return updates;
}

export function isDangerousMinecraftSettingsOverrideEnabled() {
  return readBooleanEnv("MINECRAFT_ADMIN_ALLOW_DANGEROUS_SETTINGS", false);
}

export function getMinecraftDesiredSettingsDefaults(): MinecraftBridgeDesiredSettings {
  return cloneDefaultSettings();
}

export function toMinecraftServiceSettings(
  settings: MinecraftBridgeDesiredSettings,
): MinecraftBridgeServiceSettings {
  return {
    shadowEnabled: settings.shadowEnabled,
    shadowStoreObservations: settings.shadowStoreObservations,
    shadowChatSummary: settings.shadowChatSummary,
    shadowObservationIntervalMs: settings.shadowObservationIntervalMs,
    shadowTimeoutMs: settings.shadowTimeoutMs,
    bridgeDebug: settings.bridgeDebug,
    supervisedEnabled: settings.supervisedEnabled,
    aiBridgeEnabled: settings.aiBridgeEnabled,
    taskSystemEnabled: settings.taskSystemEnabled,
    allowEating: settings.allowEating,
    allowEquip: settings.allowEquip,
    allowFlee: settings.allowFlee,
    allowMining: settings.allowMining,
    allowHarvest: settings.allowHarvest,
    allowWander: settings.allowWander,
    allowCropHarvest: settings.allowCropHarvest,
    allowCombat: settings.allowCombat,
    allowBuilding: settings.allowBuilding,
    allowCrafting: settings.allowCrafting,
    allowContainers: settings.allowContainers,
  };
}

async function ensureSettingsRow() {
  const db = getDb();

  await db
    .insert(minecraftBridgeSettings)
    .values({
      id: SETTINGS_ROW_ID,
      ...cloneDefaultSettings(),
    })
    .onConflictDoNothing({
      target: minecraftBridgeSettings.id,
    });
}

export async function getMinecraftDesiredSettingsSnapshot(): Promise<MinecraftDesiredSettingsSnapshot> {
  await ensureSettingsRow();
  const db = getDb();

  const [row] = await db
    .select()
    .from(minecraftBridgeSettings)
    .where(eq(minecraftBridgeSettings.id, SETTINGS_ROW_ID))
    .limit(1);

  return {
    settingsVersion: MINECRAFT_SETTINGS_VERSION,
    updatedAt: row?.updatedAt.toISOString() ?? new Date().toISOString(),
    updatedBy: row?.updatedBy ?? null,
    settings: normalizeSettingsRow(row),
  };
}

export async function updateMinecraftDesiredSettings(
  patch: unknown,
  updatedBy: string | null,
  allowDangerousUpdates: boolean,
): Promise<MinecraftDesiredSettingsSnapshot> {
  const updates = parseSettingsPatch(patch, allowDangerousUpdates);
  const db = getDb();
  const now = new Date();
  const normalizedUpdatedBy = updatedBy && updatedBy.trim().length > 0 ? updatedBy.trim() : null;

  const [row] = await db
    .insert(minecraftBridgeSettings)
    .values({
      id: SETTINGS_ROW_ID,
      ...cloneDefaultSettings(),
      ...updates,
      updatedAt: now,
      updatedBy: normalizedUpdatedBy,
    })
    .onConflictDoUpdate({
      target: minecraftBridgeSettings.id,
      set: {
        ...updates,
        updatedAt: now,
        updatedBy: normalizedUpdatedBy,
      },
    })
    .returning();

  return {
    settingsVersion: MINECRAFT_SETTINGS_VERSION,
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy ?? null,
    settings: normalizeSettingsRow(row),
  };
}
