"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import styles from "./ember-instructions-form.module.css";
import type { EmberIdentityProfile } from "@/lib/ember-profile";

type EmberInstructionsFormProps = {
  initialProfile: EmberIdentityProfile;
  editorName: string;
};

type EmberInstructionsResponse = {
  profile?: EmberIdentityProfile;
  error?: string;
};

export default function EmberInstructionsForm({
  initialProfile,
  editorName,
}: EmberInstructionsFormProps) {
  const [form, setForm] = useState<EmberIdentityProfile>(initialProfile);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const updateField = (key: keyof EmberIdentityProfile, value: string) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/admin/ember-instructions", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = (await response.json().catch(() => null)) as EmberInstructionsResponse | null;

      if (!response.ok || !data?.profile) {
        throw new Error(data?.error ?? "Could not save EMBER instructions.");
      }

      setForm(data.profile);
      setNotice("EMBER instructions updated.");
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Could not save EMBER instructions.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <header className={styles.header}>
          <p className={styles.kicker}>Admin Console</p>
          <h1 className={styles.title}>EMBER Instructions</h1>
          <p className={styles.subtitle}>
            Tune EMBER&apos;s personality and boundaries. These instructions are injected into every
            chat session.
          </p>
          <p className={styles.editor}>Editing as {editorName}</p>
        </header>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.label}>
            Name
            <input
              className={styles.input}
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
            />
          </label>

          <label className={styles.label}>
            Acronym
            <input
              className={styles.input}
              value={form.acronym}
              onChange={(event) => updateField("acronym", event.target.value)}
            />
          </label>

          <label className={styles.label}>
            Tone
            <textarea
              className={styles.textarea}
              value={form.tone}
              onChange={(event) => updateField("tone", event.target.value)}
              rows={2}
            />
          </label>

          <label className={styles.label}>
            Family Assistant Role
            <textarea
              className={styles.textarea}
              value={form.familyAssistantRole}
              onChange={(event) => updateField("familyAssistantRole", event.target.value)}
              rows={3}
            />
          </label>

          <label className={styles.label}>
            Privacy Boundaries
            <textarea
              className={styles.textarea}
              value={form.privacyBoundaries}
              onChange={(event) => updateField("privacyBoundaries", event.target.value)}
              rows={3}
            />
          </label>

          <label className={styles.label}>
            Response Style
            <textarea
              className={styles.textarea}
              value={form.responseStyle}
              onChange={(event) => updateField("responseStyle", event.target.value)}
              rows={3}
            />
          </label>

          <label className={styles.label}>
            Allowed Initiative
            <textarea
              className={styles.textarea}
              value={form.allowedInitiative}
              onChange={(event) => updateField("allowedInitiative", event.target.value)}
              rows={3}
            />
          </label>

          <label className={styles.label}>
            Forbidden Actions
            <textarea
              className={styles.textarea}
              value={form.forbiddenActions}
              onChange={(event) => updateField("forbiddenActions", event.target.value)}
              rows={3}
            />
          </label>

          <label className={styles.label}>
            Uncertainty Behavior
            <textarea
              className={styles.textarea}
              value={form.uncertaintyBehavior}
              onChange={(event) => updateField("uncertaintyBehavior", event.target.value)}
              rows={3}
            />
          </label>

          <label className={styles.label}>
            Memory Behavior
            <textarea
              className={styles.textarea}
              value={form.memoryBehavior}
              onChange={(event) => updateField("memoryBehavior", event.target.value)}
              rows={3}
            />
          </label>

          <label className={styles.label}>
            Additional Instructions
            <textarea
              className={styles.textarea}
              value={form.additionalInstructions}
              onChange={(event) => updateField("additionalInstructions", event.target.value)}
              rows={4}
              placeholder="Optional extra personality instructions..."
            />
          </label>

          {error ? <p className={styles.error}>{error}</p> : null}
          {!error && notice ? <p className={styles.notice}>{notice}</p> : null}

          <div className={styles.actions}>
            <Link className={styles.linkButton} href="/">
              Back to Chat
            </Link>
            <button className={styles.saveButton} type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Instructions"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
