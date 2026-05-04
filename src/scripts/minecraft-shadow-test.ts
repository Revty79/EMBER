import { readFile } from "node:fs/promises";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

function readArgValue(flag: string) {
  const args = process.argv.slice(2);
  const index = args.findIndex((value) => value === flag);

  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
}

async function main() {
  const baseUrl = (readArgValue("--base") ?? process.env.MINECRAFT_BRIDGE_BASE_URL ?? "http://localhost:3004").trim();
  const token = (readArgValue("--token") ?? process.env.MINECRAFT_BRIDGE_TOKEN ?? "").trim();
  const samplePath = (readArgValue("--file") ?? "src/scripts/minecraft-observation.sample.json").trim();

  if (!token) {
    throw new Error("MINECRAFT_BRIDGE_TOKEN is required. Set env var or pass --token.");
  }

  const rawPayload = await readFile(samplePath, "utf-8");
  const payload = JSON.parse(rawPayload) as unknown;

  const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/minecraft/shadow`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const rawResponse = await response.text();
  let parsed: unknown = rawResponse;

  try {
    parsed = JSON.parse(rawResponse) as unknown;
  } catch {
    // Keep raw text when response is not JSON.
  }

  console.log(`Status: ${response.status}`);
  console.log(JSON.stringify(parsed, null, 2));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Minecraft shadow test failed: ${message}`);
  process.exit(1);
});
