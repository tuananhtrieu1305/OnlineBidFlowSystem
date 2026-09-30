# Đăng nhập và phiên người dùng

## Chạy tại máy phát triển

Từ thư mục dự án:

```powershell
docker compose up -d --build backend
cd frontend
npm run dev
```

Mở Đăng nhập ở cuối thanh bên. Dùng tài khoản đã đăng ký; tài khoản seed chỉ có khi database đã được khởi tạo theo đặc tả. Không chạy lại init.sql trên database đang sử dụng.

- USER trở về Khám phá, thanh bên hiện tên tài khoản và Đăng xuất.
- ADMIN vào /admin: trang chào quản trị; các chức năng quản lý chưa triển khai.
- Đăng ký thành công có nút sang Đăng nhập, không tự động đăng nhập.
- Tải lại cửa sổ khôi phục phiên từ server. Không có chức năng ghi nhớ đăng nhập lâu dài.
- Danh sách phiên đấu giá chưa được nối API.

## API

| Endpoint | Kết quả |
| --- | --- |
| GET /api/auth/csrf | Token CSRF, tạo phiên vô danh nếu cần |
| POST /api/auth/login | JSON username/password; 200 trả id, username, role |
| GET /api/auth/me | Danh tính phiên hiện tại; 401 nếu chưa đăng nhập |
| POST /api/auth/logout | 204 sau khi hủy phiên |
| GET /api/admin/session | Kiểm tra quyền ADMIN; USER nhận 403 |

Login/logout cần header X-CSRF-TOKEN lấy từ /csrf và cookie phiên. Phải lấy token mới sau login/logout. Lỗi đăng nhập sai tài khoản hoặc mật khẩu dùng chung 401 INVALID_CREDENTIALS; dữ liệu không hợp lệ 400; giới hạn thử 429 kèm Retry-After: 60. Không tự động gửi lại POST đăng nhập.

## Cơ chế bảo vệ

Spring Security xác thực BCrypt, đổi session ID khi đăng nhập, lưu SecurityContext phía server. Cookie OBFSESSION có HttpOnly, Secure, SameSite=None để hỗ trợ origin app://auction của Electron. CORS chỉ cho phép các origin cấu hình; API mới mặc định yêu cầu đăng nhập, /api/admin/** yêu cầu ADMIN.

CSRF dùng token lưu trong session, trả qua JSON. Đăng ký được miễn CSRF vì chỉ tạo tài khoản, không cấp/đổi phiên đăng nhập và chỉ nhận JSON. Đăng nhập và đăng xuất vẫn bắt buộc CSRF.

Không lưu mật khẩu/token trong localStorage hoặc sessionStorage. Phiên hết hạn sau 30 phút không có request đến phiên, hoặc khi server khởi động lại; không chia sẻ session giữa nhiều server. Client kiểm tra phiên khi khởi động, khi cửa sổ lấy lại focus và mỗi phút. Mất mạng không được báo là đăng xuất thành công.

Giới hạn login mặc định 10 lần/phút theo IP và tên tài khoản, bộ nhớ có giới hạn trên một server. Cấu hình app.login.attempts-per-minute. Chưa có Redis hoặc giới hạn phân tán.

HTTP localhost được Chromium coi là ngoại lệ cho Secure cookie và đã kiểm thử bằng Electron. Khi chạy qua IP LAN hoặc tên miền phải dùng HTTPS và cấu hình VITE_API_BASE_URL, FRONTEND_ORIGINS tương ứng; không tắt Secure/webSecurity. Không có thay đổi schema.

## Kiểm thử

Backend: profile registration-it chạy RegistrationIT, LoginIT, LoginLimitIT trên MySQL riêng, bắt buộc REGISTRATION_TEST_DATABASE=true. Xem registration.md để tạo môi trường test.

Frontend regression:

```powershell
cd frontend
npm run test:coverage
npm run test:e2e
```

Test thật với backend test port 18080 (biến DB phải trỏ DB test):

```powershell
$env:VITE_API_BASE_URL='http://localhost:18080'
npm run build
npx playwright test --config playwright.login-live.config.ts
Remove-Item Env:VITE_API_BASE_URL
npm run build
```

Có thể truyền E2E_EXECUTABLE trỏ bản đóng gói đã build với API test. Test tạo tài khoản login_desktop_* chỉ trên database test. Unit coverage hiện đo các helper cấu hình/validation, không đại diện coverage toàn bộ giao diện/backend.

Tham khảo triển khai: [Spring Security — Authentication persistence](https://docs.spring.io/spring-security/reference/6.5/servlet/authentication/persistence.html), [Session management](https://docs.spring.io/spring-security/reference/6.5/servlet/authentication/session-management.html).
