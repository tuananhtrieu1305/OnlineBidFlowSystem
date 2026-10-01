# Realtime integration on pbtien

Integrated origin/tuananh d7657b4 with pbtien f516b43. The existing account implementation owns User, UserRepository and session security. The guest/login/register interface remains in place; obsolete diagnostic pages remain deleted.

## Authentication contract

- Sign in through /api/auth/login using CSRF and HttpOnly session cookies; see login.md.
- Connect to /ws/auction with the session cookie and an allowed Origin.
- Never send userId/role as credentials. Query identity and X-Dev-* replay headers are ignored.
- RealtimeAuthService maps server Authentication to RealtimePrincipal using the users repository.
- Replay uses the same identity and preserves the existing participant/admin visibility checks.
- Logout and login session rotation close sockets associated with that HTTP session.
- Incoming/outgoing socket messages validate the session; periodic cleanup closes expired idle sockets within 15 seconds. Cookie session expiration is not extended by socket traffic.
- Reconnect establishes a new socket, then JOIN_ROOM returns an authorized snapshot and stored chat. There is no auction-room frontend yet.
- Production mock authentication implementations have been removed. Socket regression tests sign in via the real HTTP login endpoint with test repositories.

## Retained boundaries

The realtime module owns room membership, chat, reconnect snapshots and replay. It does not change Coin, validate bids or determine winners. Auction modules should publish authorized events after their business transaction commits. Running BLIND snapshots must not disclose starting price, estimated product price, other bids or leader.

User.role remains String to preserve the existing account contract. Auction/product entities from the realtime branch currently support reading existing database data; extend those shared entities when implementing Admin CRUD rather than introducing duplicate table mappings.

## Development

From the repository root:

```powershell
docker compose up -d --build backend
cd frontend
npm run dev
```

If an old auction_frontend container holds port 5173, stop that container only:

```powershell
docker stop auction_frontend
```

This integration does not change database/init.sql or require a schema/data reset. Do not remove the MySQL volume to apply the merge.

## Verification

- Backend unit/socket regression: mvn -f backend/pom.xml test.
- MySQL integration: mvn -f backend/pom.xml -Pregistration-it verify, using the isolated database configuration in registration.md.
- Frontend: npm run build, npm run test:coverage, npm run test:e2e.
- Electron live authentication/socket test: playwright.login-live.config.ts against test port 18080; see login.md.

Tests cover forged realtime/replay identity, logout revocation, expiration, room/chat/reconnect persistence, and BLIND visibility. Frontend regression retains the account UI tests.

## Next work for Phạm Bá Tiến

Implement wallet operations with transactions and concurrency control (top-up, lock, release, settle), then product/Admin auction configuration using the shared entities. Coordinate wallet service signatures with NORMAL/BLIND modules. Room membership alone does not grant bid eligibility; bidding modules must enforce their own business rules.
