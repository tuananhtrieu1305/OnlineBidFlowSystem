# OnlineBidFlow Team Conventions

This document is the shared implementation guide for the whole team. It keeps folder structure, module boundaries, and UI direction consistent while the current base app grows into the full auction system.

Source inputs:

- `README.md`
- `SYSTEM_SPEC.md`
- `database/init.sql`
- team proposal for target repository structure
- team proposal for visual direction

## 1. Repository Direction

Keep the current top-level folders:

```text
OnlineBidFlowSystem/
  README.md
  SYSTEM_SPEC.md
  docker-compose.yml
  database/
  backend/
  frontend/
  docs/
```

Do not rename `frontend/` or `backend/` because the existing Docker, build, and CI setup already depends on them.

The proposed module folders are target structure. Create folders only when there is real code or documentation to place there. Do not create empty folder trees just to match the target.

## 2. Backend Structure

Backend code should be grouped by business module. Each large business module owns its controllers, services, repositories, entities, and DTOs.

Recommended top-level package:

```text
backend/src/main/java/com/group6/auction/
  config/
  security/
  common/
  health/
  account/
  wallet/
  product/
  auction/
  statistics/
  leaderboard/
  realtime/
```

### 2.1 Common Rules

- `common/` contains only truly shared code such as exceptions and common API error DTOs.
- Do not put wallet, bid, room, or role-specific business logic into a generic utility folder.
- Admin APIs should live inside the module they manage. For example, product admin APIs belong in `product/`, not in one large `admin/` module.
- Frontend calls APIs; frontend never accesses the database.
- Backend is the security boundary. DTOs must enforce visibility rules before data reaches the client.

### 2.2 Account Example

```text
account/
  controller/
    AuthController.java
    AccountController.java
    AdminUserController.java
  service/
    RegistrationService.java
    AccountService.java
  repository/
    UserRepository.java
  entity/
    User.java
    UserRole.java
  dto/
    RegisterRequest.java
    LoginRequest.java
    UserResponse.java
```

### 2.3 Wallet Example

```text
wallet/
  controller/
    WalletController.java
    AdminWalletController.java
  service/
    WalletService.java
  repository/
    WalletRepository.java
    CoinTransactionRepository.java
  entity/
    Wallet.java
    CoinTransaction.java
  dto/
    DepositRequest.java
    WalletResponse.java
    CoinTransactionResponse.java
```

### 2.4 Product Example

```text
product/
  controller/
    AdminProductController.java
  service/
    ProductService.java
    ProductImageStorage.java
  repository/
    ProductRepository.java
  entity/
    Product.java
  dto/
    CreateProductRequest.java
    UpdateProductRequest.java
    ProductResponse.java
    AdminProductResponse.java
```

`ProductResponse` for normal users must not include `estimated_price`. `AdminProductResponse` may include it only after server-side authorization.

## 3. Auction Module Structure

Auction data is shared, but NORMAL and BLIND business logic must stay separate.

```text
auction/
  entity/
    Auction.java
    AuctionType.java
    AuctionStatus.java
    AuctionAccessType.java
    Bid.java
    AuctionParticipant.java
  repository/
    AuctionRepository.java
    BidRepository.java
    AuctionParticipantRepository.java
  configuration/
    controller/
      AdminAuctionController.java
    service/
      AuctionConfigurationService.java
    dto/
      CreateAuctionRequest.java
      UpdateAuctionRequest.java
  normal/
    controller/
    service/
    dto/
  blind/
    controller/
    service/
    dto/
  lifecycle/
    AuctionScheduler.java
    AuctionLifecycleService.java
  query/
    AuctionQueryController.java
    AuctionQueryService.java
    dto/
  event/
    AuctionStartedEvent.java
    AuctionFinishedEvent.java
```

Auction rules:

- There is one shared entity/repository set for `auctions`, `bids`, and `auction_participants`.
- NORMAL DTOs and BLIND DTOs are separate to reduce risk of leaking hidden data.
- `lifecycle/` coordinates start/end timing and calls the correct module.
- Winner logic belongs to NORMAL or BLIND business logic, not realtime.
- Auction modules call wallet services. They must not mutate wallet tables directly through wallet repositories.

## 4. Realtime Backend Structure

Realtime should follow this target structure:

```text
realtime/
  config/
  connection/
  protocol/
  room/
  chat/
  reconnect/
  replay/
```

Responsibilities:

- `config/`: WebSocket endpoint registration and realtime configuration.
- `connection/`: connected sessions, mock/current identity, session registry.
- `protocol/`: raw WebSocket JSON envelopes, event names, request/response DTOs.
- `room/`: join/leave, PUBLIC/PRIVATE room access, in-memory room membership.
- `chat/`: chat validation, persistence to `chat_messages`, simple anti-spam.
- `reconnect/`: reconnect flow and state synchronization.
- `replay/`: REST replay API and timeline builders.

Realtime does not:

- validate bid business rules.
- decide winners.
- modify Coin.
- create `socket_connections`, `chat_rooms`, or `replays` tables.

## 5. Frontend Structure

Frontend should move gradually toward a feature-based layout:

```text
frontend/src/
  main.tsx
  app/
    router.tsx
    providers.tsx
    guards/
      RequireAuth.tsx
      RequireRole.tsx
  layouts/
    AuthLayout.tsx
    UserLayout.tsx
    AdminLayout.tsx
  components/
    ui/
    feedback/
  features/
    auth/
    account/
    wallet/
    products/
    auctions/
      catalog/
      configuration/
      normal/
      blind/
      history/
    room/
    chat/
    replay/
    leaderboard/
    diagnostics/
  lib/
    api/
      client.ts
      errors.ts
    realtime/
      client.ts
    desktop/
      bridge.ts
  config/
    server.ts
  types/
    desktop.d.ts
  styles/
    index.css
```

Rules:

- Feature folders may contain `pages/`, `components/`, `api/`, `hooks/`, and `types.ts` when needed.
- Diagnostics pages are for the current connection-test base.
- Shared reusable primitives go in `components/ui`.
- Shared loading, error, empty, and offline states go in `components/feedback`.
- Shared HTTP client goes in `lib/api`.
- Shared WebSocket client goes in `lib/realtime`.
- Electron bridge code stays narrow and controlled in `lib/desktop`.

## 6. Team Ownership

| Member | Backend focus | Frontend focus |
| --- | --- | --- |
| Tien | account, security, wallet, product, auction configuration | auth, account, wallet, products, auction configuration |
| Vinh | auction/normal | auctions/normal |
| Dat | auction/blind, statistics, leaderboard | auctions/blind, leaderboard, statistics surfaces |
| Tuan Anh | realtime | room, chat, replay, lib/realtime |
| Shared | auction entity, lifecycle, query, schema | router, layouts, API client, common types |

When a change touches shared areas, coordinate before implementing.

## 7. UI Direction

OnlineBidFlow should feel like a modern auction floor: warm light background, deep teal brand color, prominent product imagery, clear bidding actions, trustworthy information hierarchy, and a subtle collector-product mood.

The core flow should be:

```text
find auction -> evaluate product -> place bid -> follow result
```

Do not design the app like a marketing landing page. The desktop app should open into useful product/auction surfaces.

## 8. Color Tokens

Use these as the shared palette:

| Role | Color | Usage |
| --- | --- | --- |
| App background | `#F6F5F1` | Main app background; warmer than pure white |
| Surface | `#FFFFFF` | Product cards, tables, dialogs, panels |
| Brand | `#145C53` | Primary buttons, active nav, key accents |
| Main text | `#202824` | Headings, prices, primary content |
| Muted text | `#66716B` | Labels, descriptions, timestamps |
| Border | `#E1E5DF` | Light separators and panel borders |
| Warning | `#A66316` | Ending-soon and caution states |
| Error | `#B83A35` | Failed bid, insufficient Coin, validation errors |

Use neutral colors for most of the screen. Teal should guide attention, not flood the interface. State colors must be paired with text or icons, never color alone.

## 9. Typography

- Prefer `Be Vietnam Pro` for the product UI.
- Use weights 400, 500, and 600.
- Use tabular numbers for prices, counters, clocks, balances, and bid amounts.
- Keep desktop tool surfaces compact and readable.
- Do not use oversized hero-style headings inside app panels.

Implementation note:

- If the font is not bundled yet, use a system fallback temporarily and leave the UI tokens ready for `Be Vietnam Pro`.
- Do not fetch fonts from the network at runtime unless the team explicitly approves it for desktop builds.

## 10. Shape, Surfaces, Motion

- Product cards: 12px radius.
- Buttons and inputs: 8px radius.
- Repeated cards should have consistent image ratios and spacing.
- Normal app panels should use borders and whitespace, not heavy shadows.
- Shadows are reserved for popovers, menus, and dialogs.
- Product images should use a consistent 4:3 ratio.
- Motion should be short, about 150-200ms.
- Price updates may briefly highlight once, then settle.
- Avoid heavy gradients, glass effects, glow, decorative backgrounds, and identical card piles with no hierarchy.

## 11. Main User Screens

### 11.1 Auction Discovery

Desktop layout:

- Left sidebar around 220px.
- Navigation: Discover, My Auctions, Coin Wallet, History.
- Top area: search, filters, account.
- Main content begins with auction listings.

Auction card priority:

1. Product image.
2. Product name.
3. Auction type label.
4. Visible price data allowed by auction type.
5. Remaining time.

Use friendly labels:

- `Dau gia cong khai` for NORMAL.
- `Dau gia kin` for BLIND.

Columns should respond to window width. Do not force four cards into a narrow desktop window.

### 11.2 Auction Room

This is the most important screen.

Use a two-column layout near 60/40 on desktop:

| Left column | Right column |
| --- | --- |
| Product image and product info | Remaining time |
| Description and condition | Price and user's state |
| Bid history or allowed data | Bid input, increment, submit button |
| Chat as secondary content | Available Coin and transaction notices |

Rules:

- The bid action area must remain easy to reach when scrolling.
- Chat must not dominate the price and bidding action.
- Do not show success before the server confirms it.
- Include states for sending bid, outbid, insufficient Coin, disconnected, auction ended, and bid rejected.

NORMAL room:

- Show current price.
- Show minimum next bid.
- Show public bid history.
- Show allowed leader data.
- Do not show historical product price statistics while auction is RUNNING.

BLIND room:

- Show historical SOLD statistics.
- Show the user's own bid if already placed.
- Do not show current price, leader, highest bid, other users' bids, or starting price.
- Before submit, clearly confirm that the user can bid only once.

### 11.3 Wallet

Wallet screen should clearly distinguish:

- available Coin.
- locked Coin.

Transaction history should explain why Coin was locked, unlocked, deposited, or paid. Make clear that Coin is simulated in-system currency.

## 12. UI Writing Rules

Use specific state messages:

- Good: `Gia vua tang. Muc toi thieu moi la 650 Coin.`
- Avoid: `Co loi xay ra.`

All important states should be explicit:

- disconnected.
- reconnecting.
- bid sending.
- bid accepted.
- bid rejected.
- insufficient Coin.
- outbid.
- auction just ended.

## 13. Reusable UI Details

Keep these details consistent:

- room code presentation.
- Coin amount formatting.
- NORMAL/BLIND badges.
- countdown clock.
- product image treatment.
- status badge language.
- table density and row spacing.

Suggested examples:

- Coin: `1,500 Coin`
- Room code: `CAMERA26`
- Time: `12:04`
- NORMAL badge: `Dau gia cong khai`
- BLIND badge: `Dau gia kin`

## 14. Frontend Implementation Checklist

Before a UI PR is complete:

- Uses shared color tokens.
- Uses the agreed radius rules.
- Product images keep a 4:3 ratio.
- Price and time use tabular numbers.
- Responsive layout does not overlap or squeeze text.
- NORMAL and BLIND visibility rules are reflected in UI copy.
- Error/empty/loading/disconnected states are present.
- No placeholder product names like `San pham 1` in committed demo UI.
- No hidden security assumptions in frontend.

## 15. Generated And Uploaded Files

Do not commit generated folders:

```text
frontend/node_modules/
frontend/dist/
frontend/dist-electron/
frontend/release/
frontend/coverage/
frontend/test-results/
backend/target/
.cache/
```

Product images uploaded by admins belong in server-managed storage or a configured volume, not in `frontend/public`. The desktop app should not need to be rebuilt every time a product image changes.
