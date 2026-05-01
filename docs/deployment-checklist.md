# Deployment Checklist

Railway project: two services (frontend + backend) from the same repo.

## Frontend service

| Setting | Value |
|---|---|
| Repo | optidigitalagent/aiteacher |
| Branch | main |
| Root directory | /frontend |
| Builder | Nixpacks (auto-detected Vite/Node) |
| Build command | `npm run build` |
| Start command | `npx serve dist` (or static hosting) |

**Required environment variables:**

| Variable | Example / Notes |
|---|---|
| `VITE_API_URL` | `https://your-backend.up.railway.app` — no trailing slash |

## Backend service

| Setting | Value |
|---|---|
| Repo | optidigitalagent/aiteacher |
| Branch | main |
| Root directory | /backend |
| Builder | Nixpacks (`backend/railway.toml` present) |
| Start command | `npm run migrate && npm start` (from railway.toml) |
| Health check path | `/health` |

**Required environment variables:**

| Variable | Notes |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `GOOGLE_CLIENT_ID` | OAuth app client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth app client secret |
| `GOOGLE_CALLBACK_URL` | `https://your-backend.up.railway.app/auth/google/callback` |
| `JWT_SECRET` | Random string, min 32 chars |
| `FRONTEND_URL` | `https://your-frontend.up.railway.app` |
| `BACKEND_URL` | `https://your-backend.up.railway.app` |

## Sanity checks before deploying

- [ ] `VITE_API_URL` points to backend (not localhost)
- [ ] `GOOGLE_CALLBACK_URL` matches the redirect URI registered in Google Cloud Console
- [ ] `FRONTEND_URL` is in the CORS allowed origins on the backend
- [ ] Migrations run successfully (`npm run migrate` in backend)
- [ ] `/health` endpoint returns 200

## Branch strategy

- `main` — production, auto-deploys on Railway
- `checkpoint-demo-flow` — current working branch, merge to main to deploy
