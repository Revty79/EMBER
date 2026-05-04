import Link from "next/link";
import { redirect } from "next/navigation";
import styles from "./page.module.css";
import { getCurrentUser } from "@/lib/auth";
import {
  getMinecraftBridgeConfig,
  getRecentMinecraftBridgeLogs,
  type MinecraftBridgeLogView,
} from "@/lib/minecraft/bridge";

export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function numberOrDash(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? `${value}` : "-";
}

function stringOrDash(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : "-";
}

function booleanOrDash(value: unknown) {
  return typeof value === "boolean" ? (value ? "yes" : "no") : "-";
}

function extractVitals(log: MinecraftBridgeLogView) {
  const survival = isRecord(log.observation.survival) ? log.observation.survival : undefined;
  const vitals = isRecord(survival?.vitals) ? survival.vitals : undefined;

  return {
    health: numberOrDash(vitals?.health),
    food: numberOrDash(vitals?.food),
    danger: stringOrDash(vitals?.danger),
  };
}

function extractYard(log: MinecraftBridgeLogView) {
  const survival = isRecord(log.observation.survival) ? log.observation.survival : undefined;
  const yard = isRecord(survival?.yard) ? survival.yard : undefined;

  return {
    enabled: booleanOrDash(yard?.enabled),
    insideRadius: booleanOrDash(yard?.insideRadius),
  };
}

function renderActions(log: MinecraftBridgeLogView) {
  if (log.requestedActions.length === 0) {
    return "[]";
  }

  return JSON.stringify(log.requestedActions);
}

export default async function MinecraftAdminPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "admin") {
    redirect("/");
  }

  const config = getMinecraftBridgeConfig();
  let logs = [] as MinecraftBridgeLogView[];
  let logsError = "";

  try {
    logs = await getRecentMinecraftBridgeLogs(config.shadowMaxRecent);
  } catch (error) {
    logsError = error instanceof Error ? error.message : "Could not load bridge logs.";
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Admin Review</p>
          <h1 className={styles.title}>Minecraft Bridge</h1>
          <p className={styles.subtitle}>Observation and decision logs only. No command execution.</p>
        </div>
        <Link href="/" className={styles.backLink}>
          Back To Chat
        </Link>
      </header>

      <section className={styles.summaryGrid}>
        <article className={styles.card}>
          <h2>Bridge Status</h2>
          <p>Shadow enabled: {config.shadowEnabled ? "true" : "false"}</p>
          <p>Supervised enabled: {config.supervisedEnabled ? "true" : "false"}</p>
          <p>Actions executed: false</p>
          <p>Recent cap: {config.shadowMaxRecent}</p>
        </article>

        <article className={styles.card}>
          <h2>Supervised Rules</h2>
          <p>Max actions: {config.supervisedMaxActions}</p>
          <p>Required confidence: {config.supervisedRequireConfidence}</p>
          <p>Allowed actions: {config.supervisedAllowedActionTypes.join(", ") || "none"}</p>
        </article>
      </section>

      <section className={styles.logsSection}>
        <h2>Recent Logs ({logs.length})</h2>
        {logsError ? (
          <p className={styles.error}>Could not load logs yet: {logsError}</p>
        ) : logs.length === 0 ? (
          <p className={styles.empty}>No Minecraft bridge logs yet.</p>
        ) : (
          <div className={styles.logList}>
            {logs.map((log) => {
              const vitals = extractVitals(log);
              const yard = extractYard(log);

              return (
                <article key={log.id} className={styles.logCard}>
                  <div className={styles.logTopRow}>
                    <p className={styles.logTitle}>
                      {log.mode.toUpperCase()} | {stringOrDash(log.botUsername)}
                    </p>
                    <p className={styles.logTime}>{formatDate(log.createdAt)}</p>
                  </div>

                  <p className={styles.meta}>logId: {log.id}</p>
                  <p className={styles.meta}>health: {vitals.health} | food: {vitals.food} | danger: {vitals.danger}</p>
                  <p className={styles.meta}>
                    yard enabled: {yard.enabled} | inside radius: {yard.insideRadius}
                  </p>
                  <p className={styles.meta}>executed: {log.executed ? "true" : "false"}</p>

                  {log.observationSummary ? <p className={styles.block}>observation: {log.observationSummary}</p> : null}
                  {log.shadowReply ? <p className={styles.block}>reply: {log.shadowReply}</p> : null}
                  {log.wouldDo ? <p className={styles.block}>wouldDo: {log.wouldDo}</p> : null}

                  <p className={styles.block}>actions: {renderActions(log)}</p>

                  {log.error ? <p className={styles.error}>error: {log.error}</p> : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
