# API NORMAL sau tích hợp

NORMAL dùng các module có sẵn trên nhánh pbtien (bao gồm realtime của tuananh).
Base URL: http://localhost:8080. Giao diện: /#/normal hoặc /#/normal/{id}.

## Xác thực và ví chung

GET /api/auth/csrf lấy token và cookie session. POST /api/auth/login nhận
{"username":"...","password":"..."}, gửi X-CSRF-TOKEN và giữ cookie OBFSESSION.
Sau login lấy lại CSRF token mới. Các POST NORMAL và logout đều yêu cầu CSRF.
GET /api/auth/me trả danh tính; GET /api/wallet trả ví USER hiện tại.
Không gửi userId hoặc HTTP Basic để giả lập danh tính người đặt giá.
Frontend dùng AuthProvider, login/register và trang Ví Coin của pbtien.
Số dư ví availableBalance/lockedBalance được trả dạng chuỗi để giữ chính xác BIGINT.

## Endpoint NORMAL

| Method | Endpoint | Chức năng |
| --- | --- | --- |
| GET | /api/normal/auctions | Danh sách NORMAL và cờ joined |
| GET | /api/normal/auctions/{id} | Snapshot, giá, leader, lịch sử, kết quả, serverTime |
| POST | /api/normal/auctions/{id}/join | {"roomCode":"..."} cho PRIVATE hoặc {} cho PUBLIC |
| GET | /api/normal/auctions/{id}/bids | Lịch sử bid có kiểm tra quyền |
| POST | /api/normal/auctions/{id}/bids | {"amount":2650}; trả {auction, wallet}, HTTP 201 |

Coin đặt giá là số nguyên dương <= 9007199254740991. Giá tối thiểu bằng giá
hiện tại + bước giá. Chỉ USER đã tham gia phiên RUNNING trong thời gian hợp lệ được bid.
PRIVATE chưa tham gia không xem được chi tiết/bid. Admin xem được nhưng không join/bid.
Snapshot không chứa room_code, estimated_price hoặc dữ liệu BLIND.
Lỗi có code/message; mã phòng sai, phòng đầy, thiếu Coin, phiên đóng là lỗi nghiệp vụ.
Frontend không tự gửi lại POST khi mất phản hồi; tải dữ liệu để kiểm tra kết quả trước.

## Module dùng chung

REST join gọi RoomAccessService.authorizeAndRegister: kiểm tra mã, trạng thái,
giới hạn phòng dưới khóa row auction. Kiểm tra Coin khả dụng >= ceil(starting_price/2)
trong cùng transaction; không tạo participant nếu kiểm tra Coin thất bại.

Bid lưu vào bids rồi gọi AuctionWalletIntegration.normalBidAccepted trong cùng
transaction READ_COMMITTED. WalletTransferService khóa ví theo ID, cập nhật số dư
và coin_transactions; leader tự tăng chỉ khóa chênh lệch, leader bị vượt được hoàn Coin.
Nếu ledger không khớp số dư đang khóa, trả WALLET_LEDGER_INCONSISTENT và rollback.
Lỗi sau cập nhật ví cũng rollback bid, số dư và audit.

AuctionStartScheduler chung chuyển UPCOMING đến giờ thành RUNNING. NormalLifecycle
chốt NORMAL đến giờ thành SOLD/UNSOLD qua finishSold/finishUnsold của integration.
Tiền chỉ thanh toán một lần và chỉ giải phóng Coin thuộc phiên đang chốt.
Các thời điểm SQL được đọc/ghi theo UTC, JSON dùng ISO UTC.

WebSocket /ws/auction dùng session cookie, JOIN_ROOM gửi auctionId/roomCode.
UI nhận AUCTION_STATE, NORMAL_PRICE_UPDATED, AUCTION_FINISHED và CHAT_MESSAGE;
cập nhật lại giá/ví từ REST, có polling 5 giây khi socket gián đoạn.
Phòng PRIVATE cần nhập lại mã khi khôi phục socket; mã không lưu trong storage.
Chat dùng SEND_CHAT_MESSAGE với requestId, chờ xác nhận và không tự gửi lại khi timeout.

## Database và kiểm tra

Dùng schema hiện có; không có bảng riêng cho NORMAL. Cấu hình DB_HOST, DB_PORT,
DB_NAME, DB_USERNAME, DB_PASSWORD trong môi trường chạy backend theo README.
Không import lại database/init.sql vào DB đang có dữ liệu vì script có DROP TABLE.

Seed gốc đang thiếu ledger khóa 2500 Coin của Alice ở phiên #5 trong khi
wallets.locked_balance vẫn tính cả khoản đó. Xem docs/reviews/wallet-reconciliation.md.
Cần đối soát dữ liệu trước khi dùng phiên mẫu này; tích hợp không tự sửa DB thực.
Hash mật khẩu seed cũng chưa được xác nhận khớp Password@123; có thể dùng màn hình
đăng ký có sẵn để tạo tài khoản mới, nạp Coin và tạo phiên mới bằng Admin.

mvn verify chạy unit/socket tests và NORMAL tích hợp H2 MySQL mode. Fixture H2 bổ sung
ledger và mật khẩu chỉ trong test, không sửa seed/DB thực. Kiểm thử khóa/rollback
trên MySQL cần DB kiểm thử riêng. npm test chạy unit frontend; npm run test:e2e
chạy Electron với HTTP/WebSocket giả lập; các *-live.spec.ts dùng môi trường DB thực riêng.


### NORMAL timing

Admin create/update NORMAL accepts optional `normalTiming`:
```json
{"closingWindowSeconds":30,"extensionSeconds":30,"leaderboardSeconds":60}
```
Integers 1..3600; extensionSeconds >= closingWindowSeconds. Omitted uses defaults 30/30/60. Admin details and NORMAL snapshots return this object. Configure initial duration using startTime/endTime (admin UI has a minute-duration helper). Settings live in additive auction_normal_timing, bootstrapped with CREATE TABLE IF NOT EXISTS. Existing rows need no reset.

Accepted bids in the closing window extend end_time to max(existing deadline, accepted bid time + extensionSeconds) in the SAME transaction. Rejected bids never extend. NORMAL_PRICE_UPDATED remains an invalidation event; clients refetch REST snapshot for authoritative endsAt, timing, prices and wallet. No new auction rounds or elimination rules are introduced.


NORMAL snapshots also include `scheduledEndsAt` (original planned deadline). UI rhythms split [startsAt, scheduledEndsAt] in ratio 3:2:1; the last rhythm ends at the current authoritative endsAt, including extensions. The additive nullable scheduled_end_time column is bootstrapped on startup. Existing sessions missing it use the current deadline, then freeze that value before a future extension. Rhythm transitions do not change bid eligibility, increments, held Coin, or settlement.
