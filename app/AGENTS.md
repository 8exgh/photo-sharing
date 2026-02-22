# Repository Guidelines

## Project Structure & Module Organization
- `src/app/`: Next.js App Router pages and layout (`page.tsx`, `layout.tsx`, routes like `/albums`, `/admin`, `/access-denied`), global styles in `globals.css`.
- `src/lib/`: Server-side helpers (`albums.ts`, `groups.ts`, `session.ts`, `access-keys.ts`).
- `src/types/`: Shared TypeScript types (e.g., `index.ts`).
- `public/`: Static assets (album images live under `public/albums/`, git-ignored).
- `.access-keys.json`: Local dev store for access keys; do not commit secrets.

## Build, Test, and Development Commands
- `npm run dev`: Start dev server with Turbopack at `http://localhost:3000`.
- `npm run build`: Production build (`.next/`).
- `npm start`: Run built app in production mode on port 3000.
- `npm run lint`: Lint with Next/ESLint rules.
- Docker: `./build.sh` then `./run.sh` (container maps host `3999 -> 3000`; open `http://localhost:3999`).

## Coding Style & Naming Conventions
- Language: TypeScript (`.ts`/`.tsx`). Indentation: 2 spaces.
- Linting: `eslint.config.mjs` extends `next/core-web-vitals` and `next/typescript`.
- Unused vars: underscore-prefixed are allowed (warn level).
- Naming: components `PascalCase`, functions/variables `camelCase`, route folders and files `kebab-case`.
- Keep server-only logic in `src/lib/**`; keep React components and route handlers under `src/app/**`.

## Testing Guidelines
- No formal test framework configured. Prefer small, testable helpers in `src/lib/**`.
- Manual check: `node test-session-invalidation.js` (adjust `baseUrl` if needed) to verify session invalidation on access-key removal.
- If adding tests, place them under `src/__tests__/` and use Jest/Vitest consistently across new code.

## Commit & Pull Request Guidelines
- Commits: follow Conventional Commits (e.g., `feat: add album grid`, `fix: handle missing access key`).
- PRs: include a concise description, linked issue, steps to verify (commands + routes), and screenshots for UI changes.
- Keep PRs focused and small; update docs when behavior or env vars change.

## Security & Configuration Tips
- Set `SESSION_SECRET` in production; cookies are secure in prod (see `src/middleware.ts`).
- Do not commit real keys or `.env*` files. Treat `.access-keys.json` as local state.
- Validate access keys server-side (`src/lib/access-keys.ts`); avoid exposing secrets in client code.
