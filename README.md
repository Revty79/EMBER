# EMBER

Enhanced Memory Backbone for Everyday Reasoning.

EMBER is a local family assistant web app (Next.js) that stores private chat history in PostgreSQL and sends model requests to Ollama through server-side API routes.

PostgreSQL naming in this project is lowercase:

- Database: `ember`
- User: `ember_app`

## v0.2 Features

- Username/password login (no public signup)
- Secure password hashing (`bcryptjs`)
- HTTP-only session cookies
- Per-user private conversations and messages
- Conversation sidebar + new conversation flow
- Admin-only account creation in-app (for family members)
- Stored chat history in PostgreSQL
- Ollama proxy route (`/api/chat`) with server-side system instruction
- Model selector:
  - `qwen2.5:1.5b`
  - `llama3.2:1b`

## Tech Stack

- Next.js (App Router) + TypeScript
- PostgreSQL
- Drizzle ORM + Drizzle migrations

## Required Environment Variables

```dotenv
DATABASE_URL=
APP_SECRET=
OLLAMA_BASE_URL=
OLLAMA_MODEL=qwen2.5:1.5b
```

Example for development from your dev PC to home server services:

```dotenv
DATABASE_URL=postgresql://ember_app:YOUR_PASSWORD@10.0.0.218:5432/ember
APP_SECRET=replace-with-a-long-random-secret
OLLAMA_BASE_URL=http://10.0.0.218:11434
OLLAMA_MODEL=qwen2.5:1.5b
```

If your database password has special URL characters (for example `@`, `:`, `/`, `?`, `#`), URL-encode it inside `DATABASE_URL`.

## Local Development

1. Copy env template:

```powershell
Copy-Item .env.example .env.local
```

2. Update `.env.local` with your `DATABASE_URL`, `APP_SECRET`, and `OLLAMA_BASE_URL`.

3. Install dependencies:

```bash
npm install
```

4. Generate and apply database migrations:

```bash
npm run db:generate -- --name init
npm run db:migrate
```

5. Create the first admin user:

```bash
npm run seed:admin -- --username "familyadmin" --name "Family Admin" --email "admin@example.com" --password "change-me-now"
```

6. Start the app:

```bash
npm run dev
```

7. Open `http://localhost:3004`.
8. If no users exist yet, the login page shows a **First-Time Setup** form to create the first admin account.
9. After signing in as admin, use the sidebar **Create Family Account** form to create other users.

## Drizzle Files

- Schema: `src/db/schema.ts`
- Config: `drizzle.config.ts`
- SQL migrations: `drizzle/`

Useful commands:

- `npm run db:generate -- --name <migration_name>`
- `npm run db:migrate`
- `npm run db:studio`

## Privacy and Access Rules

- Users can only access their own conversations and messages.
- All ownership checks happen server-side in API routes and DB queries.
- Browser never calls Ollama directly.

## Deployment Notes

All DB connection details come from `DATABASE_URL` only.

### App on server (non-Docker)

Use a local PostgreSQL URL, for example:

```dotenv
DATABASE_URL=postgresql://ember_app:YOUR_PASSWORD@localhost:5432/ember
```

### App in Docker on server

Do not assume `localhost` means host machine. Use `DATABASE_URL` with a reachable host:

- `postgresql://ember_app:YOUR_PASSWORD@10.0.0.218:5432/ember`
- `postgresql://ember_app:YOUR_PASSWORD@host.docker.internal:5432/ember`

`docker-compose.yml` includes:

- `extra_hosts: host.docker.internal:host-gateway`
- configurable `DATABASE_URL`, `APP_SECRET`, `OLLAMA_BASE_URL`, and `OLLAMA_MODEL`

For future server-side service-to-service Ollama networking:

```dotenv
OLLAMA_BASE_URL=http://ollama:11434
```

## Docker

Build and run app container directly:

```bash
docker build -t ember .
docker run --rm -p 3004:3004 \
  -e DATABASE_URL=postgresql://ember_app:YOUR_PASSWORD@10.0.0.218:5432/ember \
  -e APP_SECRET=replace-with-a-long-random-secret \
  -e OLLAMA_BASE_URL=http://10.0.0.218:11434 \
  -e OLLAMA_MODEL=qwen2.5:1.5b \
  ember
```

Or use compose:

```bash
docker compose up --build
```

Then visit `http://localhost:3004`.
