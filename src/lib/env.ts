type EnvKey = "DATABASE_URL" | "APP_SECRET" | "OLLAMA_BASE_URL" | "OLLAMA_MODEL";

export function requireEnv(name: EnvKey) {
  const value = process.env[name];

  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}
