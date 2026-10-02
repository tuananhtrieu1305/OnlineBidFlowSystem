# Phase 1 — API và màn hình quản trị ví hệ thống

Ngày lập: 02/10/2026. Phụ trách: Phạm Bá Tiến.
Trạng thái: đã khảo sát code, chưa triển khai. Mục tiêu: hoàn thiện phần tra cứu ví SYSTEM, độc lập với scheduler và nghiệp vụ xác định winner của nhóm.

## 1. Kết quả khảo sát và quyết định

- Đặc tả yêu cầu đúng một SYSTEM wallet. Schema cho phép nhiều hàng SYSTEM vì user_id=NULL; `WalletLedger.systemId()` hiện kiểm tra đúng một hàng. Màn hình phải báo lỗi nếu thiếu/trùng, không chọn hàng đầu tiên hoặc hardcode ID 1.
- `WalletTransferService.settleAuction` ghi hai PAYMENT: ví người thắng giảm locked_delta, SYSTEM tăng available_delta. Chỉ tính tiền thu từ hàng thuộc SYSTEM, không cộng cả hai hoặc tổng winning_price từ auctions.
- Có sẵn WalletResponse, TransactionResponse, query lịch sử cá nhân và kiểm thử settlement. HTTP ví cá nhân chỉ dành cho USER. API mới đặt dưới `/api/admin/**`, giữ nguyên quyền cũ.
- coin_transactions có wallet_id, auction_id nullable, type, delta, created_at DATETIME(6); không có balance_before/after hoặc payment_pair_id. Không suy diễn người thanh toán trực tiếp từ một dòng ledger SYSTEM.
- Index hiện có `(wallet_id, created_at)`; khóa chính là id. Bắt đầu với schema này, kiểm tra EXPLAIN trước khi đề xuất thêm index.
- Seed có ví SYSTEM số dư 1500 và PAYMENT ghi có 1500. Đây là dữ liệu mẫu, không phải bằng chứng DB hiện tại luôn cân đối. Vấn đề ví USER ID 2 đã ghi trong docs/wallet.md thuộc Phase 2.

**Quyết định phạm vi:** chỉ đọc, không thêm migration, thư viện UI, endpoint chuyển Coin, nạp/rút SYSTEM hay sửa ledger. Tổng Coin đã nhận là tổng các dòng PAYMENT có available_delta > 0 của SYSTEM; không gọi số đó là số dư hay doanh thu tiền thật.

## 2. Trải nghiệm Admin

Luồng: `Đăng nhập Admin → Ví hệ thống → xem số dư/tổng thu → lọc lịch sử → mở phiên liên quan`.

Route `/admin/system-wallet`, link trên thanh bên và trang tổng quan Admin. Dùng nền #F6F5F1, bề mặt trắng, xanh #145C53, font Be Vietnam Pro; chữ số tabular, định dạng vi-VN.

Phần trên gồm:

1. **Số dư hiện tại:** available_balance thực tế.
2. **Tổng Coin nhận từ thanh toán:** tổng PAYMENT dương, toàn bộ lịch sử, không thay đổi theo bộ lọc bảng; ghi rõ ý nghĩa này.
3. **Coin đang khóa:** locked_balance thực tế, bình thường bằng 0. Nếu khác 0, hiện thông báo cần kiểm tra dữ liệu, không che hoặc tự sửa.

Hiện thời điểm cập nhật ví, nút Làm mới và chú thích Coin giả lập. Không hiển thị nút nạp/rút, sửa số dư hoặc thanh toán lại.

Lịch sử có các cột: mã giao dịch, thời gian, loại, thay đổi Coin khả dụng, thay đổi Coin đang khóa, mã phiên. Dòng delta có dấu +/-; giao dịch khác PAYMENT vẫn được hiển thị đúng loại để không giấu dữ liệu bất thường. Không thêm thông tin người thắng vào DTO Phase 1; Admin có thể mở chi tiết phiên đã được bảo vệ quyền. auctionId=null hiển thị “Không gắn phiên”.

Bộ lọc: mã phiên chính xác, từ ngày, đến ngày, loại giao dịch (mặc định Tất cả). Nút Áp dụng/Xóa bộ lọc; nhập chưa áp dụng không gửi request. Lưu bộ lọc đã áp dụng vào URL, giữ khi quay lại từ chi tiết phiên. Mỗi lần đổi filter/làm mới tải trang đầu; “Tải thêm” nối dữ liệu bằng cursor.

Trạng thái cần có: đang tải, ví hợp lệ chưa có giao dịch, không có kết quả theo lọc, lỗi kết nối và retry, 401 về login, 403 ẩn toàn bộ dữ liệu, thiếu/trùng SYSTEM báo lỗi dữ liệu. Không biến lỗi API thành số dư 0. Cửa sổ 820px không tràn toàn trang; bảng có vùng cuộn riêng. Ngăn response cũ ghi đè filter mới, hủy request khi unmount và giữ dữ liệu đúng thứ tự khi tải thêm.

## 3. Hợp đồng API

| Method | Endpoint | Vai trò |
| --- | --- | --- |
| GET | `/api/admin/system-wallet` | Số dư và tổng PAYMENT ghi có toàn thời gian |
| GET | `/api/admin/system-wallet/transactions` | Lịch sử ví SYSTEM có bộ lọc và cursor |

Không nhận walletId/userId từ client. Server tự xác định đúng một SYSTEM wallet cho mỗi request. Cả hai endpoint cần session ADMIN; không sửa SecurityConfig để mở quyền USER.

Response tổng quan dự kiến:

```json
{
  "walletId": "1",
  "availableBalance": "1500",
  "lockedBalance": "0",
  "totalReceivedCoin": "1500",
  "updatedAt": "2026-06-01T11:00:00Z",
  "readAt": "2026-10-02T03:00:00Z"
}
```

`totalReceivedCoin = COALESCE(SUM(CASE WHEN transaction_type='PAYMENT' AND available_delta>0 THEN available_delta ELSE 0 END),0)` với wallet_id đã xác minh. Tổng có thể lớn hơn long dù từng giao dịch nằm trong long: lấy SQL DECIMAL bằng BigDecimal, chuyển chuỗi số nguyên bằng toPlainString; không dùng double hoặc getLong cho SUM. ID/Coin/delta đều trả chuỗi. updatedAt là thời điểm ví thay đổi, readAt là thời điểm server tạo response, không phải mốc snapshot cho các request kế tiếp.

Response lịch sử tái dùng trường TransactionResponse:

```json
{
  "items": [
    {"id":"10","auctionId":"1","type":"PAYMENT","availableDelta":"1500","lockedDelta":"0","createdAt":"2026-06-01T10:00:02Z"}
  ],
  "nextCursor": null
}
```

Query được hỗ trợ:

| Tham số | Quy tắc |
| --- | --- |
| auctionId | Tùy chọn, chuỗi nguyên dương trong miền signed long mà ứng dụng đang dùng; lọc chính xác; ID hợp lệ không có dữ liệu trả danh sách rỗng |
| type | Tùy chọn: DEPOSIT, LOCK, UNLOCK, PAYMENT; rỗng được chuẩn hóa thành không lọc |
| from | Tùy chọn, ISO-8601 có offset/Z; bao gồm mốc đầu |
| to | Tùy chọn, ISO-8601 có offset/Z; không bao gồm mốc cuối |
| limit | Mặc định 20, từ 1 đến 100 |
| cursor | Tùy chọn, opaque string có giới hạn 512 ký tự |

Ngày UI theo múi giờ máy người dùng, có nhãn múi giờ. “Đến ngày 02/10” chuyển thành đầu ngày 03/10 địa phương rồi đổi UTC; dùng phép cộng ngày lịch, không cộng cố định 24 giờ. API dùng `created_at >= from AND created_at < to`. Cho phép chỉ nhập một đầu; khi đủ hai đầu yêu cầu from < to. Reject ngày không hợp lệ, không offset, ngoài phạm vi DATETIME; giới hạn độ dài chuỗi ngày. Không dùng CAST/DATE trên cột created_at khi lọc để giữ khả năng dùng index.

Cursor có version, walletId, thời gian UTC microsecond, id và dấu vết bộ lọc chuẩn hóa; Base64URL JSON là mã hóa biểu diễn, không phải cơ chế bảo mật. Kiểm tra cấu trúc/độ dài/miền giá trị/version/filter. Luôn áp lại walletId do server xác định và bộ lọc SQL, tuyệt đối không tin cursor để cấp quyền. Cursor sai hoặc dùng với bộ lọc khác trả 400 INVALID_CURSOR. Không cần ký cursor vì sửa vị trí không mở thêm quyền đọc.

Mã lỗi: 401 UNAUTHENTICATED; 403 FORBIDDEN; 400 INVALID_FILTER/INVALID_CURSOR; 409 SYSTEM_WALLET_INVALID khi thiếu/trùng SYSTEM; 500 INTERNAL_ERROR với nội dung chung, log server không chứa session/secrets. Không trả 404 chỉ vì ví chưa có giao dịch. Không thay đổi CSRF toàn hệ thống; đây là các GET không tạo tác dụng phụ.

## 4. Query và nhất quán dữ liệu

`Controller → SystemWalletQueryService → JdbcTemplate → DTO`.

- Service đọc `@Transactional(readOnly=true, isolation=REPEATABLE_READ)` cho từng endpoint để kiểm tra một ví và đọc số liệu trong cùng snapshot MySQL. Không dùng FOR UPDATE hoặc gọi WalletLedger.lock/held/change từ GET.
- Tổng quan: query xác định tối đa hai SYSTEM rows để phát hiện trùng; query aggregate riêng cùng transaction. History: xác định SYSTEM rồi query các cột cần thiết, không SELECT * hoặc join bids/users.
- History sắp `created_at DESC, id DESC`, đọc limit+1. Trang kế dùng `(created_at < lastTime OR (created_at = lastTime AND id < lastId))`, cắt đúng limit rồi sinh cursor từ dòng cuối đã trả. Query parameterized; chỉ fragment SQL cố định được nối.
- Giữ nguyên precision 6 chữ số khi đọc/lưu cursor qua LocalDateTime UTC. BigInt ở frontend cho mọi Coin/delta; không parseFloat/Number.
- Tổng quan và bảng là hai request độc lập, không đảm bảo snapshot chung. Settlement vừa commit có thể xuất hiện sau khi Làm mới. Các trang history không phải snapshot toàn phiên duyệt: giao dịch mới có thể cần refresh để thấy; test không hứa exactly-once giữa nhiều transaction commit lệch thứ tự. UI khử trùng theo ID khi ghép trang.
- Không cộng trừ số dư từ các dòng đang hiển thị và không so sánh tổng PAYMENT với balance để kết luận ledger hỏng: có thể có số dư đầu kỳ hoặc dữ liệu lịch sử khác. Đối soát toàn bộ thuộc Phase 2.
- Không refactor WalletQueryService của USER/Admin-users chỉ để tái sử dụng vài dòng. Tái dùng DTO/formatCoin; query SYSTEM riêng do có aggregate, khoảng thời gian và nhận diện ví khác. Không tạo thêm entity ledger.
- Chạy EXPLAIN với dữ liệu kiểm thử đủ lớn cho all-time, date range, auctionId. Nếu query cần index bổ sung, ghi bằng chứng và đề xuất migration riêng; không tự reset DB hoặc đổi schema trong Phase 1.

## 5. Cấu trúc dự kiến

```text
backend/src/main/java/com/group6/auction/wallet/admin/
  AdminSystemWalletController.java
  SystemWalletQueryService.java
  SystemWalletFilters.java
  SystemWalletCursor.java
  SystemWalletSummary.java
  SystemWalletHistory.java
  SystemWalletExceptionHandler.java
backend/src/test/java/com/group6/auction/wallet/admin/
  SystemWalletFiltersTest.java
  SystemWalletCursorTest.java
  SystemWalletIT.java
frontend/src/features/admin/system-wallet/
  SystemWalletPage.tsx
  systemWalletApi.ts
  filters.ts
  system-wallet.css
frontend/tests/system-wallet-filters.test.ts
frontend/e2e/system-wallet.spec.ts
frontend/e2e/system-wallet-live.spec.ts
frontend/playwright.system-wallet-live.config.ts
docs/system-wallet.md
```

Shared edits: AppLayout, AdminPage, router, test ignore cho live test, coverage config nếu cần. Chỉ tách thêm component khi màn hình thực tế đủ lớn; không tạo design system mới.

## 6. Các bước thực hiện

1. **Contract + RED:** kiểm thử filter/time/cursor, quyền và missing/duplicate SYSTEM; checkpoint trước production code theo TDD workflow hiện tại.
2. **Backend:** summary/history DTO, query snapshot, lỗi; kiểm thử trên MySQL riêng. Giữ service thanh toán nguyên trạng.
3. **Frontend:** navigation, số liệu, bảng, filter URL, Làm mới/Tải thêm, kiểm soát request cũ và hết quyền; build/typecheck.
4. **Kiểm thử tích hợp thực:** tạo fixture USER/ví/auction trong DB riêng; gọi WalletTransferService qua test harness nội bộ, cập nhật SOLD cùng transaction; dùng HTTP và Electron Admin xác minh Coin nhận. Không tạo HTTP endpoint debug cho settlement và không giả lập scheduler đã tồn tại.
5. **Rà soát trong phạm vi:** regression auth/USER wallet/Admin users/products/auctions/realtime, coverage module mới >=80%, audit, diff review, docs, checkpoint GREEN. Có thể cập nhật container backend local khi triển khai để người dùng chạy thử; không push nếu chưa được yêu cầu.

## 7. Tiêu chí kiểm thử và nghiệm thu

**API/quyền:** guest 401, USER 403 cho cả hai endpoint; role localStorage không có tác dụng; không trả password/hash/session/bid bí mật; không có đường mutation SYSTEM mới. GET lặp không thay ví/ledger.

**Dữ liệu:** ví hợp lệ số dư 0/history rỗng; thiếu/trùng SYSTEM trả 409; đổi ID SYSTEM vẫn đúng; không lấy ví USER/Admin thay thế; locked_balance khác 0 hiển thị thật; PAYMENT âm hoặc loại khác được thấy trong lịch sử nhưng không cộng tổng nhận dương. SUM vượt Long.MAX_VALUE và Coin >2^53 vẫn chính xác. Không nhầm tổng PAYMENT toàn thời gian với tổng của trang/bộ lọc.

**Bộ lọc/cursor:** auctionId overflow, limit sai, type lạ, ngày không offset, ngày không hợp lệ, from >= to, chỉ một đầu; khoảng ngày bao gồm hết ngày cuối theo timezone; thử timezone có DST. Giao dịch đúng from được lấy, đúng to bị loại. Nhiều dòng cùng timestamp qua nhiều trang không trùng/mất trên dữ liệu cố định. Cursor hỏng/quá dài/khác filter/ví bị từ chối; mọi query vẫn khóa phạm vi SYSTEM bằng điều kiện SQL.

**Thanh toán:** service thật tạo đúng một dòng PAYMENT SYSTEM; gọi settle lặp cùng winner/amount không tăng tổng lần hai; rollback outer transaction không đổi summary/history; UNSOLD chỉ hoàn người chơi, SYSTEM không tăng. Caller cập nhật kết quả/finished_at cùng transaction để fixture phản ánh hợp đồng docs/wallet.md. Kiểm thử đọc khi settlement chưa commit không thấy một nửa kết quả.

**Electron:** render đủ ba số liệu, bộ lọc ngày/mã phiên và loại, giữ URL khi quay lại, tải thêm, khử trùng, loading/empty/offline/retry, response cũ sau đổi filter, 401/403 xóa nội dung, cấu hình SYSTEM lỗi không hiển thị 0; bố cục 820px và ảnh chụp kiểm tra trực quan. Live test dùng session thật và dữ liệu settlement của harness, reload vẫn đúng.

**Môi trường test:** DB_PORT=33308 và REGISTRATION_TEST_DATABASE=true, fixture riêng có prefix; test phá tình huống missing/duplicate SYSTEM chỉ chạy trong DB chuyên dụng, rollback hoặc khôi phục đúng fixture. Không chạy song song các test đổi SYSTEM. Không xóa volume hoặc chạy init.sql lên DB làm việc. Build frontend live với port18080, xong khôi phục build mặc định.

## 8. Điều kiện kết thúc Phase 1 và bàn giao

Hoàn thành khi Admin đọc được đúng ví SYSTEM, số dư/tổng nhận/history/filter hoạt động, thiếu/trùng ví được xử lý rõ, kiểm thử mutation settlement + read API + Electron qua và có docs chạy thử. Báo riêng phạm vi coverage, kết quả test và giới hạn pagination, không tuyên bố toàn bài hết lỗi.

Sau Phase 1: Phase 2 rà soát phần của Tiến và đối soát seed; Phase 3 nối luồng NORMAL/BLIND của nhóm. Khóa/mở tài khoản vẫn là hạng mục chưa chốt, không đưa ngầm vào phase này.

Nguồn khảo sát tại repo: SYSTEM_SPEC.md, database/init.sql, WalletLedger, WalletTransferService, WalletQueryService, WalletResponse/TransactionResponse, WalletTransferIT, WalletPage, adminUsersApi và docs/wallet.md. Không cần nâng dependency hoặc tra cứu web để xác định hợp đồng nghiệp vụ này.
