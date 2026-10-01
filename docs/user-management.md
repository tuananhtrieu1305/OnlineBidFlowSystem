# Admin quản lý người dùng

Đăng nhập Admin → Người dùng. Có thể tìm theo username/ID, lọc USER/ADMIN, phân trang và xem tài khoản, ví cá nhân, lịch sử Coin. Bộ lọc được giữ khi quay lại danh sách. Đây là mốc A của [implementation plan](plans/user-management-implementation.md).

## API

| GET endpoint | Nội dung |
| --- | --- |
| `/api/admin/users?q=&role=&page=0&size=20` | Danh sách id/username/role, totalElements dạng chuỗi |
| `/api/admin/users/{id}` | Chi tiết và walletState, wallet |
| `/api/admin/users/{id}/transactions?type=&limit=20&cursor=` | Giao dịch của ví đúng người, nextCursor |

Session ADMIN bắt buộc. Guest 401, USER 403. ID/Coin trả chuỗi; page/size có kiểm tra giới hạn. Không trả password_hash; không cho sửa tài khoản hoặc số dư qua các API này. GET không ghi dữ liệu.

walletState: AVAILABLE (có ví, kể cả số dư 0), MISSING (USER thiếu ví), NOT_APPLICABLE (ADMIN). Gọi history khi không có ví áp dụng trả 409 USER_WALLET_MISSING/WALLET_NOT_APPLICABLE. ID không hợp lệ 400, không tìm thấy 404. Filter/cursor không hợp lệ 400.

Query Admin dùng JdbcTemplate với projection trường rõ ràng; response map explicit để không serialize entity. History tái sử dụng WalletQueryService sau khi tra đúng tài khoản trên server; không thay API ví cá nhân. Không cần tách query chung khi chưa có consumer theo walletId thứ hai. Số dư và lịch sử là các request riêng nên không cam kết snapshot chung trong lúc phát sinh giao dịch.

## Kiểm thử và rà soát 01/10/2026

- 67 backend unit + 35 MySQL integration tests qua; gồm phân quyền ba endpoint, SQL/wildcard input, BIGINT, ví thiếu/0/ADMIN, cursor theo timestamp + ID và không đọc giao dịch của ví khác.
- 34 frontend unit + 22 Electron regression qua; giao diện giữ filter, đọc Coin chính xác >2^53, 403 ẩn chi tiết, USER không tải API Admin và cửa sổ 820px.
- Live Electron: đăng ký fixture → USER đăng nhập/nạp 1250 Coin → đăng xuất → ADMIN đăng nhập/tìm USER → xem đúng số dư/giao dịch → reload. Fixture được dọn khỏi DB kiểm thử.
- JaCoCo package `account.admin`: 100% line, 87,5% branch (35/40). Đây không phải coverage toàn ứng dụng hoặc UI. Build/typecheck qua, npm audit không báo lỗ hổng.

Coverage: profile `admin-users-coverage` cùng `registration-it`, DB kiểm thử riêng. Live test: `playwright.admin-users-live.config.ts`, build frontend với VITE_API_BASE_URL=http://localhost:18080, DB_PORT=33308 và REGISTRATION_TEST_DATABASE=true. Build lại mặc định sau kiểm thử.

## Phần còn lại của Phạm Bá Tiến

1. Màn hình/API quản trị ví SYSTEM: backend settlement nhận Coin đã có, giao diện tra cứu chưa có.
2. Khóa/mở USER là mốc B đề xuất, chưa triển khai; đặc tả cần chốt trước khi bổ sung schema/session policy.
3. Phối hợp NORMAL/BLIND gọi service Coin đúng transaction, chạy luồng bid → kết thúc → thanh toán/hoàn Coin toàn hệ thống.
4. Đối soát dữ liệu mẫu lệch ledger đã ghi trong docs/wallet.md trước khi dùng demo. Không tự sửa seed hay reset database.

Rà soát lần này gồm đọc phân quyền/query mới, kiểm tra transaction ví và product/configuration, cùng regression tự động. Không kết luận ứng dụng hết mọi lỗi. Exactly-once nạp Coin qua mất mạng vẫn là giới hạn schema hiện tại; UI không tự retry. Scheduler/winner thuộc module đấu giá của nhóm. Không đổi các giới hạn đó bằng thao tác quản trị người dùng.
