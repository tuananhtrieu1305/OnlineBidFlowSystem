# Realtime API Reference

This document lists the APIs and integration points implemented for the realtime module.

Base backend URL in local development:

```text
http://localhost:8080
```

## 1. REST Health API

Endpoint:

```http
GET /api/health
```

Parameters:

| Name | Location | Required | Description |
| --- | --- | --- | --- |
| none | - | - | Health check has no input parameter. |

Success response:

```json
{
  "status": "UP",
  "service": "auction-backend"
}
```

Use this only to check backend connectivity.

## 2. WebSocket Health API

Endpoint:

```text
ws://localhost:8080/ws/health
```

Client sends plain text:

```text
PING
```

Server responds plain text:

```text
PONG
```

This is not the auction room socket.

## 3. Auction WebSocket API

Endpoint:

```text
ws://localhost:8080/ws/auction?userId={userId}&role={role}
```

Mock auth query parameters:

| Name | Location | Required | Example | Description |
| --- | --- | --- | --- | --- |
| `userId` | query | yes | `2` | Mock current user id. Must be positive number. |
| `role` | query | yes | `USER` | Mock role. Allowed values: `USER`, `ADMIN`. |

Example:

```text
ws://localhost:8080/ws/auction?userId=2&role=USER
```

When real auth is implemented, Account - Wallet - Admin should replace this query-based auth.

## 4. WebSocket Message Envelope

Client message shape:

```json
{
  "type": "JOIN_ROOM",
  "requestId": "optional-client-id",
  "payload": {}
}
```

Fields:

| Field | Required | Description |
| --- | --- | --- |
| `type` | yes | Client command type. |
| `requestId` | no | Any client-generated id to match request/response. |
| `payload` | depends | Payload object for that command. |

Server event shape:

```json
{
  "type": "AUCTION_STATE",
  "requestId": "optional-client-id",
  "auctionId": 3,
  "payload": {},
  "sentAt": "2026-10-01T00:19:46.440266980Z"
}
```

Fields:

| Field | Description |
| --- | --- |
| `type` | Server event type. |
| `requestId` | Same request id when event replies to a command, otherwise `null`. |
| `auctionId` | Auction id for room events, otherwise `null`. |
| `payload` | Event body. |
| `sentAt` | Server timestamp. |

## 5. Client Command: PING

Purpose:

Check that business WebSocket is alive and mock auth was accepted.

Request:

```json
{
  "type": "PING",
  "requestId": "ping-1"
}
```

Response:

```json
{
  "type": "PONG",
  "requestId": "ping-1",
  "auctionId": null,
  "payload": {
    "userId": 2,
    "username": "dev-user-2",
    "role": "USER"
  },
  "sentAt": "2026-10-01T00:00:00Z"
}
```

## 6. Client Command: JOIN_ROOM

Purpose:

Join an auction realtime room and receive an `AUCTION_STATE` snapshot.

Request payload:

| Field | Required | Example | Description |
| --- | --- | --- | --- |
| `auctionId` | yes | `3` | Auction to join. |
| `roomCode` | only PRIVATE rooms | `CAMERA26` | Required when `access_type=PRIVATE`. |

Request example for PUBLIC room:

```json
{
  "type": "JOIN_ROOM",
  "requestId": "join-6",
  "payload": {
    "auctionId": 6
  }
}
```

Request example for PRIVATE room:

```json
{
  "type": "JOIN_ROOM",
  "requestId": "join-3",
  "payload": {
    "auctionId": 3,
    "roomCode": "CAMERA26"
  }
}
```

Success events:

```json
{
  "type": "USER_JOINED",
  "requestId": "join-3",
  "auctionId": 3,
  "payload": {
    "auctionId": 3,
    "userId": 2,
    "username": "dev-user-2"
  },
  "sentAt": "2026-10-01T00:00:00Z"
}
```

```json
{
  "type": "AUCTION_STATE",
  "requestId": "join-3",
  "auctionId": 3,
  "payload": {
    "auctionId": 3,
    "auctionType": "BLIND",
    "status": "RUNNING",
    "accessType": "PRIVATE",
    "product": {
      "productId": 1,
      "name": "Vintage Camera",
      "description": "Classic film camera for repeat auction statistics.",
      "imageUrl": "https://example.com/image.jpg"
    },
    "ownBid": {
      "amount": 1600,
      "createdAt": "2026-08-30T09:10:00.100"
    },
    "historicalStats": {
      "soldCount": 2,
      "averageWinningPrice": 1650,
      "minimumWinningPrice": 1500,
      "maximumWinningPrice": 1800
    },
    "remainingSeconds": 12345,
    "chatHistory": []
  },
  "sentAt": "2026-10-01T00:00:00Z"
}
```

NORMAL snapshot includes `startingPrice`, `currentPrice`, `nextMinimumBid`, `currentLeader`, and `bidHistory`.

BLIND snapshot intentionally excludes `startingPrice`, `currentPrice`, `bidHistory`, `highestBid`, and `leader`.

Error cases:

| Code | Meaning |
| --- | --- |
| `INVALID_MESSAGE` | Invalid/missing `auctionId` or invalid JSON shape. |
| `AUCTION_NOT_FOUND` | Auction id does not exist. |
| `AUCTION_NOT_JOINABLE` | Auction is not `UPCOMING` or `RUNNING`. |
| `ROOM_CODE_REQUIRED` | PRIVATE room but no room code provided. |
| `ROOM_CODE_INVALID` | PRIVATE room code does not match. |
| `ROOM_FULL` | Max participants reached. |

## 7. Client Command: LEAVE_ROOM

Purpose:

Leave a joined auction room.

Request payload:

| Field | Required | Example | Description |
| --- | --- | --- | --- |
| `auctionId` | yes | `3` | Auction room to leave. |

Request:

```json
{
  "type": "LEAVE_ROOM",
  "requestId": "leave-3",
  "payload": {
    "auctionId": 3
  }
}
```

Success event:

```json
{
  "type": "USER_LEFT",
  "requestId": "leave-3",
  "auctionId": 3,
  "payload": {
    "auctionId": 3,
    "userId": 2,
    "username": "dev-user-2"
  },
  "sentAt": "2026-10-01T00:00:00Z"
}
```

Error cases:

| Code | Meaning |
| --- | --- |
| `INVALID_MESSAGE` | Missing or invalid `auctionId`. |
| `NOT_IN_ROOM` | Current session is not in that room. |

## 8. Client Command: SEND_CHAT_MESSAGE

Purpose:

Send a chat message to an auction room.

Request payload:

| Field | Required | Example | Description |
| --- | --- | --- | --- |
| `auctionId` | yes | `3` | Auction room id. |
| `content` | yes | `Hello room` | Message text. Trimmed by server. Max 500 characters. |

Request:

```json
{
  "type": "SEND_CHAT_MESSAGE",
  "requestId": "chat-1",
  "payload": {
    "auctionId": 3,
    "content": "Hello room"
  }
}
```

Success event broadcast to the room:

```json
{
  "type": "CHAT_MESSAGE",
  "requestId": "chat-1",
  "auctionId": 3,
  "payload": {
    "messageId": 101,
    "auctionId": 3,
    "userId": 2,
    "username": "dev-user-2",
    "content": "Hello room",
    "sentAt": "2026-10-01T00:00:00Z"
  },
  "sentAt": "2026-10-01T00:00:00Z"
}
```

Error cases:

| Code | Meaning |
| --- | --- |
| `INVALID_MESSAGE` | Missing `auctionId` or invalid payload. |
| `NOT_IN_ROOM` | User has not joined the auction room. |
| `CHAT_EMPTY` | Message is empty after trimming. |
| `CHAT_TOO_LONG` | Message is longer than 500 characters. |
| `CHAT_RATE_LIMITED` | User sent messages too quickly in this auction. |

## 9. Server Event: NORMAL_PRICE_UPDATED

Produced by backend publisher, usually after NORMAL module accepts a bid.

Payload:

| Field | Type | Description |
| --- | --- | --- |
| `auctionId` | number | Auction id. |
| `currentPrice` | number | New public current price. |
| `nextMinimumBid` | number | Minimum next bid. |
| `leadingUserId` | number/null | Current leader user id if available. |

Example:

```json
{
  "type": "NORMAL_PRICE_UPDATED",
  "requestId": null,
  "auctionId": 1,
  "payload": {
    "auctionId": 1,
    "currentPrice": 1500,
    "nextMinimumBid": 1600,
    "leadingUserId": 2
  },
  "sentAt": "2026-10-01T00:00:00Z"
}
```

Do not use this event for BLIND running auctions.

## 10. Server Event: BLIND_BID_ACCEPTED

Produced by backend publisher as a direct event to the bidder only.

Payload:

| Field | Type | Description |
| --- | --- | --- |
| `auctionId` | number | Auction id. |
| `amount` | number | Accepted amount of the viewer's own blind bid. |
| `bidRef` | string | Reference for the accepted bid. |

Example:

```json
{
  "type": "BLIND_BID_ACCEPTED",
  "requestId": null,
  "auctionId": 3,
  "payload": {
    "auctionId": 3,
    "amount": 1700,
    "bidRef": "bid-123"
  },
  "sentAt": "2026-10-01T00:00:00Z"
}
```

This event must not be broadcast to the whole room.

## 11. Server Event: AUCTION_FINISHED

Produced by backend publisher when an auction finishes.

Payload:

| Field | Type | Description |
| --- | --- | --- |
| `auctionId` | number | Auction id. |
| `status` | string | `SOLD` or `UNSOLD`. |
| `winnerUserId` | number/null | Winner user id if SOLD. |
| `winningPrice` | number/null | Winning price if SOLD. |

Example:

```json
{
  "type": "AUCTION_FINISHED",
  "requestId": null,
  "auctionId": 3,
  "payload": {
    "auctionId": 3,
    "status": "SOLD",
    "winnerUserId": 2,
    "winningPrice": 1700
  },
  "sentAt": "2026-10-01T00:00:00Z"
}
```

## 12. Error Event

All command failures use this shape:

```json
{
  "type": "ERROR",
  "requestId": "join-3",
  "auctionId": null,
  "payload": {
    "code": "ROOM_CODE_INVALID",
    "message": "Room code is invalid.",
    "details": {}
  },
  "sentAt": "2026-10-01T00:00:00Z"
}
```

Common error codes:

| Code | Meaning |
| --- | --- |
| `INVALID_MESSAGE` | JSON or payload is invalid. |
| `UNKNOWN_MESSAGE_TYPE` | Command type is not supported. |
| `AUCTION_NOT_FOUND` | Auction was not found. |
| `AUCTION_NOT_JOINABLE` | Auction is not open for joining. |
| `ROOM_CODE_REQUIRED` | PRIVATE room requires room code. |
| `ROOM_CODE_INVALID` | Room code mismatch. |
| `ROOM_FULL` | Max participants reached. |
| `NOT_IN_ROOM` | Session is not in the auction room. |
| `CHAT_EMPTY` | Chat content is empty. |
| `CHAT_TOO_LONG` | Chat content exceeds limit. |
| `CHAT_RATE_LIMITED` | Simple anti-spam cooldown triggered. |

## 13. Replay REST API

Endpoint:

```http
GET /api/auctions/{auctionId}/replay
```

Path parameters:

| Name | Required | Example | Description |
| --- | --- | --- | --- |
| `auctionId` | yes | `1` | Finished auction id. |

Mock auth headers:

| Name | Required | Example | Description |
| --- | --- | --- | --- |
| `X-Dev-User-Id` | yes | `2` | Viewer user id. |
| `X-Dev-Role` | yes | `USER` | Viewer role: `USER` or `ADMIN`. |

Example request:

```http
GET /api/auctions/1/replay
X-Dev-User-Id: 2
X-Dev-Role: USER
```

Success response shape:

```json
{
  "auctionId": 1,
  "auctionType": "NORMAL",
  "status": "SOLD",
  "viewerRole": "USER",
  "product": {
    "productId": 1,
    "name": "Vintage Camera",
    "description": "Classic film camera",
    "imageUrl": "https://example.com/image.jpg"
  },
  "result": {
    "status": "SOLD",
    "winnerUserId": 2,
    "winningPrice": 1500,
    "finishedAt": "2026-06-01T10:00:00Z"
  },
  "historicalStats": null,
  "events": [
    {
      "type": "AUCTION_STARTED",
      "at": "2026-06-01T09:00:00Z",
      "payload": {
        "auctionId": 1,
        "auctionType": "NORMAL",
        "status": "SOLD",
        "product": {},
        "startingPrice": 1000
      }
    },
    {
      "type": "BID_PLACED",
      "at": "2026-06-01T09:10:00Z",
      "payload": {
        "bidId": 1,
        "auctionId": 1,
        "userId": 2,
        "amount": 1500,
        "createdAt": "2026-06-01T09:10:00Z",
        "ownBid": true
      }
    },
    {
      "type": "CHAT_MESSAGE",
      "at": "2026-06-01T09:15:00Z",
      "payload": {
        "messageId": 1,
        "auctionId": 1,
        "userId": 2,
        "username": "alice",
        "content": "Nice item",
        "sentAt": "2026-06-01T09:15:00Z"
      }
    },
    {
      "type": "AUCTION_FINISHED",
      "at": "2026-06-01T10:00:00Z",
      "payload": {
        "auctionId": 1,
        "status": "SOLD",
        "winnerUserId": 2,
        "winningPrice": 1500,
        "finishedAt": "2026-06-01T10:00:00Z"
      }
    }
  ]
}
```

BLIND USER replay rules:

- includes own bid only.
- includes chat.
- includes historical stats.
- includes final winner/winning price.
- excludes other users' bids.
- excludes `startingPrice`.
- excludes product `estimatedPrice`.

BLIND ADMIN replay rules:

- includes full bid list.
- still does not include product `estimatedPrice`.

Error responses:

```json
{
  "error": {
    "code": "AUCTION_NOT_FINISHED",
    "message": "Replay is available only after auction finishes."
  }
}
```

Status/error table:

| HTTP | Code | Meaning |
| --- | --- | --- |
| `400` | `INVALID_VIEWER` | Missing/invalid mock auth header. |
| `404` | `AUCTION_NOT_FOUND` | Auction does not exist. |
| `409` | `AUCTION_NOT_FINISHED` | Auction is still `UPCOMING` or `RUNNING`. |
| `403` | `REPLAY_FORBIDDEN` | USER is not participant. ADMIN is allowed. |

## 14. Backend Integration: RealtimeEventPublisher

Other backend modules should inject:

```java
RealtimeEventPublisher publisher;
```

Available methods:

```java
sendToSession(String sessionId, ServerEvent event)
sendToUser(long userId, ServerEvent event)
sendToUser(long userId, String type, Long auctionId, Object payload)
broadcastToAuctionRoom(long auctionId, ServerEvent event)
broadcastToAuctionRoom(long auctionId, String type, Object payload)
broadcastUserJoined(long auctionId, RealtimePrincipal principal)
broadcastUserLeft(long auctionId, RealtimePrincipal principal)
broadcastChatMessage(long auctionId, ChatMessageSnapshot message)
broadcastNormalPriceUpdated(long auctionId, NormalPriceUpdatedPayload payload)
sendBlindBidAccepted(long userId, long auctionId, BlindBidAcceptedPayload payload)
broadcastAuctionFinished(long auctionId, AuctionFinishedPayload payload)
```

NORMAL example after accepted bid:

```java
publisher.broadcastNormalPriceUpdated(
    auctionId,
    new NormalPriceUpdatedPayload(auctionId, currentPrice, nextMinimumBid, leadingUserId)
);
```

BLIND example after accepted bid:

```java
publisher.sendBlindBidAccepted(
    bidderUserId,
    auctionId,
    new BlindBidAcceptedPayload(auctionId, amount, "bid-" + bidId)
);
```

Finish example:

```java
publisher.broadcastAuctionFinished(
    auctionId,
    new AuctionFinishedPayload(auctionId, "SOLD", winnerUserId, winningPrice)
);
```

Do not broadcast hidden BLIND bid data to the auction room while the auction is running.
