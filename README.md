# Real-Time Online Auction System

Initial project for the group assignment "He thong dau gia online thoi gian thuc".

This repository is only the shared starting point. It includes a runnable React frontend, Spring Boot backend, MySQL schema, seed data, Docker setup, and shared system documentation. It intentionally does not implement authentication, bidding logic, wallet services, realtime sockets, chat runtime, replay, or leaderboard logic.

## Tech stack

- Frontend: React 18.3.1, Vite 6.4.3, Tailwind CSS 3.4.15, axios 1.20.0, react-router-dom 7.18.3
- Backend: Java 21, Spring Boot 3.3.5, Maven 3.9.9, Spring Web, Spring Data JPA, Validation, MySQL Connector/J
- Database: MySQL 8.4.4
- Runtime: Docker Compose

## Folder structure

```text
.
|-- frontend/
|-- backend/
|-- database/
|-- docker-compose.yml
|-- README.md
|-- SYSTEM_SPEC.md
|-- .env.example
`-- .gitignore
```

## Prerequisites

- Git
- Docker Desktop with Docker Compose
- Optional for local-only runs: Node.js 22 LTS, Java 21, Maven 3.9.x, MySQL 8.4

## Clone and configure

```bash
git clone <repository-url>
cd OnlineBidFlowSystem
cp .env.example .env
```

Do not commit the real `.env` file.

If your computer already has a local MySQL server on port `3306`, set `MYSQL_HOST_PORT=3307` in `.env`. Inside Docker, the backend still connects to the MySQL service on port `3306`.

## Run the full system with Docker

```bash
docker compose up --build
```

URLs:

- Frontend: http://localhost:5173
- Routing test: http://localhost:5173/routing-test
- API test page: http://localhost:5173/api-test
- Backend health API: http://localhost:8080/api/health
- MySQL: localhost:3306

Expected health response:

```json
{
  "status": "UP",
  "service": "auction-backend"
}
```

## Stop Docker

```bash
docker compose down
```

## Reset development database

MySQL stores data in the `mysql_data` Docker volume. The file `database/init.sql` is mounted into `/docker-entrypoint-initdb.d/01-init.sql`, and MySQL only runs it automatically the first time the database volume is created.

If you edit `database/init.sql` while reusing an old volume, MySQL will not automatically rerun the script. To recreate the development database:

```bash
docker compose down -v
docker compose up --build
```

Warning: `docker compose down -v` deletes the development database stored in the Docker volume.

## Run frontend separately

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server listens on `0.0.0.0:5173`.

## Run backend separately

Start MySQL first, then run:

```bash
cd backend
mvn spring-boot:run
```

The backend reads database settings from:

- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USERNAME`
- `DB_PASSWORD`

For local development outside Docker, set `DB_HOST=localhost`.

## Import database manually with MySQL Workbench

1. Open MySQL Workbench.
2. Connect to a MySQL 8.4 server.
3. Open `database/init.sql`.
4. Run the full script from top to bottom.

The script creates `auction_db`, selects it with `USE auction_db`, creates the 8 required tables, indexes, and development seed data.

## Development seed accounts

These are development seed accounts only. The database stores BCrypt hashes, not plaintext passwords.

- `admin` / `Password@123`
- `alice` / `Password@123`
- `bob` / `Password@123`
- `charlie` / `Password@123`
- `diana` / `Password@123`
- `eric` / `Password@123`
- `fiona` / `Password@123`
- `george` / `Password@123`
- `hana` / `Password@123`
- `ivan` / `Password@123`

## Database notes

The official schema is `database/init.sql`.

The database has exactly 8 business tables:

1. `users`
2. `wallets`
3. `products`
4. `auctions`
5. `auction_participants`
6. `bids`
7. `chat_messages`
8. `coin_transactions`

There are intentionally no `leaderboard`, `price_statistics`, `replays`, or `socket_connections` tables. Those features will be calculated or reconstructed from the core tables when their modules are implemented.

## Initial-project boundaries

Intentionally not implemented:

- JWT authentication
- Register/login flows
- Auction bidding services
- NORMAL auction business logic
- BLIND auction business logic
- Wallet lock/unlock/payment service
- WebSocket/realtime infrastructure
- Chat runtime
- Replay
- Leaderboard
- Full CRUD APIs

See `SYSTEM_SPEC.md` before adding business logic.
