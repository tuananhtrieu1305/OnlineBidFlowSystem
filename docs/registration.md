# Đăng ký tài khoản

## Chạy thử

1. Tại thư mục gốc chạy `docker compose up -d --build backend` để cập nhật API; giữ nguyên volume MySQL.
2. Trong `frontend/`, chạy `npm ci`, `npm run dev`.
3. Bấm **Tạo tài khoản** ở trang chủ hoặc mở route `#/register`.

Form có username, password, confirm password; không yêu cầu email hoặc thay đổi schema.
Username chuẩn hóa lowercase/trim, 3–50 ký tự a-z, số, `.`, `_`, `-`.
Password tối thiểu 12 Unicode code points, tối đa 72 byte UTF-8, không trim.
Đăng ký thành công tạo role USER và ví USER 0/0 trong cùng transaction. Chưa đăng nhập tự động.
Giao diện đăng nhập chưa triển khai; màn hình thành công có nút về trang chủ.

## Thiết kế

- Nền #F6F5F1, brand #145C53, chữ #202824, lỗi #B83A35, viền #E1E5DF.
- Be Vietnam Pro 400/500/600 được đóng gói local, không tải font từ mạng khi sử dụng.
- Minh họa vector bộ sưu tập đĩa than, form riêng, góc bo 8/12px.
- Có keyboard focus, label, hiện/ẩn mật khẩu, lỗi cạnh trường, trạng thái gửi và success.
- Màn hình hẹp vẫn có thể cuộn; không tràn ngang. Không tạo link đăng nhập giả.

## API

`POST /api/auth/register`, JSON `{ "username": "batien", "password": "a-long-passphrase" }`.

- 201: `{ "id": 12, "username": "batien", "role": "USER" }`.
- 400 VALIDATION_ERROR: dữ liệu sai, JSON lỗi, trường thừa như role/balance.
- 409 USERNAME_TAKEN: trùng tên, kể cả khác hoa/thường.
- 429 TOO_MANY_REQUESTS: mặc định 5 lần/IP/phút; header Retry-After 60 giây. Điều chỉnh bằng `app.registration.attempts-per-minute`.
- 500 INTERNAL_ERROR: lỗi lưu; không trả SQL, hash hoặc stack trace.

Băm BCrypt cost 12, unique constraint là bảo vệ cuối cùng khi đăng ký đồng thời. WalletService tham gia transaction của RegistrationService, không tạo transaction riêng.
Không sinh coin_transactions cho ví 0 Coin, không thay đổi ví SYSTEM.
Rate limiter trong bộ nhớ chỉ dành cho kiến trúc một server, tối đa 10.000 IP; không tin X-Forwarded-For từ client.
Không triển khai session/JWT trong chức năng này. Không tắt webSecurity hoặc mở CORS wildcard.

## Kiểm thử

`mvn verify` chạy unit tests và connectivity tests không cần DB. Profile `probe` chỉ để chạy các kiểm tra kết nối, không có API đăng ký.
`npm run test:coverage` kiểm tra các module validation/URL/asset-path; coverage không đại diện cho toàn bộ UI.
`npm run build` rồi `npx playwright test --config playwright.registration.config.ts` kiểm tra UI Electron với response được mô phỏng.

### MySQL integration tests

Luôn tạo container DB riêng, không dùng database làm việc. Ví dụ tại thư mục gốc (mật khẩu dưới đây chỉ dành cho test):

```powershell
docker run -d --name onlinebidflow-registration-test -e MYSQL_ROOT_PASSWORD=registration_test_only -p 127.0.0.1:33308:3306 mysql:8.4.4
# Chờ MySQL khởi động xong, rồi nạp schema chỉ vào container test này.
docker cp database/init.sql onlinebidflow-registration-test:/tmp/init.sql
docker exec onlinebidflow-registration-test sh -c 'MYSQL_PWD=registration_test_only mysql -uroot < /tmp/init.sql'
$env:DB_HOST='127.0.0.1'
$env:DB_PORT='33308'
$env:DB_NAME='auction_db'
$env:DB_USERNAME='root'
$env:DB_PASSWORD='registration_test_only'
$env:REGISTRATION_TEST_DATABASE='true'
cd backend
mvn -Pregistration-it verify
```

Integration tests kiểm tra persistence/hash/ví 0, JSON, injection, trùng tên, concurrency và rollback. Cờ REGISTRATION_TEST_DATABASE là xác nhận môi trường test, không tự tạo database.

### Electron kết nối API thật

Giữ các biến DB test ở trên. Cổng 18080 cần trống. Trong `frontend/`:

```powershell
$env:VITE_API_BASE_URL='http://localhost:18080'
npm run build
npx playwright test --config playwright.registration-live.config.ts
```

Test tự chạy JAR Spring Boot với DB test trên cổng 18080, tạo tài khoản có prefix desktop_ rồi kiểm tra đăng ký trùng.
Để kiểm tra executable đóng gói, build bằng cùng biến API test, đặt `E2E_EXECUTABLE` tới executable rồi chạy lại lệnh test trên.
Sau test, bỏ VITE_API_BASE_URL và E2E_EXECUTABLE khỏi môi trường, build lại để trở về server mặc định. Không phân phối bộ cài cấu hình cổng test.
Container test là môi trường dùng một lần; dừng/xóa đúng container test khi không cần nữa.

## Ranh giới tiếp theo

Tài khoản mới đã có hash tương thích PasswordEncoder để triển khai đăng nhập. AuthProvider, phiên đăng nhập, phân quyền API nghiệp vụ và ví/nạp Coin là các task tiếp theo.
