# math-admin

Admin console for NUMI (Math-AI): manage users and in-app banners. Talks to the `math-svr` Go backend.

**Stack:** React 19 · Vite · TypeScript · React Router · shadcn/ui + Tailwind CSS v4 · i18next (vi/en)

## Getting started

```bash
npm install          # also installs the Lefthook git hooks
cp .env.example .env.local   # optional: point the dev proxy at another math-svr
npm run dev          # http://localhost:5173/admin/
```

The dev server forwards `/go/*` to math-svr (`VITE_API_PROXY_TARGET`, default `http://localhost:8080`),
so the browser stays same-origin.

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Type-check, then production build into `dist/` |
| `npm run check:types` | Type-check only |
| `npm run lint` | oxlint |
| `npx shadcn@latest add <component>` | Add a shadcn/ui component to `src/components/ui/` |

## Project layout

See the **Folder structure** section of [CLAUDE.md](CLAUDE.md). Backend API rules: [docs/API-CONTRACT.md](docs/API-CONTRACT.md).

## Commits

Conventional Commits (`feat: …`, `fix: …`, `chore: …`). Lefthook runs lint and type-check on commit and
commitlint on the message.
