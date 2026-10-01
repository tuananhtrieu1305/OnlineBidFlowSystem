# Realtime Merge Notes

These notes are for merging Trieu Tuan Anh's realtime branch into the shared branch.

## 1. Personal Docs Are Ignored

`docs/realtime/` is intentionally added to `.gitignore`.

Reason:

- those files are personal implementation notes.
- they are useful for local understanding.
- they should not be pushed to GitHub.

Team-facing docs are:

- `docs/TRIEU_TUAN_ANH_REALTIME_SUMMARY.md`
- `docs/REALTIME_API_REFERENCE.md`
- `docs/REALTIME_MERGE_NOTES.md`

If `docs/realtime/` was already tracked in another branch, `.gitignore` alone will not untrack it. Run:

```bash
git rm -r --cached docs/realtime
```

only if those files are already tracked.

## 2. Docker Orphan Frontend Container

Old local Docker state may contain an orphan container named:

```text
auction_frontend
```

This can serve stale frontend UI on `localhost:5173`.

Clean it with:

```bash
docker compose down --remove-orphans
```

Then start backend/MySQL:

```bash
docker compose up
```

The realtime module no longer ships frontend diagnostic UI. If frontend members need to run the base desktop client, use:

```bash
cd frontend
npm run dev:web
```

Open:

```text
http://localhost:5173/#/api-test
```

The frontend uses hash routing, so use `/#/...` routes. Realtime consumers should build their UI against the backend APIs in `docs/REALTIME_API_REFERENCE.md`.

## 3. Backend Must Be Rebuilt After Merge

The realtime backend adds many Java classes and tests. Rebuild the backend image after merging:

```bash
docker compose build backend
docker compose up -d --force-recreate backend
```

Smoke check:

```text
GET http://localhost:8080/api/health
```

Expected:

```json
{"status":"UP","service":"auction-backend"}
```

## 4. MySQL Seed Data And Volumes

`database/init.sql` only runs when the MySQL Docker volume is created the first time.

If seed data looks outdated after merge, recreate the DB volume carefully:

```bash
docker compose down -v
docker compose up
```

Warning:

- `docker compose down -v` deletes local MySQL data.
- use it only when you are okay resetting local dev data.

Useful seeded realtime examples:

| Auction ID | Type | Access | Status | Room code | Use |
| --- | --- | --- | --- | --- | --- |
| `3` | `BLIND` | `PRIVATE` | `RUNNING` | `CAMERA26` | realtime join/chat |
| `5` | `NORMAL` | `PRIVATE` | `RUNNING` | `KEYROOM` | realtime join/chat |
| `1` | `NORMAL` | `PUBLIC` | `SOLD` | none | replay |
| `2` | `BLIND` | `PUBLIC` | `SOLD` | none | replay |

## 5. Mock Auth Is Temporary

Current mock auth:

WebSocket:

```text
/ws/auction?userId=2&role=USER
```

Replay REST:

```text
X-Dev-User-Id: 2
X-Dev-Role: USER
```

Account - Wallet - Admin should replace this later with real auth. Downstream code should keep using `RealtimePrincipal` instead of reading mock fields directly.

## 6. Module Boundaries

Realtime does not own:

- bid validation.
- winner determination.
- wallet balance changes.
- Coin lock/unlock/payment.

NORMAL/BLIND modules should do business validation and then call `RealtimeEventPublisher` to notify clients.

## 7. Privacy Rules To Preserve

BLIND running auction must not expose:

- starting price.
- current price.
- other users' bids.
- highest bid.
- leader.
- product estimated price.

BLIND user replay must not expose other users' hidden bids.

Tests already cover these rules. If the shared branch changes DTOs, keep the same negative assertions.

## 8. Verification Commands

Before merging, run:

```bash
docker run --rm -v "C:\Workspace\OnlineBidFlowSystem\backend:/workspace" -w /workspace maven:3.9.9-eclipse-temurin-21 mvn test -q
```

```bash
docker compose build backend
```

```bash
cd frontend
npm run test
npm run typecheck
npm run build
```

If local `npm` is unavailable on Windows PowerShell, run frontend verification in Node Docker as documented in `docs/TRIEU_TUAN_ANH_REALTIME_SUMMARY.md`.

## 9. Watch For Merge Conflicts

Likely conflict areas:

- `backend/src/main/java/com/group6/auction/config/WebSocketConfig.java`
- `backend/src/main/java/com/group6/auction/account/*`
- `backend/src/main/java/com/group6/auction/auction/*`
- `backend/src/main/java/com/group6/auction/product/*`
- `database/init.sql`
- `frontend/src/router/index.tsx`
- `frontend/src/api/server-config.ts`

If Account/Wallet/Admin branch has real entities or auth, prefer their ownership and adapt realtime repositories/services to those shared types.
