# Phase 1 — Ví hệ thống

Admin → **Ví hệ thống** (`/admin/system-wallet`) để xem số dư, tổng Coin nhận từ thanh toán, Coin đang khóa và lịch sử. Bộ lọc gồm mã phiên, từ/đến ngày và loại giao dịch; hỗ trợ tải thêm, làm mới và giữ filter trong URL.

## API và cách tính

- `GET /api/admin/system-wallet`: walletId, availableBalance, lockedBalance, totalReceivedCoin, updatedAt, readAt.
- `GET /api/admin/system-wallet/transactions?auctionId=&type=&from=&to=&limit=20&cursor=`: items theo TransactionResponse, nextCursor.

Cả hai yêu cầu session ADMIN (guest401, USER403). Server xác định đúng một SYSTEM wallet, không nhận walletId từ client và không hardcode ID. Thiếu/trùng ví trả409 SYSTEM_WALLET_INVALID; input/cursor sai400. Không có API sửa/nạp/rút ví SYSTEM.

Tổng nhận chỉ cộng available_delta dương của PAYMENT thuộc SYSTEM trên toàn lịch sử, không đổi theo filter bảng và không đồng nhất với số dư. SUM dùng BigDecimal; API trả chuỗi, UI dùng BigInt. Giao dịch loại khác hoặc delta âm vẫn hiện trong lịch sử. Không suy diễn người thanh toán hoặc balance_before/after từ schema hiện tại.

`from` có tính mốc đầu; `to` không tính mốc cuối; yêu cầu ISO8601 có offset/Z, lưu/đọc DATETIME UTC. UI lấy đầu ngày kế tiếp theo lịch địa phương khi chọn Đến ngày, bao gồm ngày DST. `limit` 1–100; auctionId dương trong miền signed long hiện tại; type DEPOSIT/LOCK/UNLOCK/PAYMENT hoặc bỏ trống.

Mỗi endpoint đọc trong transaction REPEATABLE_READ, không khóa ví để ghi. Hai endpoint/các trang không có snapshot chung; giao dịch vừa xuất hiện có thể cần Làm mới. History dùng `(created_at DESC,id DESC)`, cursor bảo toàn microsecond và gắn với filter/ví. Cursor dùng Base64URL các trường phân tách newline thay cho JSON dự kiến; không phải chữ ký hay thông tin cấp quyền. Server luôn áp lại phạm vi ví SYSTEM. Không tự sửa số dư khi gặp dữ liệu khác kỳ vọng.

## Kiểm chứng ngày 02/10/2026

- Full regression backend: 68 unit +39 MySQL IT qua; sau đó thêm 1 unit cursor và 1 MySQL IT đọc đồng thời, chạy lại toàn bộ69 unit +11 IT thuộc SystemWalletIT/WalletTransferIT đều qua.
- Kiểm tra tổng vượt long, khác số dư, filter thời gian, cursor microsecond/khác ví, thiếu/trùng SYSTEM, quyền, rollback, settlement lặp, UNSOLD và không đọc được PAYMENT chưa commit.
- 37 frontend unit qua; coverage helpers đang đo100%, không phải coverage toàn UI. JaCoCo module wallet.admin vượt ngưỡng80% line.
- Phase 1: Electron regression23/24 qua; development bị container frontend cũ chiếm5173. Phase 2 đã xác minh container thuộc dự án, dừng container cũ và chạy lại:25/25 qua, gồm regression phiên đăng nhập mới. Xem `reviews/phase-2-report.md`.
- Live Electron riêng dùng session/API/MySQL thật: số dư đối chiếu DB, đọc lịch sử seed PAYMENT, filter/rỗng/reload và ảnh giao diện qua. Settlement thật và đồng thời được kiểm tra tại MySQL IT, không qua UI điều khiển thanh toán; không có endpoint debug.
- Build/typecheck qua; npm audit không báo lỗ hổng.
- EXPLAIN trên10.000 dòng tạm đã rollback: query lịch sử và thời gian dùng idx_coin_transactions_wallet_created, backward index scan; query theo phiên dùng index FK auction với filesort trên tập nhỏ. Chưa có bằng chứng cần migration index trong Phase1; không suy rộng thành benchmark production.

Chạy MySQL test với REGISTRATION_TEST_DATABASE=true và DB kiểm thử riêng33308. Profile coverage: `registration-it,system-wallet-coverage`. Live test: `playwright.system-wallet-live.config.ts`, frontend build VITE_API_BASE_URL=http://localhost:18080; build lại mặc định sau khi chạy. Không reset volume/schema.

## Phạm vi bàn giao

Chức năng Phase1 đã có API/UI và kiểm thử. Không đổi service thanh toán, xử lý bid, scheduler, hoặc dữ liệu seed làm việc. Các nhánh UI lỗi mạng/response đảo thứ tự đã xử lý bằng abort và trạng thái lỗi, chưa có test riêng cho mọi tổ hợp thời điểm. Phase2 tiếp tục rà soát/đối soát ví mẫu; Phase3 tích hợp NORMAL/BLIND của nhóm.
