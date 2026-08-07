# RAGDemo

A side-by-side demo comparing two retrieval-augmented generation approaches — **Vector RAG** (classic embedding + FAISS retrieval) and **PageIndex RAG** (LLM-driven table-of-contents navigation) — over the same document corpus.

## Project layout

```
RAGDemo/
├── modal/     Python backend (Modal-hosted Gemma model + retrieval pipelines)
└── web/       Next.js frontend (App Router) — deployed to Vercel
```

The Vercel project's **Root Directory is set to `web`**, so all deploys (Git-triggered and CLI) build from `web/`, not the repo root.

## Local development

```bash
cd web
npm install
npm run dev
```

Open http://localhost:3000.

## Deployment (Vercel)

Production: https://ragdemo-eta.vercel.app
Vercel project: `ragdemo` (team `srinivaschakrapanis-projects`)

### One-time setup (already done for this repo)

1. Link the repo root to the Vercel project (creates `.vercel/repo.json` at the repo root, **not** inside `web/`):
   ```bash
   npx vercel link
   ```
2. Set the project's Root Directory to `web` so Git-triggered and CLI builds can find the Next.js app:
   ```bash
   npx vercel project update ragdemo --root-directory web
   ```
   > This step is required. Without it, deployments fail with:
   > `Error: Couldn't find any 'pages' or 'app' directory. Please create one under the project root`

### Every deploy

Run from the **repo root** (`RAGDemo/`), not from `web/`:

```bash
git add -A
git commit -m "..."
git push origin main          # triggers a Git-based Vercel deployment automatically

npx vercel --prod --yes       # or deploy directly via CLI for an immediate production deploy
```

Both the GitHub push and the CLI command deploy the same linked `ragdemo` project — you generally only need one of them, but the CLI deploy is useful when you want to skip waiting for the Git integration or to redeploy without a new commit.

### Environment variables

Runtime environment variables (e.g. `MODAL_RAG_VECTOR_URL`, `MODAL_RAG_PAGEINDEX_URL`) are configured in the Vercel dashboard under **Project → Settings → Environment Variables** for the `ragdemo` project, and mirrored locally in `web/.env.local` (gitignored).

### Troubleshooting

- **"Couldn't find any 'pages' or 'app' directory"** — the project's Root Directory setting reverted or was never set; re-run the `vercel project update ragdemo --root-directory web` command above.
- **`Error: The provided path ".../web/web" does not exist`** — you ran `vercel` from inside `web/` instead of the repo root. Since Root Directory is `web`, always deploy from the repo root.
