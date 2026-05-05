"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./minecraft-control-panel.module.css";

type MinecraftDesiredSettings = {
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

type AdminSettingsResponse = {
  source: string;
  mode: string;
  settingsVersion: number;
  updatedAt: string;
  updatedBy: string | null;
  dangerousSettingsLocked: boolean;
  dangerousFields: string[];
  settings: MinecraftDesiredSettings;
  error?: string;
};

type HealthResponse = {
  ok: boolean;
  service: string;
  shadowEnabled: boolean;
  supervisedEnabled: boolean;
  actionsEnabled: boolean;
  timestamp: string;
  error?: string;
};

type MinecraftLogAction = {
  type: string;
  reason: string;
};

type MinecraftBridgeLog = {
  id: string;
  createdAt: string;
  mode: string;
  observationTimestamp: string | null;
  botUsername: string | null;
  observation: Record<string, unknown>;
  observationSummary: string | null;
  shadowReply: string | null;
  wouldDo: string | null;
  confidence: string | null;
  requestedActions: MinecraftLogAction[];
  executed: boolean;
  error: string | null;
};

type RecentLogsResponse = {
  count: number;
  logs: MinecraftBridgeLog[];
  error?: string;
};

type MinecraftControlPanelProps = {
  editorName: string;
};

type SafeSettingsPatch = Pick<
  MinecraftDesiredSettings,
  | "shadowEnabled"
  | "shadowStoreObservations"
  | "shadowChatSummary"
  | "shadowObservationIntervalMs"
  | "shadowTimeoutMs"
  | "bridgeDebug"
  | "taskSystemEnabled"
  | "allowEating"
  | "allowEquip"
  | "allowFlee"
  | "allowMining"
  | "allowHarvest"
  | "allowWander"
  | "notes"
>;

const DEFAULT_SETTINGS: MinecraftDesiredSettings = {
  shadowEnabled: false,
  shadowStoreObservations: true,
  shadowChatSummary: false,
  shadowObservationIntervalMs: 180000,
  shadowTimeoutMs: 180000,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function boolLabel(value: boolean) {
  return value ? "true" : "false";
}

function getLogVitals(log: MinecraftBridgeLog | null) {
  if (!log) {
    return { health: "-", food: "-", danger: "-" };
  }

  const survival = isRecord(log.observation.survival) ? log.observation.survival : null;
  const vitals = isRecord(survival?.vitals) ? survival.vitals : null;

  return {
    health: readNumber(vitals?.health)?.toString() ?? "-",
    food: readNumber(vitals?.food)?.toString() ?? "-",
    danger: readString(vitals?.danger) ?? "-",
  };
}

function getQueueSummary(log: MinecraftBridgeLog | null) {
  if (!log) {
    return "none";
  }

  const queue = isRecord(log.observation.actionQueue) ? log.observation.actionQueue : null;
  const active = readString(queue?.active) ?? "none";
  const queuedCount = readNumber(queue?.queuedCount);
  const busy = typeof queue?.busy === "boolean" ? queue.busy : null;

  return `${active} | queued=${queuedCount ?? "-"} | busy=${busy === null ? "-" : busy ? "yes" : "no"}`;
}

function truncateText(text: string | null, maxChars = 180) {
  if (!text) {
    return null;
  }

  if (text.length <= maxChars) {
    return text;
  }

  return `${text.slice(0, maxChars - 3).trimEnd()}...`;
}

function buildSafePatch(settings: MinecraftDesiredSettings): SafeSettingsPatch {
  return {
    shadowEnabled: settings.shadowEnabled,
    shadowStoreObservations: settings.shadowStoreObservations,
    shadowChatSummary: settings.shadowChatSummary,
    shadowObservationIntervalMs: settings.shadowObservationIntervalMs,
    shadowTimeoutMs: settings.shadowTimeoutMs,
    bridgeDebug: settings.bridgeDebug,
    taskSystemEnabled: settings.taskSystemEnabled,
    allowEating: settings.allowEating,
    allowEquip: settings.allowEquip,
    allowFlee: settings.allowFlee,
    allowMining: settings.allowMining,
    allowHarvest: settings.allowHarvest,
    allowWander: settings.allowWander,
    notes: settings.notes,
  };
}

function CollapsibleText({
  label,
  text,
}: {
  label: string;
  text: string | null;
}) {
  if (!text) {
    return (
      <p className={styles.logLine}>
        {label}: -
      </p>
    );
  }

  if (text.length <= 220) {
    return (
      <p className={styles.logLine}>
        {label}: {text}
      </p>
    );
  }

  return (
    <details className={styles.logDetails}>
      <summary>
        {label}: {truncateText(text, 200)}
      </summary>
      <p className={styles.logExpanded}>{text}</p>
    </details>
  );
}

export default function MinecraftControlPanel({ editorName }: MinecraftControlPanelProps) {
  const [settingsEnvelope, setSettingsEnvelope] = useState<AdminSettingsResponse | null>(null);
  const [settingsForm, setSettingsForm] = useState<MinecraftDesiredSettings>(DEFAULT_SETTINGS);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [logs, setLogs] = useState<MinecraftBridgeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const [notice, setNotice] = useState("");

  const loadControlData = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    setNotice("");

    try {
      const [settingsResponse, healthResponse, logsResponse] = await Promise.all([
        fetch("/api/admin/minecraft/settings"),
        fetch("/api/minecraft/health"),
        fetch("/api/minecraft/recent?limit=25"),
      ]);

      const settingsPayload = (await settingsResponse
        .json()
        .catch(() => null)) as AdminSettingsResponse | null;
      const healthPayload = (await healthResponse.json().catch(() => null)) as HealthResponse | null;
      const logsPayload = (await logsResponse.json().catch(() => null)) as RecentLogsResponse | null;

      if (!settingsResponse.ok || !settingsPayload?.settings) {
        throw new Error(settingsPayload?.error ?? "Could not load desired settings.");
      }

      setSettingsEnvelope(settingsPayload);
      setSettingsForm(settingsPayload.settings);

      if (healthResponse.ok && healthPayload && typeof healthPayload.ok === "boolean") {
        setHealth(healthPayload);
      } else {
        setHealth(null);
      }

      if (logsResponse.ok && Array.isArray(logsPayload?.logs)) {
        setLogs(logsPayload.logs);
      } else {
        setLogs([]);
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load control panel.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoadTimer = window.setTimeout(() => {
      void loadControlData();
    }, 0);

    return () => {
      window.clearTimeout(initialLoadTimer);
    };
  }, [loadControlData]);

  const latestLog = logs.length > 0 ? logs[0] : null;
  const latestShadowLog = logs.find((log) => log.mode === "shadow") ?? null;
  const latestErrorLog = logs.find((log) => Boolean(readString(log.error))) ?? null;
  const vitals = getLogVitals(latestLog);

  const shadowLogs = useMemo(() => logs.filter((log) => log.mode === "shadow"), [logs]);

  const updateToggle = (key: keyof MinecraftDesiredSettings, value: boolean) => {
    setSettingsForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const updateNumber = (key: "shadowObservationIntervalMs" | "shadowTimeoutMs", value: string) => {
    const parsed = Number.parseInt(value, 10);

    if (Number.isNaN(parsed)) {
      return;
    }

    setSettingsForm((current) => ({
      ...current,
      [key]: parsed,
    }));
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setSettingsError("");
    setNotice("");

    try {
      const response = await fetch("/api/admin/minecraft/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildSafePatch(settingsForm)),
      });

      const payload = (await response.json().catch(() => null)) as AdminSettingsResponse | null;

      if (!response.ok || !payload?.settings) {
        throw new Error(payload?.error ?? "Could not save settings.");
      }

      setSettingsEnvelope(payload);
      setSettingsForm(payload.settings);
      setNotice("Desired settings saved. Runtime apply is pending bot support.");
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Admin Mission Control</p>
          <h1 className={styles.title}>Minecraft Brain Control Panel</h1>
          <p className={styles.subtitle}>
            EMBER stores desired settings and logs. The body remains the final safety gate.
          </p>
          <p className={styles.editor}>Editing as {editorName}</p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.secondaryButton} onClick={() => void loadControlData()}>
            Refresh
          </button>
          <Link href="/" className={styles.backLink}>
            Back To Chat
          </Link>
        </div>
      </header>

      <p className={styles.warning}>
        These are desired settings stored in EMBER. The Minecraft body remains the final safety gate.
        Changing settings here does not directly execute actions.
      </p>

      <p className={styles.runtimeNotice}>Runtime apply: pending bot support</p>

      {loadError ? <p className={styles.error}>{loadError}</p> : null}
      {loading ? <p className={styles.muted}>Loading Minecraft control panel...</p> : null}

      <section className={styles.statusGrid}>
        <article className={styles.card}>
          <h2>Bridge Status</h2>
          <p>Bridge health: {health?.ok ? "ok" : "unavailable"}</p>
          <p>Shadow enabled (runtime): {health ? boolLabel(health.shadowEnabled) : "-"}</p>
          <p>Supervised enabled (runtime): {health ? boolLabel(health.supervisedEnabled) : "-"}</p>
          <p>Actions enabled (runtime): {health ? boolLabel(health.actionsEnabled) : "-"}</p>
        </article>

        <article className={styles.card}>
          <h2>Last Signals</h2>
          <p>Last observation: {formatDate(latestLog?.observationTimestamp ?? latestLog?.createdAt)}</p>
          <p>Last shadow response: {formatDate(latestShadowLog?.createdAt)}</p>
          <p>Last error: {readString(latestErrorLog?.error) ?? "-"}</p>
          <p>Last logId: {latestLog?.id ?? "-"}</p>
        </article>

        <article className={styles.card}>
          <h2>Bot Snapshot</h2>
          <p>Bot username: {latestLog?.botUsername ?? "-"}</p>
          <p>Health: {vitals.health}</p>
          <p>Food: {vitals.food}</p>
          <p>Danger: {vitals.danger}</p>
          <p>Current mode: {latestLog?.mode ?? "-"}</p>
          <p>Queue: {getQueueSummary(latestLog)}</p>
        </article>
      </section>

      <section className={styles.card}>
        <h2>Desired Settings</h2>
        <form className={styles.settingsForm} onSubmit={handleSave}>
          <label className={styles.toggleRow}>
            <span>Shadow Mode</span>
            <input
              type="checkbox"
              checked={settingsForm.shadowEnabled}
              onChange={(event) => updateToggle("shadowEnabled", event.target.checked)}
            />
          </label>

          <label className={styles.toggleRow}>
            <span>Store Observations</span>
            <input
              type="checkbox"
              checked={settingsForm.shadowStoreObservations}
              onChange={(event) => updateToggle("shadowStoreObservations", event.target.checked)}
            />
          </label>

          <label className={styles.toggleRow}>
            <span>Shadow Chat Summary</span>
            <input
              type="checkbox"
              checked={settingsForm.shadowChatSummary}
              onChange={(event) => updateToggle("shadowChatSummary", event.target.checked)}
            />
          </label>

          <label className={styles.inputRow}>
            <span>Shadow Observation Interval (ms)</span>
            <input
              type="number"
              min={30000}
              max={3600000}
              step={1000}
              value={settingsForm.shadowObservationIntervalMs}
              onChange={(event) => updateNumber("shadowObservationIntervalMs", event.target.value)}
            />
          </label>

          <label className={styles.inputRow}>
            <span>Shadow Timeout (ms)</span>
            <input
              type="number"
              min={30000}
              max={3600000}
              step={1000}
              value={settingsForm.shadowTimeoutMs}
              onChange={(event) => updateNumber("shadowTimeoutMs", event.target.value)}
            />
          </label>

          <label className={styles.toggleRow}>
            <span>Bridge Debug</span>
            <input
              type="checkbox"
              checked={settingsForm.bridgeDebug}
              onChange={(event) => updateToggle("bridgeDebug", event.target.checked)}
            />
          </label>

          <label className={styles.toggleRow}>
            <span>Task System</span>
            <input
              type="checkbox"
              checked={settingsForm.taskSystemEnabled}
              onChange={(event) => updateToggle("taskSystemEnabled", event.target.checked)}
            />
          </label>

          <label className={styles.toggleRow}>
            <span>Allow Eating</span>
            <input
              type="checkbox"
              checked={settingsForm.allowEating}
              onChange={(event) => updateToggle("allowEating", event.target.checked)}
            />
          </label>

          <label className={styles.toggleRow}>
            <span>Allow Equip</span>
            <input
              type="checkbox"
              checked={settingsForm.allowEquip}
              onChange={(event) => updateToggle("allowEquip", event.target.checked)}
            />
          </label>

          <label className={styles.toggleRow}>
            <span>Allow Flee</span>
            <input
              type="checkbox"
              checked={settingsForm.allowFlee}
              onChange={(event) => updateToggle("allowFlee", event.target.checked)}
            />
          </label>

          <label className={styles.toggleRow}>
            <span>Allow Mining</span>
            <input
              type="checkbox"
              checked={settingsForm.allowMining}
              onChange={(event) => updateToggle("allowMining", event.target.checked)}
            />
          </label>

          <label className={styles.toggleRow}>
            <span>Allow Harvest</span>
            <input
              type="checkbox"
              checked={settingsForm.allowHarvest}
              onChange={(event) => updateToggle("allowHarvest", event.target.checked)}
            />
          </label>

          <label className={styles.toggleRow}>
            <span>Allow Wander</span>
            <input
              type="checkbox"
              checked={settingsForm.allowWander}
              onChange={(event) => updateToggle("allowWander", event.target.checked)}
            />
          </label>

          <label className={styles.notesRow}>
            <span>Notes</span>
            <textarea
              rows={3}
              value={settingsForm.notes ?? ""}
              onChange={(event) =>
                setSettingsForm((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              placeholder="Optional operator notes for desired behavior..."
            />
          </label>

          {settingsError ? <p className={styles.error}>{settingsError}</p> : null}
          {!settingsError && notice ? <p className={styles.notice}>{notice}</p> : null}

          <div className={styles.saveRow}>
            <p className={styles.meta}>
              Updated: {formatDate(settingsEnvelope?.updatedAt)} by {settingsEnvelope?.updatedBy ?? "-"}
            </p>
            <button type="submit" className={styles.primaryButton} disabled={saving}>
              {saving ? "Saving..." : "Save Desired Settings"}
            </button>
          </div>
        </form>
      </section>

      <section className={styles.card}>
        <h2>Locked Safety Settings</h2>
        <p className={styles.muted}>
          Dangerous toggles are locked by default and remain off unless a server-side override is
          explicitly enabled.
        </p>

        <div className={styles.lockedGrid}>
          <label className={styles.toggleRow}>
            <span>AI Bridge</span>
            <input type="checkbox" checked={settingsForm.aiBridgeEnabled} disabled />
          </label>
          <label className={styles.toggleRow}>
            <span>Supervised Mode</span>
            <input type="checkbox" checked={settingsForm.supervisedEnabled} disabled />
          </label>
          <label className={styles.toggleRow}>
            <span>Combat</span>
            <input type="checkbox" checked={settingsForm.allowCombat} disabled />
          </label>
          <label className={styles.toggleRow}>
            <span>Building</span>
            <input type="checkbox" checked={settingsForm.allowBuilding} disabled />
          </label>
          <label className={styles.toggleRow}>
            <span>Crafting</span>
            <input type="checkbox" checked={settingsForm.allowCrafting} disabled />
          </label>
          <label className={styles.toggleRow}>
            <span>Containers</span>
            <input type="checkbox" checked={settingsForm.allowContainers} disabled />
          </label>
          <label className={styles.toggleRow}>
            <span>Crop Harvesting</span>
            <input type="checkbox" checked={settingsForm.allowCropHarvest} disabled />
          </label>
        </div>
      </section>

      <section className={styles.card}>
        <h2>Recent Shadow Logs ({shadowLogs.length})</h2>
        {shadowLogs.length === 0 ? (
          <p className={styles.muted}>No shadow logs yet.</p>
        ) : (
          <div className={styles.logList}>
            {shadowLogs.map((log) => (
              <article key={log.id} className={styles.logCard}>
                <p className={styles.logHeading}>
                  {formatDate(log.createdAt)} | {log.botUsername ?? "-"} | confidence{" "}
                  {log.confidence ?? "-"}
                </p>
                <p className={styles.logLine}>logId: {log.id}</p>
                <p className={styles.logLine}>executed: {boolLabel(log.executed)}</p>
                <p className={styles.logLine}>action count: {log.requestedActions.length}</p>
                <p className={styles.logBadge}>Shadow guard: executed=false, actions=[]</p>

                <CollapsibleText label="observation" text={log.observationSummary} />
                <CollapsibleText label="reply" text={log.shadowReply} />
                <CollapsibleText label="wouldDo" text={log.wouldDo} />

                <details className={styles.logDetails}>
                  <summary>actions payload</summary>
                  <pre className={styles.actionsPre}>
                    {log.requestedActions.length === 0
                      ? "[]"
                      : JSON.stringify(log.requestedActions, null, 2)}
                  </pre>
                </details>

                {log.error ? <p className={styles.error}>error: {log.error}</p> : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
