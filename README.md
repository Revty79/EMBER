# EMBER

Enhanced Memory Backbone for Everyday Reasoning.

EMBER is a local family assistant web app (Next.js App Router + TypeScript) that stores private chat history in PostgreSQL and sends model requests to Ollama through server-side API routes.

The app runs on port `3004`.

## Core Features

- Username/password login (no public signup)
- Secure password hashing (`bcryptjs`)
- HTTP-only session cookies
- Per-user private conversations and messages
- Admin-only account creation in-app
- Admin-editable EMBER identity profile
- Admin Minecraft Brain Control Panel (`/admin/minecraft`)
- Stored chat history in PostgreSQL via Drizzle
- Ollama proxy route (`/api/chat`) for browser chat

## Minecraft Bridge Integration (Brain Side)

EMBER includes a Minecraft bridge contract for a separate Minecraft bot body service.

- EMBER repo = AI brain / observation / desired settings / decision logging / admin control panel
- `ember-minecraft-bot` repo = Minecraft body / Mineflayer runtime / action executor / final safety gate
- EMBER never connects directly to Minecraft
- EMBER never executes Minecraft actions
- Body remains the final safety gate

### Safety Model

- `shadow` mode is observation-only and always returns `executed=false` and `actions=[]`
- `supervised` mode can return requested actions, but execution is always false in EMBER
- Desired settings in EMBER are intent, not guaranteed body runtime state
- Dangerous toggles are locked/off by default unless explicit server-side override is enabled
- Supervised mode is disabled by default
- Bridge token is server-side only and must never be exposed to browser clients

## Environment Variables

Use `.env.example` as your template.

```dotenv
DATABASE_URL=
APP_SECRET=
OLLAMA_BASE_URL=
OLLAMA_MODEL=qwen2.5:1.5b

MINECRAFT_BRIDGE_TOKEN=

MINECRAFT_SHADOW_ENABLED=false
MINECRAFT_SHADOW_MODEL=
MINECRAFT_SHADOW_RESPONSE_MODE=deep
MINECRAFT_SHADOW_STORE_OBSERVATIONS=true
MINECRAFT_SHADOW_MAX_RECENT=25

MINECRAFT_SUPERVISED_ENABLED=false
MINECRAFT_SUPERVISED_MODEL=
MINECRAFT_SUPERVISED_RESPONSE_MODE=deep
MINECRAFT_SUPERVISED_ALLOWED_ACTIONS=status,look,eat_if_hungry,go_home,flee,wander_yard,stop
MINECRAFT_SUPERVISED_MAX_ACTIONS=1
MINECRAFT_SUPERVISED_REQUIRE_CONFIDENCE=medium

MINECRAFT_BRIDGE_DEBUG=false
MINECRAFT_ADMIN_ALLOW_DANGEROUS_SETTINGS=false
```

Notes:

- If `MINECRAFT_SHADOW_MODEL` or `MINECRAFT_SUPERVISED_MODEL` is blank, EMBER falls back to `OLLAMA_MODEL`.
- `MINECRAFT_BRIDGE_TOKEN` is required for bot-facing bridge auth.
- `MINECRAFT_ADMIN_ALLOW_DANGEROUS_SETTINGS` defaults to `false` and keeps dangerous settings locked.

## Bridge Endpoints

Auth header format:

- `Authorization: Bearer <token>`

Routes:

- `GET /api/minecraft/health`
- `POST /api/minecraft/shadow`
- `POST /api/minecraft/supervised`
- `GET /api/minecraft/settings`
- `GET /api/minecraft/contract`
- `GET /api/minecraft/recent?limit=25`
- `POST /api/minecraft/result` (optional body feedback endpoint)

### `GET /api/minecraft/health`

Requires bearer token or admin session.

Response:

```json
{
  "ok": true,
  "service": "EMBER Minecraft Bridge",
  "shadowEnabled": false,
  "supervisedEnabled": false,
  "actionsEnabled": false,
  "timestamp": "2026-05-04T18:00:00.000Z"
}
```

### `POST /api/minecraft/shadow`

Requires bearer token.

- Disabled response: `403` with `{ "error": "Minecraft shadow mode is disabled." }`
- Enabled response always returns `executed=false` and `actions=[]`

Example response:

```json
{
  "mode": "shadow",
  "executed": false,
  "reply": "I am safe near home. I would stay idle and wait for Brannan's next command.",
  "wouldDo": "I am safe near home. I would stay idle and wait for Brannan's next command.",
  "confidence": "medium",
  "allowedActionTypes": [],
  "actions": [],
  "logId": "optional"
}
```

### `POST /api/minecraft/supervised`

Requires bearer token.

Disabled-by-default response:

```json
{
  "mode": "supervised",
  "enabled": false,
  "executed": false,
  "reply": "Minecraft supervised mode is disabled.",
  "actions": []
}
```

Enabled response shape:

```json
{
  "mode": "supervised",
  "enabled": true,
  "executed": false,
  "reply": "I want to move back to safety.",
  "wouldDo": "I would go home because danger is present.",
  "confidence": "medium",
  "actions": [
    {
      "type": "GO_HOME",
      "reason": "Danger signal detected."
    }
  ],
  "logId": "optional"
}
```

### `GET /api/minecraft/settings`

Requires bearer token.

Returns desired settings for the Minecraft body to poll later. This endpoint does not execute actions.

```json
{
  "source": "ember",
  "mode": "settings",
  "settingsVersion": 1,
  "updatedAt": "2026-05-04T20:00:00.000Z",
  "settings": {
    "shadowEnabled": false,
    "shadowStoreObservations": true,
    "shadowChatSummary": false,
    "shadowObservationIntervalMs": 180000,
    "shadowTimeoutMs": 180000,
    "bridgeDebug": false,
    "taskSystemEnabled": true,
    "allowEating": true,
    "allowEquip": true,
    "allowFlee": true,
    "allowMining": true,
    "allowHarvest": true,
    "allowWander": true,
    "allowCropHarvest": false,
    "allowCombat": false,
    "allowBuilding": false,
    "allowCrafting": false,
    "allowContainers": false,
    "supervisedEnabled": false,
    "aiBridgeEnabled": false
  }
}
```

### `GET /api/minecraft/contract`

Requires bearer token or admin session.

Returns versioned endpoint/auth contract and response examples so the bot repo can integrate without EMBER internals.

### `GET /api/minecraft/recent`

Requires bearer token or admin session.

Returns recent bridge logs with optional `?limit=` query parameter.

### `POST /api/minecraft/result`

Requires bearer token.

Allows the body service to report accepted/rejected/executed outcomes back to the bridge log.

## Admin Minecraft Settings APIs

Both routes require logged-in admin session.

- `GET /api/admin/minecraft/settings`
- `PATCH /api/admin/minecraft/settings`

Rules:

- Returns and updates DB-backed desired settings.
- Server-side validation only accepts known fields.
- Dangerous fields are rejected unless `MINECRAFT_ADMIN_ALLOW_DANGEROUS_SETTINGS=true`.
- No service token is returned by these endpoints.

## Minecraft Control Panel (`/admin/minecraft`)

The EMBER mission-control page includes:

- Bridge status cards (runtime flags + latest log metadata)
- Desired settings panel (safe toggles/intervals/notes)
- Locked safety panel for dangerous toggles
- Runtime-vs-desired notice (`Runtime apply: pending bot support`)
- Recent shadow logs with clear `executed=false` and `actions=[]` visibility

UI warning:

> These are desired settings stored in EMBER. The Minecraft body remains the final safety gate. Changing settings here does not directly execute actions.

## Example cURL

Health:

```bash
curl -X GET http://localhost:3004/api/minecraft/health \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Shadow:

```bash
curl -X POST http://localhost:3004/api/minecraft/shadow \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"timestamp":"test","bot":{"username":"EmberR2025"},"survival":{"vitals":{"health":20,"food":20,"danger":"none"},"yard":{"enabled":true,"insideRadius":true}}}'
```

Supervised (disabled default):

```bash
curl -X POST http://localhost:3004/api/minecraft/supervised \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"timestamp":"test","bot":{"username":"EmberR2025"}}'
```

Settings:

```bash
curl -X GET http://localhost:3004/api/minecraft/settings \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Local Development

1. Copy env template:

```powershell
Copy-Item .env.example .env.local
```

2. Update `.env.local`.
3. Install dependencies:

```bash
npm install
```

4. Generate and apply database migrations:

```bash
npm run db:generate -- --name init
npm run db:migrate
```

5. Seed first admin user:

```bash
npm run seed:admin -- --username "familyadmin" --name "Family Admin" --email "admin@example.com" --password "change-me-now"
```

6. Run app:

```bash
npm run dev
```

7. Open `http://localhost:3004`.

## Bridge Testing Script

Sample files:

- `src/scripts/minecraft-observation.sample.json`
- `src/scripts/minecraft-shadow-test.ts`

Run:

```bash
npm run minecraft:shadow:test
```

## Docker Compose Environment

`docker-compose.yml` includes placeholders for required bridge environment variables on the `ember` service with safe defaults (`shadow=false`, `supervised=false`).

## Drizzle Schema

- `src/db/schema.ts`
- `drizzle/` migrations

Bridge tables:

- `minecraft_bridge_logs`
- `minecraft_bridge_settings`

## Build v12.1 Notes

### Files Changed

- Admin UI: `src/app/admin/minecraft/page.tsx`, `src/components/minecraft-control-panel.tsx`, `src/components/minecraft-control-panel.module.css`
- APIs: `src/app/api/admin/minecraft/settings/route.ts`, `src/app/api/minecraft/settings/route.ts`, `src/app/api/minecraft/health/route.ts`, `src/app/api/minecraft/contract/route.ts`
- Settings logic/schema: `src/lib/minecraft/settings.ts`, `src/db/schema.ts`
- Shadow tightening: `src/lib/minecraft/prompt.ts`, `src/app/api/minecraft/shadow/route.ts`
- Migration: `drizzle/0004_stale_unicorn.sql` and `drizzle/meta/*`

### Migration

- `0004_stale_unicorn.sql` adds `minecraft_bridge_settings`

### Test Checklist

1. App builds (`npm run build`) - pass.
2. Existing login/chat still works - `/api/chat` behavior unchanged in code.
3. `/admin/minecraft` loads for admin - admin gate preserved and page expanded.
4. Settings can be read - `GET /api/admin/minecraft/settings` implemented.
5. Safe settings can be updated - `PATCH /api/admin/minecraft/settings` implemented.
6. Dangerous settings remain locked/off - UI disabled and API rejects by default.
7. Browser never receives `MINECRAFT_BRIDGE_TOKEN` - no new response includes token.
8. `GET /api/minecraft/settings` rejects missing/invalid bearer token - uses bridge token validator.
9. `GET /api/minecraft/settings` accepts valid bearer token - endpoint implemented.
10. Shadow endpoint still returns `executed=false` and `actions=[]` - contract preserved.
11. Supervised mode remains disabled by default - unchanged defaults.
12. No Minecraft actions are executed from EMBER - execution remains false in EMBER.

### Known Limitations

- Runtime apply is pending bot polling support; desired settings are not guaranteed to be applied by body runtime yet.
- Bridge status cards reflect EMBER runtime/log visibility, not a guaranteed live Mineflayer heartbeat.
- Dangerous settings require explicit server-side override and remain locked in normal operation.

## Important Guarantees

- Existing `/api/chat` browser login behavior remains unchanged.
- EMBER does not execute Minecraft actions.
- Minecraft body remains the safety gate for all real-world execution.
