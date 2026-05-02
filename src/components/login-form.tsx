"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./login-form.module.css";

type LoginResponse = {
  error?: string;
};

type SetupResponse = {
  error?: string;
};

type LoginFormProps = {
  setupOpen: boolean;
};

export default function LoginForm({ setupOpen }: LoginFormProps) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [setupUsername, setSetupUsername] = useState("");
  const [setupName, setSetupName] = useState("");
  const [setupEmail, setSetupEmail] = useState("");
  const [setupPassword, setSetupPassword] = useState("");
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [setupError, setSetupError] = useState("");

  const canSubmit = username.trim().length > 0 && password.length > 0 && !isLoading;
  const canSetup =
    setupOpen &&
    setupUsername.trim().length > 0 &&
    setupName.trim().length > 0 &&
    setupEmail.trim().length > 0 &&
    setupPassword.length >= 8 &&
    !isSettingUp;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      const data = (await response.json().catch(() => null)) as LoginResponse | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "Login failed.");
      }

      router.push("/");
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Login failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSetup) {
      return;
    }

    setIsSettingUp(true);
    setSetupError("");

    try {
      const response = await fetch("/api/setup/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: setupUsername.trim(),
          name: setupName.trim(),
          email: setupEmail.trim(),
          password: setupPassword,
        }),
      });

      const data = (await response.json().catch(() => null)) as SetupResponse | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "Could not create admin account.");
      }

      router.push("/");
      router.refresh();
    } catch (requestError) {
      setSetupError(
        requestError instanceof Error ? requestError.message : "Could not create admin account.",
      );
    } finally {
      setIsSettingUp(false);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.kicker}>Enhanced Memory Backbone for Everyday Reasoning</p>
        <h1 className={styles.title}>EMBER</h1>
        <p className={styles.subtitle}>
          Sign in with your family username to open your private chat.
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <label htmlFor="username" className={styles.label}>
            Username
          </label>
          <input
            id="username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className={styles.input}
            placeholder="family-username"
          />

          <label htmlFor="password" className={styles.label}>
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={styles.input}
            placeholder="Your password"
          />

          {error ? <p className={styles.error}>{error}</p> : null}

          <button type="submit" className={styles.button} disabled={!canSubmit}>
            {isLoading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        {setupOpen ? (
          <section className={styles.setup}>
            <h2 className={styles.setupTitle}>First-Time Setup</h2>
            <p className={styles.setupText}>
              No accounts exist yet. Create your first admin account to unlock EMBER.
            </p>
            <form onSubmit={handleSetup} className={styles.form}>
              <label htmlFor="setup-username" className={styles.label}>
                Admin Username
              </label>
              <input
                id="setup-username"
                type="text"
                autoComplete="username"
                value={setupUsername}
                onChange={(event) => setSetupUsername(event.target.value)}
                className={styles.input}
                placeholder="familyadmin"
              />

              <label htmlFor="setup-name" className={styles.label}>
                Full Name
              </label>
              <input
                id="setup-name"
                type="text"
                autoComplete="name"
                value={setupName}
                onChange={(event) => setSetupName(event.target.value)}
                className={styles.input}
                placeholder="Family Admin"
              />

              <label htmlFor="setup-email" className={styles.label}>
                Email
              </label>
              <input
                id="setup-email"
                type="email"
                autoComplete="email"
                value={setupEmail}
                onChange={(event) => setSetupEmail(event.target.value)}
                className={styles.input}
                placeholder="admin@example.com"
              />

              <label htmlFor="setup-password" className={styles.label}>
                Password (8+ chars)
              </label>
              <input
                id="setup-password"
                type="password"
                autoComplete="new-password"
                value={setupPassword}
                onChange={(event) => setSetupPassword(event.target.value)}
                className={styles.input}
                placeholder="Choose a strong password"
              />

              {setupError ? <p className={styles.error}>{setupError}</p> : null}

              <button type="submit" className={styles.button} disabled={!canSetup}>
                {isSettingUp ? "Creating..." : "Create First Admin"}
              </button>
            </form>
          </section>
        ) : (
          <p className={styles.setupText}>
            Need an account? Sign in as an admin and use the sidebar &quot;Create Family
            Account&quot; form.
          </p>
        )}
      </section>
    </main>
  );
}
