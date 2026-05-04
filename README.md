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
- Stored chat history in PostgreSQL via Drizzle
- Ollama proxy route (`/api/chat`) for browser chat

## Minecraft Bridge Integration (Brain Side)

EMBER now includes a stable Minecraft bridge contract for future integration with a separate Minecraft bot body service.

- EMBER repo = AI brain / observation / decision service
- Minecraft bot repo = body / safety layer / action executor
- EMBER never connects directly to Minecraft
- EMBER never executes Minecraft actions
- Body remains the final safety gate

### Safety Model

- `shadow` mode is observation-only and always returns `executed=false` and `actions=[]`
- `supervised` mode can return requested actions, but execution is always false in EMBER
- Supervised mode is disabled by default
- Endpoints are protected by bearer token
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
```

Notes:

- If `MINECRAFT_SHADOW_MODEL` or `MINECRAFT_SUPERVISED_MODEL` is blank, EMBER falls back to `OLLAMA_MODEL` behavior.
- `MINECRAFT_BRIDGE_TOKEN` is required for bot POST endpoints.

## Bridge Endpoints

Auth header format:

- `Authorization: Bearer <token>`

Routes:

- `GET /api/minecraft/health`
- `POST /api/minecraft/shadow`
- `POST /api/minecraft/supervised`
- `GET /api/minecraft/contract`
- `GET /api/minecraft/recent?limit=25`
- `POST /api/minecraft/result` (optional body feedback endpoint)

### `GET /api/minecraft/health`

Requires bearer token.

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
  "reply": "I would check my status and stay near home.",
  "wouldDo": "I would check my status and stay near home.",
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

Supported supervised action types in this version:

- `REPORT_STATUS`
- `LOOK_AT_OWNER`
- `REPORT_LOOK`
- `EAT_FOOD`
- `GO_HOME`
- `FLEE_DANGER`
- `WANDER_SAFE`
- `STOP_MOVING`

Not supported in this version:

- `ATTACK_ENTITY`
- `PLACE_BLOCK`
- `CRAFT_ITEM`
- `OPEN_INVENTORY`
- `MINE_BLOCK`
- `HARVEST_BLOCK`

### `GET /api/minecraft/contract`

Requires bearer token or admin session.

Returns versioned endpoint/auth contract and response examples so the bot repo can integrate without EMBER internals.

### `GET /api/minecraft/recent`

Requires bearer token or admin session.

Returns recent bridge logs with optional `?limit=` query parameter (capped by `MINECRAFT_SHADOW_MAX_RECENT`).

### `POST /api/minecraft/result`

Requires bearer token.

Allows the body service to report accepted/rejected/executed outcomes back to the bridge log.

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

`docker-compose.yml` includes placeholders for all required bridge environment variables on the `ember` service with safe defaults (`shadow=false`, `supervised=false`).

## Drizzle Schema

- `src/db/schema.ts`
- `drizzle/` migrations

Bridge log table:

- `minecraft_bridge_logs`

## Important Guarantees

- Existing `/api/chat` browser login behavior remains unchanged.
- EMBER does not execute Minecraft actions.
- Minecraft body remains the safety gate for all real-world execution.
