# Ví Coin — triển khai và tích hợp

Module của Phạm Bá Tiến. Không thay đổi schema hoặc dữ liệu mẫu.

## Giao diện và API

Đăng nhập tài khoản USER → Ví Coin ở thanh bên. Màn hình hiển thị Coin khả dụng, đang khóa, lịch sử có lọc và tải thêm. Nạp Coin là giả lập, không có thanh toán tiền thật.

| API | Kết quả |
| --- | --- |
| GET /api/wallet | walletId, availableBalance, lockedBalance, updatedAt |
| POST /api/wallet/deposits | 201, snapshot ví sau giao dịch; body `{ "amount": "1000" }` |
| GET /api/wallet/transactions?limit=20&type=LOCK&cursor=... | items, nextCursor |

Số Coin và ID trả bằng chuỗi để giữ chính xác BIGINT. POST chỉ nhận amount, cần session USER và CSRF. USER chỉ đọc ví của chính mình; ADMIN không dùng API ví cá nhân. Lịch sử trả delta, không suy diễn số dư trước/sau từ dữ liệu seed. Thời gian DATETIME của module được lưu/đọc UTC.

Giới hạn nạp mặc định 10 lần/phút/tài khoản, cấu hình `app.wallet.deposits-per-minute`. Giới hạn này nằm trong bộ nhớ một backend. Các lỗi chính: 400 input sai; 401 hết phiên; 403 sai quyền/CSRF; 404 thiếu ví; 409 số dư/xung đột; 429 giới hạn tần suất.

**Giới hạn chống nạp trùng:** schema chưa có idempotency key. UI chặn gửi lặp khi request đang chạy; không tự retry khi timeout/lỗi server. Khi kết quả không rõ, người dùng kiểm tra lại ví và lịch sử trước khi nạp tiếp. Hai request độc lập hợp lệ vẫn là hai lần nạp. Đáp ứng exactly-once qua mất mạng cần nhóm thống nhất bổ sung schema.

## Hợp đồng cho NORMAL và BLIND

Phase 3 đã thêm `AuctionWalletIntegration` để nối quyết định đã kiểm tra với ví, kết quả và sự kiện AFTER_COMMIT. Module đấu giá ưu tiên gọi adapter này thay vì tự phối hợp ví/result/socket. Xem [hướng dẫn tích hợp](auction-wallet-integration.md); caller bid/scheduler thực tế vẫn thuộc thành viên phụ trách.

`WalletTransferService` là service nội bộ, không có HTTP endpoint để client tự thay đổi Coin.

| Phương thức | Ý nghĩa |
| --- | --- |
| lockToAmount(auctionId, userId, target) | Tổng Coin cần giữ ở phiên này; chỉ khóa phần tăng thêm |
| replaceLeader(auctionId, previousUserId, nextUserId, target) | Hoàn người cũ và khóa người mới nguyên tử; cùng người thì tăng phần chênh |
| releaseAll(auctionId, userId) | Hoàn toàn bộ Coin đang giữ của người đó tại phiên RUNNING |
| releaseAuction(auctionId) | Hoàn mọi người khi phiên RUNNING/UNSOLD, không được đã PAYMENT |
| settleAuction(auctionId, winnerUserId, winningAmount) | Thanh toán vào SYSTEM, hoàn phần dư người thắng và toàn bộ người thua |

### Transaction bắt buộc

Caller dùng `@Transactional(isolation = Isolation.READ_COMMITTED)`; service bắt buộc có outer transaction và kiểm tra isolation này. READ_COMMITTED bảo đảm việc tìm ví tham gia không dùng snapshot cũ từ trước khi giữ khóa phiên. Mọi caller tuân theo thứ tự **khóa phiên → toàn bộ ví tăng dần theo ID → ledger**. Không khóa ví trước rồi gọi service. Mỗi transaction xử lý một phiên; nếu xử lý nhiều phiên cần một chiến lược thứ tự khóa riêng.

Ví dụ kết thúc phiên (pseudocode, chưa triển khai nghiệp vụ winner):

```java
@Transactional(isolation = Isolation.READ_COMMITTED)
public void finish(long auctionId) {
    var auction = auctions.findByIdForUpdate(auctionId); // PESSIMISTIC_WRITE
    // Kiểm tra trạng thái/thời gian, tính winner bằng nghiệp vụ NORMAL/BLIND.
    // Flush các thay đổi JPA cần nhìn thấy từ JDBC trước khi gọi ví.
    entityManager.flush();
    if (result.hasWinner()) {
        walletTransfers.settleAuction(auctionId, result.userId(), result.price());
        auction.markSold(result.userId(), result.price());
    } else {
        walletTransfers.releaseAuction(auctionId);
        auction.markUnsold();
    }
    // Result/status và Coin cùng commit. Realtime chỉ publish AFTER_COMMIT.
}
```

Ví dùng JdbcTemplate cùng DataSource/transaction manager của JPA. Không giữ rồi dùng lại Wallet entity đang managed sau khi gọi JDBC (có thể stale); query lại hoặc refresh nếu cần. Không catch lỗi ví rồi tiếp tục commit bid/result. DEADLOCK/lock timeout phải rollback toàn bộ thao tác; caller quyết định retry cả transaction sau khi kiểm tra trùng bid.

`lockToAmount` và `replaceLeader` chỉ nhận phiên RUNNING. Ví không kiểm tra bước giá, 50% giá khởi điểm, giới hạn một bid BLIND hoặc tính winner. Các điều kiện đó thuộc module đấu giá. Coin phải được khóa đủ để thanh toán winningAmount; điều kiện đủ 50% để tham gia không đồng nghĩa chỉ giữ 50% giá thắng.

Thanh toán lặp với đúng winner/amount là no-op nếu ledger đã có đúng cặp PAYMENT và không còn hold của phiên. Khác winner/amount bị từ chối. Caller **phải** cập nhật SOLD/UNSOLD cùng transaction, không commit thanh toán mà giữ RUNNING. Ví SYSTEM được tìm bằng wallet_type, phải có đúng một ví; không hardcode ID.

## Dữ liệu cũ và đối soát

Hold được suy ra từ tổng locked_delta theo wallet_id + auction_id. Trước khi chuyển Coin, tổng hold phải khớp locked_balance, không có hold âm hoặc hold thiếu auction_id. Nếu lệch, trả WALLET_LEDGER_INCONSISTENT và rollback. Không tự sửa seed, không chạy lại init.sql hoặc xóa volume.

SQL chỉ đọc để tìm ví cần kiểm tra (không dùng để tự cập nhật số dư):

```sql
SELECT w.id, w.locked_balance, COALESCE(SUM(t.locked_delta), 0) AS ledger_locked
FROM wallets w LEFT JOIN coin_transactions t ON t.wallet_id = w.id
GROUP BY w.id, w.locked_balance
HAVING w.locked_balance <> COALESCE(SUM(t.locked_delta), 0);

SELECT wallet_id, auction_id, SUM(locked_delta) AS held
FROM coin_transactions
GROUP BY wallet_id, auction_id
HAVING SUM(locked_delta) < 0
    OR (auction_id IS NULL AND SUM(locked_delta) <> 0);

SELECT COUNT(*) AS system_wallet_count FROM wallets WHERE wallet_type = 'SYSTEM';
```

## Kiểm thử

- WalletIT: API thật/MySQL, CSRF, phân quyền, input, cursor.
- WalletTransferIT: khóa theo phiên, đổi leader rollback, settlement lặp/bảo toàn Coin, concurrency, thiếu outer transaction/isolation, ledger bất nhất, overflow, rollback khi INSERT ledger thất bại.
- wallet.spec.ts: Electron, trạng thái số dư, input, chờ server, lỗi mạng không tự retry, filter, hết phiên, kích thước cửa sổ nhỏ.
- login-live.spec.ts: đăng ký/đăng nhập/nạp/xem lịch sử/reload bằng backend và MySQL kiểm thử thật, cùng kiểm thử session socket/logout.

MySQL integration test chỉ chạy với DB riêng và REGISTRATION_TEST_DATABASE=true. Không chạy trên DB đang dùng demo.

### Kết quả xác minh ngày 2026-10-01

60 backend tests, 20 MySQL integration tests, 30 frontend tests, 14 Electron E2E và 1 luồng Electron/backend/MySQL thật đã qua. npm audit: 0 vulnerabilities. Coverage 100% được báo chỉ cho nhóm helper frontend đang cấu hình đo, không phải toàn ứng dụng.

Đối soát DB local hiện tại: ví ID 2 có locked_balance=4100 trong khi tổng ledger locked_delta=1600; có đúng 1 SYSTEM wallet. Giữ nguyên dữ liệu; cần nhóm đối soát nguồn giữ Coin trước khi dùng ví này cho nghiệp vụ đấu giá. Các tài khoản mới có ledger đầy đủ không chịu ảnh hưởng.

So với bố cục dự kiến trong plan, phần ledger được triển khai bằng WalletLedger/JdbcTemplate để kiểm soát khóa SQL và kiểu DATETIME rõ ràng; không thêm CoinTransaction JPA entity/repository song song. Service này vẫn dùng chung transaction với JPA của module đấu giá.
