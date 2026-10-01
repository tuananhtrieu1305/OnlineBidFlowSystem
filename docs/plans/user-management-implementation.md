# Implementation plan — Admin quản lý người dùng

Ngày: 01/10/2026. Phụ trách: Phạm Bá Tiến. Trạng thái: mốc A đã triển khai; mốc B chưa triển khai. Kết quả kiểm thử và giới hạn: [user-management.md](../user-management.md).

## 1. Mục tiêu và phạm vi

Admin tìm và kiểm tra tài khoản người dùng, xem ví và lịch sử Coin để hỗ trợ vận hành. Giữ giao diện trắng ngà #F6F5F1, xanh cổ vịt #145C53, Be Vietnam Pro như sản phẩm/phiên.

Chia làm hai mốc độc lập:

- **A — triển khai tiếp theo:** danh sách, bộ lọc, chi tiết tài khoản, số dư và lịch sử giao dịch cá nhân dưới quyền Admin. Không đổi schema.
- **B — mở rộng đề xuất:** khóa/mở tài khoản USER, ghi lịch sử thao tác, vô hiệu hóa quyền sử dụng session/socket. Cần bổ sung schema và chốt quy tắc với nhóm trước khi triển khai mốc B; không coi việc xem danh sách là đã hoàn thành chức năng khóa.

Đặc tả hiện có ghi “Admin quản lý người dùng” nhưng chưa quy định rõ khóa tài khoản. Plan này không tự bổ sung chức năng đổi role, cấp tài khoản Admin, xóa tài khoản, sửa username/mật khẩu, sửa trực tiếp số dư hoặc hủy bid. Màn hình ví SYSTEM là mốc riêng sau quản lý người dùng.

## 2. Hiện trạng đã kiểm tra

- `users` chỉ có id, username, password_hash, role; không có status, created_at hoặc last_login. Không hiển thị ngày đăng ký/đăng nhập giả định.
- Đăng ký tạo USER và ví trong cùng transaction. `/api/admin/**` đã yêu cầu ADMIN; `/api/wallet/**` chỉ cho USER đọc ví chính mình.
- `WalletQueryService` đang tra ví theo username, lịch sử theo created_at DESC, id DESC với cursor. Không mở API cá nhân để nhận userId tùy ý.
- `AdminPage` hiện có lối vào sản phẩm; chưa có quản lý người dùng.
- Login lưu SecurityContext trong HttpSession. Socket có kiểm tra session lease, đóng khi logout/đổi session ID; chưa có trạng thái khóa tài khoản để kiểm tra.
- `database/init.sql` chứa DROP TABLE; tuyệt đối không dùng làm migration trên DB đang có dữ liệu.

## 3. Luồng và giao diện mốc A

`Admin đăng nhập → Người dùng → tìm/lọc → chi tiết → xem ví/lọc giao dịch → quay lại danh sách`.

**Danh sách `/admin/users`:** tiêu đề Người dùng; tìm theo username hoặc ID; lọc USER/ADMIN; bảng gồm mã, username, vai trò và liên kết chi tiết. Phân trang 20 dòng, giữ query/filter/page trên URL khi đi chi tiết rồi quay lại. Tìm kiếm debounce 300ms, hủy request cũ; không để response cũ ghi đè bộ lọc mới.

**Chi tiết `/admin/users/:id`:** thông tin tài khoản trước, tiếp theo là Coin khả dụng/Coin đang khóa, bảng giao dịch (thời gian, loại, thay đổi khả dụng/đang khóa, mã phiên). Không hiển thị bid bí mật hoặc mã phòng từ trang người dùng. Link phiên chỉ dẫn đến trang Admin đã bảo vệ quyền.

Ví cá nhân chỉ áp dụng USER. Với ADMIN: “Tài khoản quản trị không dùng ví cá nhân”. USER thiếu ví: thông báo thiếu dữ liệu cần kiểm tra, không hiển thị số dư 0 hoặc tự tạo ví khi GET. Nếu dữ liệu cũ có ví gắn ADMIN, không đồng nhất ví đó với ví SYSTEM; xử lý riêng khi đối soát.

Đủ trạng thái loading, rỗng, không tìm thấy, lỗi kết nối và thử lại; 401 đưa về login, 403 ẩn dữ liệu. Cửa sổ 820px không tràn toàn trang; bảng có vùng cuộn riêng. Tiền dùng BigInt/chuỗi và định dạng vi-VN. Không có nút thay đổi số dư trong trang này.

## 4. Hợp đồng API mốc A

| Method | Endpoint | Kết quả |
| --- | --- | --- |
| GET | `/api/admin/users?q=&role=&page=0&size=20` | items, page, size, totalElements, totalPages |
| GET | `/api/admin/users/{id}` | id, username, role, walletState, wallet |
| GET | `/api/admin/users/{id}/transactions?type=&limit=20&cursor=` | items, nextCursor |

List item chỉ có id, username, role. Detail walletState là AVAILABLE / MISSING / NOT_APPLICABLE; wallet null trừ AVAILABLE. Wallet chứa walletId, availableBalance, lockedBalance, updatedAt. Không trả User entity, password_hash, cookie, token, session ID hoặc thông tin đăng nhập khác. Tất cả ID/Coin/count có thể vượt JS safe integer trả chuỗi; page/size/totalPages giữ số trong giới hạn đã kiểm tra.

- q trim, tối đa 50 ký tự; tìm username chứa chuỗi hoặc ID khớp chính xác khi là số hợp lệ. Escape `%`, `_`, ký tự escape; bind toàn bộ giá trị SQL.
- role chỉ USER/ADMIN; rỗng tương đương không lọc. page >= 0, size 1–100, kiểm tra overflow offset. Sắp xếp cố định id DESC.
- id nguyên dương trong miền long hiện tại; limit 1–100; type chỉ DEPOSIT/LOCK/UNLOCK/PAYMENT; cursor có giới hạn độ dài và validation thời gian/ID.
- History luôn lọc wallet_id được server tra từ userId của URL. Cursor chỉ là vị trí, không quyết định wallet hay quyền. Chuyển người dùng/loại giao dịch phải reset cursor; ghép trang chống trùng ID.
- Guest 401, USER 403 kể cả tự xem URL của chính mình, Admin mục tiêu không tồn tại 404 USER_NOT_FOUND; lịch sử của ADMIN trả 409 WALLET_NOT_APPLICABLE; USER thiếu ví trả 409 USER_WALLET_MISSING. Input lỗi 400. Truy vấn không có kết quả trả danh sách rỗng.

## 5. Cấu trúc triển khai

```text
backend/src/main/java/com/group6/auction/account/admin/
  AdminUserController.java
  AdminUserQueryService.java
  AdminUserSummary.java
  AdminUserDetail.java
  AdminUserPage.java
  AdminUserException.java
  AdminUserExceptionHandler.java
backend/src/main/java/com/group6/auction/wallet/service/
  WalletHistoryQuery.java                 # tách query lịch sử dùng chung nếu cần
frontend/src/features/admin/users/
  AdminUsersPage.tsx
  AdminUserDetailPage.tsx
  UserWalletPanel.tsx
  adminUsersApi.ts
  users.css
backend/src/test/java/com/group6/auction/account/admin/
  AdminUserQueryTest.java
  AdminUserIT.java
frontend/e2e/
  admin-users.spec.ts
  admin-users-live.spec.ts
docs/user-management.md
```

Dùng Controller → QueryService → JdbcTemplate/DTO cho màn hình đọc, phù hợp query ví hiện tại; SQL chỉ chọn trường cần thiết. Danh sách dùng count + một query phân trang, không truy vấn từng user. Detail dùng LEFT JOIN có điều kiện ví USER, không làm tài khoản thiếu ví biến mất. Không tạo entity/repository mới cho ledger.

Nếu tách `WalletHistoryQuery`, service cá nhân vẫn xác minh owner theo session, service Admin vẫn xác minh target/quyền qua endpoint rồi mới gọi query chung. Chỉ tái sử dụng truy vấn/DTO, không tái sử dụng endpoint cá nhân hoặc gọi controller lẫn nhau. GET dùng readOnly transaction; số dư và lịch sử ở hai request có thể cập nhật giữa lúc đọc, không quảng cáo đây là snapshot nguyên tử chung.

Sửa AppLayout/router thêm Người dùng cho ADMIN và AdminPage thêm lối vào các phần đã có. Không thêm thư viện UI/state mới cho mốc này.

## 6. Mốc B — khóa/mở USER (thiết kế dự kiến)

Trước khi làm cần nhóm xác nhận quyền khóa, xử lý người đang đấu giá và đồng ý migration bổ sung. Đề xuất chốt:

- Chỉ khóa/mở USER; không tự khóa mình hoặc khóa ADMIN. Không đổi role ở mốc này.
- Khóa ngăn đăng nhập và thao tác mới; không xóa participant/bid/chat, không tự hoàn Coin. Bid cũ vẫn có hiệu lực và được settlement theo luật phiên; Admin cần thấy cảnh báo này trước khi khóa.
- Mở khóa cho phép đăng nhập mới, không khôi phục session cũ.
- Migration cộng thêm `users.account_status` mặc định ACTIVE, `users.auth_version` mặc định 0 và bảng `account_status_audit` (actor, target, before/after, reason, auth_version, created_at UTC). Lập script migration riêng và kiểm tra trên bản sao DB; không reset init.sql/volume, không tự sửa ledger cũ. Trước khi quyết định công cụ migration, kiểm tra cơ chế triển khai hiện có của nhóm.
- API dự kiến `PATCH /api/admin/users/{id}/status`, body `{status, reason}`, If-Match từ version; CSRF bắt buộc. Lý do trim 5–500 ký tự, enum allowlist, chống mass assignment. Khóa user row, kiểm tra target/ETag, đổi status + tăng version + audit trong một transaction. Stale 412, thiếu version 428; cùng trạng thái và cùng version trả no-op, không audit lặp.
- Login kiểm tra ACTIVE và ghi auth_version vào session. Mỗi request đã đăng nhập kiểm tra status/version so với DB; mismatch vô hiệu session và trả 401 với thông báo yêu cầu đăng nhập lại. Login bị khóa dùng lỗi xác thực chung để không tiết lộ tài khoản.
- Socket handshake, inbound/outbound và cleanup kiểm tra quyền tài khoản bên cạnh session lease. Sau commit gửi sự kiện nội bộ đóng tất cả socket của target; nếu sự kiện đóng thất bại, kiểm tra trạng thái/version vẫn chặn dữ liệu và thao tác tiếp. Không chỉ đóng socket rồi bỏ qua HTTP session còn sống.
- Login đồng thời với khóa phải bị chặn bằng version recheck; version mới không bao giờ được gán cho authentication tạo trước lần khóa. Kiểm tra này cần test race cụ thể.
- Request đã bắt đầu trước khi khóa có thể hoàn tất. Nếu yêu cầu “không bid nào được commit sau khóa” thì phải phối hợp module NORMAL/BLIND, khóa/check account trong transaction mutation và thống nhất thứ tự khóa với auction/wallet; không hứa bảo đảm này chỉ bằng HTTP filter.
- Cấu hình một server trung tâm hiện tại; nếu scale nhiều instance, phần đóng session/socket phải có cơ chế chia sẻ, không dựa riêng event bộ nhớ.

Các file security/realtime dùng chung chỉ sửa trong mốc B, kèm regression. Kiểm tra lỗi DB không được cho phép tài khoản đi qua kiểm tra trạng thái.

## 7. Thứ tự thực hiện mốc A

1. Viết test RED contract/quyền/input/thiếu ví; lưu checkpoint theo workflow dự án.
2. Backend list/detail/history, query DTO và lỗi; MySQL integration trên DB riêng.
3. Giao diện danh sách/chi tiết/ví, navigation, trạng thái lỗi và bộ lọc URL.
4. Electron E2E với mock cho trạng thái biên và live backend cho login Admin → tìm USER → ví/lịch sử → reload; dữ liệu test tự tạo, cleanup đúng fixture.
5. Regression login/session, API ví USER, nạp Coin, Admin sản phẩm/phiên và realtime; build/typecheck, npm audit, diff review, docs và checkpoint GREEN. Không tự push.

## 8. Tiêu chí nghiệm thu

Mốc A:

- Guest/USER không đọc được bất kỳ endpoint Admin mới nào; giả role ở frontend không có tác dụng.
- Không rò password_hash trong response/log lỗi. USER API cũ vẫn chỉ đọc ví của chính mình.
- Tìm kiếm/lọc/phân trang đúng; thử ký tự SQL/wildcard, ID quá lớn, cursor hỏng, role lạ và tham số vượt giới hạn.
- Đọc đúng người/đúng ví; phân biệt số dư 0, thiếu ví và không áp dụng ví. Cursor của người khác không đọc được giao dịch người đó.
- Coin lớn hơn 2^53 hiển thị chính xác. Lịch sử cùng timestamp phân trang theo ID không mất bản ghi trong tập dữ liệu cố định.
- Response tìm kiếm cũ không ghi đè query mới; back giữ filter; 401/403 xóa nội dung bảo vệ; lỗi mạng có retry.
- API GET không thay user/wallet/ledger; không tự sửa chênh lệch dữ liệu seed.
- Coverage phần mới được đo tối thiểu 80%, ghi rõ phạm vi; test MySQL và Electron live thành công. Không đánh đồng coverage helper với toàn ứng dụng.

Mốc B bổ sung: session nhiều thiết bị; socket đang mở; khóa khi đang login; mở khóa không hồi sinh session; hai Admin cùng sửa; audit rollback khi lỗi; thiếu CSRF; USER gọi PATCH; target ADMIN; phiên đấu giá/giữ Coin còn hiệu lực; migration giữ nguyên dữ liệu cũ. Chỉ đánh dấu B hoàn tất sau các kiểm tra này.

## 9. Bàn giao

Tạo `docs/user-management.md` ghi contract API, ví không áp dụng/thiếu ví, giới hạn quyền và hướng dẫn chạy. Khi hoàn thành A, báo rõ “đã xem/quản lý thông tin, chưa khóa/mở”. Sau đó triển khai B nếu nhóm chọn chức năng khóa, rồi màn hình ví SYSTEM. Không chuyển nghiệp vụ winner, bid hay socket runtime sang trách nhiệm của module Admin.

Nguồn đối chiếu: SYSTEM_SPEC.md, database/init.sql, SecurityConfig, LoginController, User/RegistrationService, WalletQueryService, SessionRealtimeAuthService, SocketSessionLease, RealtimeSessionRegistry, RealtimeSessionLifecycle, AdminPage và docs/wallet.md.
