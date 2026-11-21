# Livestream Electron: local first, Radmin deployment

## Behavior

The gallery interface presents the current product photo on a lit wooden display. Its front uses the real uploaded/catalog image; the reverse is a neutral branded display back, not an invented view of the product. Viewers and hosts can switch between product and camera views without recreating the video element. Drag the photo horizontally to rotate it; releasing anywhere resumes automatic rotation from the adjusted angle. Keyboard users can use Left/Right arrows to rotate, or hold Space/Enter to pause. Rotation also pauses outside the viewport or while the app is hidden; reduced-motion settings disable automatic rotation while preserving deliberate dragging. The gallery theme is shared by discovery, session management, purchases, wallet and results screens.

The host can choose any queued or unsold item using the room's product selector, before starting or while LIVE. Introducing an item does not force the original list order; skipped introductions stay queued. An active leading bid must settle before switching. Sold items cannot be selected again, and a paused session must resume before switching.

The Admin who creates a session owns its controls. At most ten viewer connections enter a room. Guests can browse the catalog; login is required for the room, chat, ICE credentials and bids. Each lot reserves one unit of a real catalog product. First price is at least the starting price; subsequent integer prices must be greater than the current leader. A valid bid reserves Coin and starts a new five-second deadline. The server alone settles the winner into the SYSTEM wallet. Purchases show automatic payment; no second payment button exists.

Camera and microphone are transmitted through native WebRTC, one host connection per viewer, 720p/15 fps and a 700 kbps video cap per viewer. Direct ICE works locally; authenticated TURN is a fallback when configured. Each client connection has a distinct server-generated signaling identity. SDP/ICE stays inside its room and must match the current host generation.

Host heartbeat runs every second. A closed host socket or a three-second lease expiry pauses the session and saves remaining time. Reconnection and camera readiness do not start bidding automatically: the host clicks **Tiếp tục đấu**. After five minutes the server ends the session, releases holds and marks all remaining lots unsold. Committed purchases remain sold. Restart recovery pauses running sessions. Settlement failures roll back and the 100 ms scheduler retries; overdue bids remain blocked.

## Local development

Manual testing must use the project's existing database, not the disposable livestream integration database. The full local system currently runs `auction_mysql` with its original volume (host port 3307), `auction_backend` on 8080 (18081 is a compatibility alias), the Electron client, the web preview on 5184, and local TURN. The current backend image includes the livestream migration and inventory filter. Start the existing local configuration with `docker compose -f docker-compose.yml -f .runtime/full-local.compose.yml up -d --no-build`. The local override and image are prepared in this workspace. The separate `onlinebidflow-livestream-test` database container is stopped; only start it for automated tests. Never reset the main database to prepare a test fixture.

The frontend has been rebuilt against `http://localhost:8080`. Use `http://localhost:5184/#/` for NORMAL/BLIND discovery and `http://localhost:5184/#/admin/livestream/new` for live creation. Reload existing Electron/browser windows after switching environments. The original Admin account remains intact; the local `khach_test` account was registered and funded through the normal wallet API on the main database. A pre-migration database backup is stored under `.runtime/backups/auction_db-before-livestream-20261120.sql`.

Use Java 21, MySQL 8.4 and Node dependencies from the lockfile. Set DB_HOST, DB_PORT, DB_NAME, DB_USERNAME and DB_PASSWORD for the backend. Run `mvn spring-boot:run` in backend. In frontend, build with `VITE_API_BASE_URL=http://localhost:8080` and run the Electron app. Loopback HTTP is for local development only. Real machines require HTTPS.

Flyway V0 creates a new schema (including the SYSTEM wallet). V1 adds livestream tables and the LIVESTREAM auction type. An existing initialized schema is baselined at version 0 and only V1 runs. Back up an existing database before first upgrade and verify DB_NAME. No production seed accounts or default Admin passwords are installed by migrations. Provision an Admin through the existing account administration process; existing installs retain their accounts.

For MySQL tests, use a dedicated disposable database initialized from database/init.sql, then set `REGISTRATION_TEST_DATABASE=true` and run `mvn -Pregistration-it verify`. Never run database/init.sql on an existing database: that development initializer drops old tables. The livestream tests create and remove their own fixtures. For the real Electron integration suite, set `LIVESTREAM_E2E=true`, build against the chosen local backend, and run `npx playwright test e2e/livestream.spec.ts`. It uses real HTTP, sessions, WebSocket and WebRTC, with canvas/audio tracks replacing physical devices only in the test renderer.

## Radmin on Windows

1. Connect server and clients to the same Radmin VPN network. Record the server's Radmin adapter IPv4 address. Check mutual ping before starting Docker. User requested local testing first; physical two-machine verification is a separate deployment check.
2. Copy deploy/livestream/.env.example to the repository .env. Set RADMIN_SERVER_IP, strong DB_PASSWORD, MYSQL_ROOT_PASSWORD and TURN_SECRET. A secret can be generated with `[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))` in PowerShell 7.
3. Run `docker compose -f docker-compose.radmin.yml up -d --build`. This standalone compose uses separate persistent volumes and does not reset existing data. Change the dedicated Docker subnet if it conflicts with a local route. It exposes only the Radmin-bound HTTPS and TURN ports, not MySQL/backend.
4. Export the **public** root CA: `docker compose -f docker-compose.radmin.yml cp caddy:/data/caddy/pki/authorities/local/root.crt ./onlinebidflow-root.crt`. Never copy root.key. Verify the certificate fingerprint from the server before distributing it. On each Windows client import it into CurrentUser\Root using `Import-Certificate -FilePath ./onlinebidflow-root.crt -CertStoreLocation Cert:\CurrentUser\Root`. Restart Electron afterward. Keep TLS certificate validation enabled.
5. Build each client with `VITE_API_BASE_URL=https://<RADMIN_SERVER_IP>:8443` set in the environment, then `npm run build` in frontend and the repository's Electron packaging command if required. Development .env files are not a runtime server switch in an already-built app.
6. Allow inbound 8443/TCP, 3478/TCP, 3478/UDP and 49160–49259/UDP through Windows Firewall on the server, restricted to the Radmin adapter/subnet. For example, in an elevated PowerShell use `New-NetFirewallRule -DisplayName 'OnlineBidFlow HTTPS' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8443 -LocalAddress <RADMIN_SERVER_IP> -RemoteAddress <RADMIN_SUBNET>` and equivalent rules for TURN TCP/UDP ports. Use the actual VPN subnet and profile. Docker Desktop port forwarding must reach the VPN adapter.
7. Verify `https://<RADMIN_SERVER_IP>:8443/api/health` on both clients with normal certificate validation, then run the checks below. TURN uses expiring one-hour credentials; the client renews peers after 45 minutes. Host uplink must support up to ten simultaneous outgoing video/audio streams.

## Deployment acceptance checklist

- Separate host and viewer accounts, camera and microphone play between at least two Windows machines.
- More than one viewer receives live media and chat. An eleventh viewer connection is rejected. Reloading a viewer releases the old connection and resumes from an authoritative snapshot.
- Simultaneous equal bids accept one winner; new higher bids reset five seconds. Available/locked balances and both PAYMENT ledger entries match one settlement.
- Every committed sale plays exactly three gavel/podium impacts. Reload/reconnect does not replay old sale effects.
- Disconnect host network while a bid is active. Bidding locks, saved time stays fixed, and host reconnect + camera check + explicit resume continues from that remainder.
- Leave host disconnected for five minutes. All unsold inventory closes and holds return; sold purchases remain paid.
- Restart backend mid-auction. It recovers as paused, then resumes or expires consistently across clients.
- Confirm relay fallback using WebRTC internals (selected relay candidate), and confirm video/audio under actual Radmin/firewall conditions.

References: [Flyway baseline](https://documentation.red-gate.com/fd/flyway-baseline-on-migrate-setting-277578974.html), [WebRTC connectivity](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Connectivity), [Caddy internal HTTPS](https://caddyserver.com/docs/automatic-https), [Radmin help](https://www.radmin-vpn.com/help/index.html).

On a new empty installation, first register an account through the app. Then the server operator can run `docker compose -f docker-compose.radmin.yml exec mysql mysql -uroot -p auction_db` and promote that exact account with `UPDATE users SET role='ADMIN' WHERE username='<your-account>';`. Sign out and sign back in afterward. Do not add a default public Admin password.

Local verification in this workspace covered new and existing MySQL migration paths, wallet/auction regression, Electron host plus two viewers, native video decoding/audio RTP, forced TURN relay, ten-connection admission, chat, automatic payment, pause/resume and gavel replay suppression. Synthetic canvas/audio tracks replace physical camera and microphone in automated tests. Two-machine Radmin, physical devices and Windows CA/firewall deployment remain deployment checks.

For the isolated Electron harness, the current fixture container is named onlinebidflow-livestream-test on 127.0.0.1:33309, backend 18081. It must contain an Admin named admin with the development test password Password@123. The test creates uniquely named viewer accounts using that fixture hash and funds them through the wallet deposit API. Set LIVESTREAM_FORCE_RELAY=true to require a nominated relay candidate and run with coturn configured through TURN_HOST and TURN_SECRET.
