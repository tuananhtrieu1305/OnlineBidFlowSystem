# OnlineBidFlow Desktop

Base desktop cho bài tập lớn hệ thống đấu giá online thời gian thực.

## Công nghệ và phạm vi

- Desktop: Electron, React 18, TypeScript, Vite, Tailwind CSS.
- Server: Java 21, Spring Boot 3.3.5, REST API, WebSocket, Spring Data JPA.
- Database: MySQL 8.4, schema và dữ liệu mẫu trong `database/init.sql`.
- Build: Maven, npm, electron-builder (Windows x64 / NSIS).

```text
Electron / React ── HTTP + WebSocket ── Spring Boot ── MySQL
```

Base có cửa sổ desktop, điều hướng, kiểm tra REST/WebSocket, cấu hình LAN và đóng gói Windows.
Chưa triển khai đăng nhập, đấu giá, ví, phòng, chat, reconnect nghiệp vụ, replay hoặc leaderboard.
`/ws/health` chỉ là kiểm tra kết nối PING/PONG, chưa phải kênh sự kiện đấu giá.
Đọc `SYSTEM_SPEC.md` trước khi phát triển nghiệp vụ; schema và các quy tắc NORMAL/BLIND không thay đổi.

## Cấu trúc

```text
frontend/
  electron/             # Main process, sandboxed preload, local asset protocol
  src/                  # React + TypeScript + Tailwind
  scripts/              # Development, build và E2E backend launcher
  tests/                # Kiểm tra URL server và đường dẫn tài nguyên desktop
  e2e/                  # Kiểm tra Electron với Spring Boot thực
  electron-builder.yml  # Windows installer
backend/                # Spring Boot / Maven
database/               # MySQL schema, seed
docker-compose.yml      # Chỉ backend + MySQL; desktop chạy trên máy người dùng
```

## Yêu cầu

- Node.js **22.12+** (khuyến nghị Node 22 LTS), npm.
- Docker Desktop đang chạy để dùng backend + MySQL qua Compose.
- JDK **21** và Maven **3.9.x** nếu chạy hoặc kiểm tra backend ngoài Docker.
- Windows để tạo và kiểm tra bộ cài Windows; cấu hình đóng gói hiện chỉ nhắm Windows x64.

## Chạy phát triển

Tại thư mục gốc, tạo `.env` từ `.env.example` nếu chưa có:

```powershell
Copy-Item .env.example .env
docker compose up -d --build
```

Không ghi đè `.env` đã cấu hình. Nếu cổng MySQL 3306 đã được sử dụng, đặt `MYSQL_HOST_PORT=3307` trong `.env`.
Backend trong Docker vẫn dùng `mysql:3306`. Mật khẩu mẫu chỉ dành cho môi trường phát triển.

Mở terminal khác:

```powershell
cd frontend
Copy-Item .env.example .env
npm ci
npm run dev
```

Lệnh này build main/preload, chạy Vite ở `http://localhost:5173`, rồi mở Electron.
React hỗ trợ hot reload; khi sửa `electron/`, dừng và chạy lại `npm run dev`.
Đóng ứng dụng hoặc nhấn Ctrl+C để dừng launcher và Vite.
Chọn **Connection test**: REST API và WebSocket đều phải hiện **Connected**.

`npm run dev:web` là chế độ xem thử giao diện bằng trình duyệt, không phải ứng dụng desktop chính.
Nếu chuyển từ base web cũ và còn container `auction_frontend`, có thể dùng `docker compose up -d --build --remove-orphans` để dọn container frontend cũ của cùng project.

## Cấu hình server / LAN

Hai file cấu hình có nhiệm vụ khác nhau:

| File | Nội dung |
| --- | --- |
| `.env` tại gốc | MySQL, thông tin kết nối database của backend, `FRONTEND_ORIGINS` |
| `frontend/.env` | `VITE_API_BASE_URL`, địa chỉ server mà desktop sẽ kết nối |

Ví dụ máy server có IP `192.168.1.10`, trên máy build/chạy desktop đặt:

```dotenv
VITE_API_BASE_URL=http://192.168.1.10:8080
```

Giá trị phải là HTTP(S) origin, không kèm `/api`, tài khoản, query hoặc fragment.
URL WebSocket được suy ra tự động: HTTP → WS, HTTPS → WSS, đường dẫn `/ws/health`.
Địa chỉ này được **nhúng lúc build**; sau khi đổi `.env`, khởi động lại dev hoặc build lại bộ cài.
Các máy client cần truy cập được cổng 8080 trên máy server. `localhost` luôn chỉ chính máy đang chạy desktop.
Không đặt mật khẩu database hoặc token trong `VITE_*`; các biến này công khai trong ứng dụng.

Backend mặc định cho phép hai origin: `http://localhost:5173` (dev) và `app://auction` (desktop đã build).
Override bằng `FRONTEND_ORIGINS`, danh sách phân cách bằng dấu phẩy, khi cần thêm origin cụ thể.
Giữ `app://auction` để bản desktop đóng gói hoạt động. Không cần thêm IP server vào danh sách origin chỉ vì đổi địa chỉ API.
Origin allowlist không thay thế xác thực người dùng; các chức năng nghiệp vụ sau này phải xác thực tại server.

## Chạy backend ngoài Docker

Khởi động MySQL (có thể dùng `docker compose up -d mysql`). Export các biến môi trường trước khi chạy Maven;
Spring Boot không tự đọc `.env` tại gốc khi chạy trực tiếp:

```powershell
$env:JAVA_HOME = 'C:\path\to\jdk-21'
$env:DB_HOST = 'localhost'
$env:DB_PORT = '3306'
$env:DB_NAME = 'auction_db'
$env:DB_USERNAME = 'auction_user'
$env:DB_PASSWORD = '<mat-khau-da-cau-hinh>'
cd backend
mvn spring-boot:run
```

- REST: `GET http://localhost:8080/api/health` → `{"status":"UP","service":"auction-backend"}`.
- WebSocket: `ws://localhost:8080/ws/health`; gửi text `PING`, nhận `PONG`.
- Payload WebSocket khác `PING` bị đóng với mã 1007; giới hạn text message 128 byte.
- API health xác nhận server HTTP hoạt động, không phải kiểm tra truy vấn database.

MySQL Compose chỉ chạy `database/init.sql` khi volume được tạo lần đầu. Với MySQL tự cài, import file này trước khi chạy backend.
`docker compose down` dừng dịch vụ nhưng giữ dữ liệu. `docker compose down -v` **xóa dữ liệu trong volume**, chỉ dùng khi chủ động muốn reset database.

## Build và đóng gói Windows

Trong `frontend/`:

```powershell
npm run build       # TypeScript, React assets, Electron main/preload
npm start           # Chạy Electron với assets đã build, không cần Vite
npm run pack:win    # Thư mục ứng dụng tại release/win-unpacked/
npm run dist:win    # Bộ cài NSIS .exe trong release/
```

Các lệnh đóng gói tự build lại. Backend và MySQL chạy riêng; bộ cài chỉ chứa desktop client.
Máy người dùng cài desktop không cần Node.js hoặc JDK; máy server cần môi trường chạy backend/MySQL.
Bản local chưa được ký số, Windows có thể cảnh báo nhà phát hành chưa xác minh.
Lệnh đóng gói không tự publish GitHub Release. `release/`, `dist/`, `dist-electron/` không được commit.

Desktop dùng hash router và giao thức `app://auction` để tải tài nguyên local.
Electron bật sandbox/context isolation, tắt Node integration, chặn cửa sổ mới và điều hướng ngoài.
Preload chỉ cung cấp thông tin phiên bản/nền tảng, không cung cấp quyền truy cập file hoặc shell.
Content Security Policy được tạo từ địa chỉ server; không tắt web security để xử lý CORS.

## Kiểm tra

```powershell
cd backend
mvn verify
cd ../frontend
npm ci
npm run typecheck
npm run test:coverage
npm run test:e2e
npm audit
```

Backend integration tests kiểm tra REST CORS, WebSocket PING/PONG và origin bị từ chối.
Unit tests frontend kiểm tra URL server/LAN/HTTPS và chặn truy cập file ngoài thư mục assets; coverage threshold 80% cho hai module này.
E2E tự chạy JAR backend trên cổng 8080 rồi mở Electron, kiểm tra điều hướng/reload, REST/WebSocket,
dịch vụ không truy cập được, thử lại và cách ly Node. Test cũng chạy Vite để kiểm tra chế độ dev.
Cổng 8080 và 5173 cần trống; build JAR bằng `mvn verify` trước.
Integration/E2E tests tắt auto-configuration database **chỉ trong tiến trình test**, nên không xác nhận MySQL/schema.

Sau `npm run pack:win`, kiểm tra đúng executable đóng gói:

```powershell
$env:E2E_EXECUTABLE = (Resolve-Path 'release/win-unpacked/OnlineBidFlow.exe').Path
npx playwright test
Remove-Item Env:E2E_EXECUTABLE
```

GitHub Actions kiểm tra Java 21, frontend, E2E Electron và đóng gói trên Windows.
