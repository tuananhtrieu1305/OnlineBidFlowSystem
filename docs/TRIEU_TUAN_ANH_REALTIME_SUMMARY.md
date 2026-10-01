# Realtime Module Summary - Trieu Tuan Anh

This document summarizes the module implemented by Trieu Tuan Anh for teammates.

Module scope:

```text
Realtime - Room - Chat - Reconnect - Replay
```

## 1. What This Module Owns

This module provides the realtime transport and read-side support around auctions:

- business WebSocket endpoint for auction rooms.
- room join/leave for PUBLIC and PRIVATE auctions.
- in-memory connected room membership.
- persistence of auction participation through `auction_participants`.
- visibility-safe auction snapshots for NORMAL and BLIND auctions.
- room chat with simple anti-spam and persistence in `chat_messages`.
- reconnect support by allowing clients to replay `JOIN_ROOM`.
- replay REST API for finished auctions.
- backend publisher service for NORMAL/BLIND modules to push realtime events.

This module is a delivery and synchronization layer. It does not decide bid validity, winners, or wallet balances.

## 2. What This Module Does Not Own

Not owned here:

- login/register.
- real authentication/session tokens.
- wallet balance mutation.
- Coin lock/unlock/payment.
- NORMAL bid validation.
- BLIND one-bid business validation.
- winner determination.
- auction lifecycle scheduler.
- product CRUD.
- admin auction creation UI.

Temporary mock auth is used until Account - Wallet - Admin replaces it.

## 3. Main Backend Features

WebSocket:

- Health socket remains `/ws/health`.
- Business auction socket added at `/ws/auction`.
- Uses raw WebSocket JSON messages.
- Mock auth currently uses query params:

```text
ws://localhost:8080/ws/auction?userId=2&role=USER
```

Room:

- `JOIN_ROOM` validates auction existence, status, access type, room code, and max participants.
- PRIVATE rooms require `roomCode`.
- Users may join multiple rooms at the same time.
- Repeated `JOIN_ROOM` for the same session is idempotent and returns a fresh snapshot.
- `LEAVE_ROOM` removes the session from the room.
- Disconnect removes session membership.

Snapshot:

- NORMAL snapshot includes public price/bid information.
- BLIND snapshot hides starting price, current price, other bids, highest bid, and leader.
- BLIND snapshot includes own bid and product historical SOLD stats.

Chat:

- `SEND_CHAT_MESSAGE` requires the user to be in the room.
- Message is trimmed.
- Empty messages are rejected.
- Messages over 500 characters are rejected.
- Simple cooldown is enforced per user and auction.
- Messages are saved to `chat_messages`.
- Chat is broadcast to sessions in the same room only.

Replay:

- REST endpoint:

```text
GET /api/auctions/{auctionId}/replay
```

- Replay is available only after auction status is `SOLD` or `UNSOLD`.
- USER must be participant.
- ADMIN can view without being participant.
- Replay is computed from existing tables; no `replays` table is created.

Publisher:

- `RealtimeEventPublisher` is the integration point for other backend modules.
- NORMAL module can broadcast price updates.
- BLIND module can send direct bid confirmation to the bidder only.
- Auction finished events can be broadcast to the room.

## 4. Database Notes

Tables used:

- `users`
- `products`
- `auctions`
- `auction_participants`
- `bids`
- `chat_messages`

Tables intentionally not created:

- `socket_connections`
- `chat_rooms`
- `replays`
- `price_statistics`

Product historical stats are calculated from SOLD auctions with the same product.

## 5. Frontend Scope

No realtime business UI is included in this branch.

The deliverable for teammates is the backend WebSocket/REST API and the backend `RealtimeEventPublisher` service. Frontend members should build their own UI using `docs/REALTIME_API_REFERENCE.md`.

## 6. Important Privacy Rules

BLIND running auction must not expose:

- `startingPrice`
- `currentPrice`
- other users' bids
- highest bid
- leader
- product `estimatedPrice`

BLIND USER replay must not expose:

- other users' bid ids
- other users' bid amounts
- other users' user ids
- `startingPrice`
- product `estimatedPrice`

BLIND ADMIN replay can view full bid data for management.

## 7. Verification Status

Backend:

```text
mvn test passed
Tests run: 53
Failures: 0
Errors: 0
```

Docker:

```text
docker compose build backend passed
```

## 8. How Teammates Should Use It

Frontend team:

- connect to `/ws/auction`.
- send `JOIN_ROOM`, `LEAVE_ROOM`, `SEND_CHAT_MESSAGE`.
- render `AUCTION_STATE`, `CHAT_MESSAGE`, `NORMAL_PRICE_UPDATED`, `BLIND_BID_ACCEPTED`, `AUCTION_FINISHED`, and `ERROR`.
- call replay REST API for finished auctions.

NORMAL module:

- validate and save bids in its own business logic.
- update wallet through Account - Wallet - Admin.
- call `RealtimeEventPublisher.broadcastNormalPriceUpdated(...)` after a valid bid.

BLIND module:

- validate one-bid rule and wallet lock in its own business logic.
- call `RealtimeEventPublisher.sendBlindBidAccepted(...)` only for the bidder.
- never broadcast hidden bid data while auction is running.

Account - Wallet - Admin:

- replace mock auth later.
- keep downstream realtime code using `RealtimePrincipal`.
- provide wallet eligibility/checks behind a small service boundary when ready.
