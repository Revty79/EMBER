export type MinecraftBridgeMode = "shadow" | "supervised";

export type MinecraftDecisionConfidence = "low" | "medium" | "high";

export type MinecraftSupervisedActionKey =
  | "status"
  | "look"
  | "eat_if_hungry"
  | "go_home"
  | "flee"
  | "wander_yard"
  | "stop";

export type MinecraftSupervisedActionType =
  | "REPORT_STATUS"
  | "LOOK_AT_OWNER"
  | "REPORT_LOOK"
  | "EAT_FOOD"
  | "GO_HOME"
  | "FLEE_DANGER"
  | "WANDER_SAFE"
  | "STOP_MOVING";

export type MinecraftRequestedAction = {
  type: MinecraftSupervisedActionType;
  reason: string;
};

export type MinecraftVitals = {
  health?: number;
  maxHealth?: number;
  food?: number;
  saturation?: number;
  oxygen?: number;
  danger?: string;
  status?: string;
  [key: string]: unknown;
};

export type MinecraftYardState = {
  enabled?: boolean;
  insideRadius?: boolean;
  distanceFromHome?: number;
  homeName?: string;
  [key: string]: unknown;
};

export type MinecraftSafetyFlags = {
  hostileNearby?: boolean;
  takingDamage?: boolean;
  lowHealth?: boolean;
  lowFood?: boolean;
  outsideSafeArea?: boolean;
  stuck?: boolean;
  isNight?: boolean;
  [key: string]: unknown;
};

export type MinecraftActionQueueSummary = {
  active?: string;
  queuedCount?: number;
  busy?: boolean;
  paused?: boolean;
  blockedReason?: string;
  [key: string]: unknown;
};

export type MinecraftRecentEvent = {
  timestamp?: string;
  type?: string;
  detail?: string;
  severity?: string;
  [key: string]: unknown;
};

export type MinecraftObservation = {
  timestamp?: string;
  bot?: {
    username?: string;
    ownerUsername?: string;
    dimension?: string;
    x?: number;
    y?: number;
    z?: number;
    [key: string]: unknown;
  };
  perception?: Record<string, unknown>;
  survival?: {
    vitals?: MinecraftVitals;
    equipment?: Record<string, unknown>;
    food?: Record<string, unknown>;
    mining?: Record<string, unknown>;
    harvesting?: Record<string, unknown>;
    visibleOres?: unknown[];
    mineableOres?: unknown[];
    targetBlock?: Record<string, unknown> | string;
    homeProtection?: Record<string, unknown>;
    yard?: MinecraftYardState;
    safetyFlags?: MinecraftSafetyFlags;
    [key: string]: unknown;
  };
  actionQueue?: MinecraftActionQueueSummary;
  recentEvents?: MinecraftRecentEvent[];
  [key: string]: unknown;
};

export type MinecraftShadowResponse = {
  mode: "shadow";
  executed: false;
  reply: string;
  wouldDo: string;
  confidence: MinecraftDecisionConfidence;
  allowedActionTypes: MinecraftSupervisedActionType[];
  actions: [];
  logId?: string;
};

export type MinecraftSupervisedResponse = {
  mode: "supervised";
  enabled: boolean;
  executed: false;
  reply: string;
  wouldDo?: string;
  confidence?: MinecraftDecisionConfidence;
  allowedActionTypes?: MinecraftSupervisedActionType[];
  actions: MinecraftRequestedAction[];
  logId?: string;
};

export const DEFAULT_SUPERVISED_ACTION_KEYS: MinecraftSupervisedActionKey[] = [
  "status",
  "look",
  "eat_if_hungry",
  "go_home",
  "flee",
  "wander_yard",
  "stop",
];

export const SUPERVISED_ACTION_KEY_TO_TYPES: Record<
  MinecraftSupervisedActionKey,
  MinecraftSupervisedActionType[]
> = {
  status: ["REPORT_STATUS"],
  look: ["LOOK_AT_OWNER", "REPORT_LOOK"],
  eat_if_hungry: ["EAT_FOOD"],
  go_home: ["GO_HOME"],
  flee: ["FLEE_DANGER"],
  wander_yard: ["WANDER_SAFE"],
  stop: ["STOP_MOVING"],
};
