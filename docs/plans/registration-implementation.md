# Kế hoạch triển khai đăng ký tài khoản

Trạng thái: Đã triển khai phiên bản đầu. Xem `../registration.md` để biết cách chạy và phạm vi thực tế. Nội dung dưới đây giữ lại thiết kế ban đầu.
Phụ trách: Phạm Bá Tiến.

## 1. Kết quả cần đạt

Người dùng đăng ký từ ứng dụng Electron. Server tạo đúng một tài khoản USER và một ví USER có số dư 0, sau đó giao diện thông báo thành công. Không tự đăng nhập.

Phạm vi gồm API, validation, băm mật khẩu, transaction tạo tài khoản/ví, form React và kiểm thử MySQL/Electron. Chưa gồm đăng nhập, session/JWT, quên mật khẩu, OTP, email, nạp Coin hoặc quản trị người dùng.

## 2. Hiện trạng đã kiểm tra

- `database/init.sql`: users có id, username VARCHAR(50), password_hash VARCHAR(255), role USER/ADMIN; username có unique constraint `uk_users_username`.
- Username sử dụng collation utf8mb4_unicode_ci, so sánh không phân biệt hoa/thường.
- wallets có user_id unique, wallet_type, available_balance, locked_balance và updated_at bắt buộc.
- Seed hiện có tài khoản và ví SYSTEM; không tạo lại hay sửa seed khi thêm đăng ký.
- Chưa có entity/repository/service cho account hoặc wallet. Backend có Web, JPA, Validation và Test; chưa có Spring Security.
- Frontend có React TypeScript, axios và hash router; chưa có auth feature.
- `init.sql` có DROP TABLE: tuyệt đối không chạy lại trên database người dùng để triển khai chức năng này.
- Không cần thay đổi schema. Không tự thêm email, displayName hoặc trạng thái tài khoản.

## 3. Quy tắc đề xuất cho phiên bản đầu

| Trường | Quy tắc |
| --- | --- |
| username | Trim, chuyển lowercase bằng Locale.ROOT, dài 3–50, chỉ a-z, 0-9, dấu chấm, gạch dưới và gạch ngang |
| password | Tối thiểu 12 ký tự, tối đa 72 byte UTF-8 nếu dùng BCrypt; cho phép khoảng trắng và Unicode; không trim, không đổi hoa/thường |
| confirmPassword | Chỉ dùng tại giao diện, phải khớp password; không gửi API hoặc lưu DB |
| role | Server gán USER; không lấy từ request |
| ví | USER, user_id của tài khoản vừa tạo, hai số dư bằng 0, updated_at lấy từ server |

Đây là quy tắc triển khai được đề xuất, không phải quy tắc đã có trong SYSTEM_SPEC. Chính sách chuẩn hóa username phải được dùng lại khi triển khai đăng nhập. Seed cũ không bị chuẩn hóa lại trong task này.

Không tạo coin_transactions khi tạo ví 0 Coin vì chưa phát sinh biến động số dư. Không tạo ví SYSTEM trong luồng đăng ký.

## 4. Luồng xử lý

```text
Form đăng ký
→ Kiểm tra dữ liệu cơ bản ở frontend
→ POST /api/auth/register
→ Server kiểm tra JSON, chuẩn hóa username, kiểm tra chính sách password
→ Kiểm tra username đã tồn tại (thông báo sớm)
→ Băm password bên ngoài transaction ghi để giảm thời gian giữ transaction
→ RegistrationService.createAccountWithWallet(...) mở transaction
    → INSERT users với role USER
    → WalletService.createUserWallet(user) với propagation REQUIRED
    → Flush để phát hiện lỗi constraint
→ Commit cả tài khoản và ví
→ HTTP 201 và DTO an toàn
→ Xóa các ô mật khẩu, hiện trạng thái đăng ký thành công
```

Phương thức transaction nằm trên bean riêng và được gọi qua Spring proxy, không dựa vào self-invocation. Tạo ví thất bại phải rollback tài khoản. Không dùng REQUIRES_NEW cho tạo ví.

Kiểm tra exists không thay thế unique constraint. Hai request đồng thời cùng username: một request thành công, request còn lại nhận 409, chỉ có một user và một ví.

Lỗi unique username được ánh xạ sau khi transaction rollback. Không biến mọi DataIntegrityViolationException thành lỗi trùng username; các lỗi ví hoặc constraint khác phải giữ đúng loại lỗi và không lộ SQL.

## 5. Hợp đồng API

`POST /api/auth/register`, Content-Type: application/json, không yêu cầu đăng nhập.

Request:

```json
{"username":"batien","password":"example-password"}
```

Response 201:

```json
{"id":12,"username":"batien","role":"USER"}
```

| HTTP | code | Ý nghĩa |
| --- | --- | --- |
| 400 | VALIDATION_ERROR | Thiếu/sai trường, JSON sai hoặc chứa trường ngoài hợp đồng |
| 409 | USERNAME_TAKEN | Tên đăng nhập đã tồn tại |
| 429 | TOO_MANY_REQUESTS | Vượt giới hạn đăng ký |
| 500 | INTERNAL_ERROR | Lỗi hệ thống; dữ liệu trong transaction đã rollback |

Định dạng lỗi: `{ "code": "VALIDATION_ERROR", "message": "Dữ liệu chưa hợp lệ", "fieldErrors": { "username": "Tên đăng nhập không hợp lệ" } }`.

Từ chối trường ngoài hợp đồng như role, userId, balance ở riêng endpoint đăng ký, tránh đổi hành vi JSON toàn ứng dụng. Không nhận entity làm request và không trả entity làm response. Không echo mật khẩu/rejectedValue trong lỗi.

## 6. Thành phần và file dự kiến

Backend, dưới `com.group6.auction`:

```text
account/controller/AuthController.java
account/service/RegistrationService.java
account/repository/UserRepository.java
account/entity/User.java
account/entity/UserRole.java
account/dto/RegisterRequest.java
account/dto/UserResponse.java
account/validation/RegistrationValidator.java
wallet/service/WalletService.java
wallet/repository/WalletRepository.java
wallet/entity/Wallet.java
wallet/entity/WalletType.java
security/PasswordConfig.java
common/exception/GlobalExceptionHandler.java
common/dto/ApiError.java
```

Controller điều phối validation/băm rồi gọi service transactional, không chứa thao tác JPA. Có thể tách facade khi cần, không tạo interface/Impl chỉ để tăng số lớp.

- Thêm `spring-security-crypto` để dùng PasswordEncoder/BCrypt trong phạm vi đăng ký; cấu hình đầy đủ security filter chain ở task đăng nhập. Không vô tình kích hoạt default login rồi làm hỏng health/WebSocket.
- Dùng BCrypt với work factor khởi điểm 12, đo thời gian thực tế trước khi chốt. Kiểm tra tương thích hash seed cho task đăng nhập sau.
- Giữ `ddl-auto: none`; ánh xạ đúng bảng/enum hiện tại, không để Hibernate tự sửa schema.
- Id và Coin trong Java dùng Long với giới hạn miền phù hợp; chỉ tạo số dư 0 trong task này.
- Giới hạn tần suất endpoint công khai trước bước băm: đề xuất 5 yêu cầu/phút/IP, cấu hình được; bộ đếm trong bộ nhớ có TTL và giới hạn kích thước. Dùng remote address khi không có trusted proxy, không tin tùy ý X-Forwarded-For. Ngưỡng này cần cân nhắc khi demo nhiều client chung IP.
- Không log request body chứa password, không log hash. Demo HTTP chỉ trong môi trường local/LAN tin cậy; triển khai công khai cần HTTPS.

Frontend:

```text
src/features/auth/pages/RegisterPage.tsx
src/features/auth/components/RegisterForm.tsx
src/features/auth/api/authApi.ts
src/features/auth/types.ts
src/features/auth/validation.ts
src/router/index.tsx                     # Thêm route /register
src/pages/HomePage.tsx                   # Thêm điểm vào đăng ký
```

Tận dụng axiosClient và server config hiện có. Không tái cấu trúc toàn bộ frontend chỉ để thêm một feature.

## 7. Trải nghiệm giao diện

- Ba trường có label rõ ràng: tên đăng nhập, mật khẩu, xác nhận mật khẩu.
- Có hiện/ẩn mật khẩu, mô tả quy tắc và thông báo lỗi dưới trường tương ứng.
- Trạng thái idle → submitting → success hoặc error; vô hiệu nút gửi khi đang chờ, không gửi hai request cho một lần submit.
- Khi lỗi, giữ username; không ghi password vào storage, URL hoặc log.
- Khi thành công, xóa password/confirmPassword. Hiện thông báo tài khoản và ví đã tạo.
- Chỉ chuyển sang /login khi route đăng nhập đã được triển khai; trong task đăng ký độc lập, dùng màn hình thành công và nút về trang chủ, không tạo liên kết hỏng.
- Timeout/mất mạng không được khẳng định tài khoản chưa được tạo; hướng dẫn kiểm tra hoặc thử đăng nhập khi chức năng có sẵn. Không tự retry POST đăng ký.
- Frontend validation phục vụ trải nghiệm; backend là nơi quyết định dữ liệu hợp lệ.
- Chưa thêm AuthProvider, ProtectedRoute, cookie/session/JWT vào task này.

## 8. Thứ tự triển khai và kiểm thử

### Bước 1 — Hợp đồng và test backend trước

- Chốt DTO, quy tắc validation và error codes trong kế hoạch này.
- Thêm test đăng ký và test tạo ví nguyên tử; chạy để xác nhận thất bại vì thiếu chức năng.
- Dùng MySQL test riêng (ưu tiên Testcontainers MySQL 8.4), không dùng database auction_db đang chạy và không dùng H2 thay thế cho kiểm thử collation/constraint.

### Bước 2 — Backend hoàn chỉnh

- Entity/repository cho users/wallets.
- Validation và PasswordEncoder.
- Transaction tạo USER và ví, phân loại lỗi constraint.
- Endpoint và giới hạn tần suất; giữ health/WebSocket tests hoạt động.

### Bước 3 — Giao diện

- Tạo form, nối API, thêm route và điểm vào.
- Xử lý 400/409/429/500, timeout và trạng thái gửi.
- Kiểm tra TypeScript và accessibility cơ bản bằng keyboard/label/focus lỗi.

### Bước 4 — Kiểm thử tích hợp desktop

- Test Electron gọi Spring Boot thật và MySQL test thật, kiểm tra tài khoản/ví đã lưu.
- Chạy cả chế độ Vite và bản đóng gói dùng app://auction để kiểm tra CORS POST.
- Bổ sung launcher test có DB riêng: launcher E2E hiện tại tắt datasource chỉ phù hợp health, không dùng cho đăng ký.
- Khi xuất hiện JPA repository, điều chỉnh health-only test context để không quét repository không có EntityManager; không bỏ các test health hiện có.

### Bước 5 — Bàn giao

- Cập nhật tài liệu API/cách chạy test và ghi rõ dependency Docker cho test MySQL.
- Chạy backend verify, typecheck, unit/component tests, E2E, production build, npm audit và review diff.
- Ghi lại kết quả thực tế; không báo đã kiểm chứng các bước bị thiếu môi trường.

## 9. Test cases bắt buộc

| Nhóm | Kịch bản |
| --- | --- |
| Thành công | 201, USER, đúng một ví 0/0, updated_at có giá trị |
| Mật khẩu | Hash khác plaintext, matches đúng, hai tài khoản cùng password có hash khác nhau |
| Validation | Null/rỗng, username sai ký tự/quá dài, password ngắn/quá giới hạn byte, Unicode ở ranh giới, JSON lỗi |
| Phân quyền dữ liệu | role=ADMIN, balance hoặc userId thêm vào request bị từ chối |
| Trùng tài khoản | Username có sẵn; khác hoa/thường hoặc khoảng trắng biên sau chuẩn hóa |
| Đồng thời | Hai đăng ký cùng username: đúng một 201 và một 409, một user và một ví |
| Rollback | Cố ý làm tạo ví lỗi trong test: không còn user vừa tạo; không sửa dữ liệu người khác |
| Riêng tư | Response/lỗi không chứa password, hash, SQL hoặc stack trace |
| Rate limit | Vượt ngưỡng trả 429; hết thời hạn cho thử lại; không làm đầy bộ nhớ bộ đếm |
| Giao diện | Confirm không khớp, gửi trùng, trùng username, mạng lỗi, thành công, không lưu password |
| Regression | REST health và WebSocket vẫn hoạt động; đăng ký hoạt động dev và packaged Electron |

Không thêm bảng giao dịch Coin hoặc migration chỉ để hỗ trợ đăng ký. Không thay đổi nghiệp vụ NORMAL/BLIND.

## 10. Definition of Done

- Các test cases trên đạt và có bằng chứng chạy trên MySQL riêng.
- Đăng ký tạo tài khoản và ví nguyên tử, không tự cấp ADMIN hoặc Coin.
- Form chạy được trên Electron dev và bản Windows đóng gói.
- Không reset database hiện có; không commit .env, mật khẩu thực hoặc dữ liệu test phát sinh.
- Không có đường dẫn đăng nhập giả/hỏng; điểm tích hợp đăng nhập tiếp theo được ghi rõ.
- Tài liệu mô tả đúng phần đã triển khai và những gì còn ngoài phạm vi.
