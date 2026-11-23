# OnlineBidFlow — Hệ thống đấu giá online thời gian thực

Ứng dụng desktop cho phép người dùng đấu giá bằng Coin giả lập, trao đổi trong phòng realtime và xem lại kết quả. Admin quản lý tài khoản, sản phẩm, cấu hình phiên và điều hành livestream.

- **NORMAL:** trả giá công khai qua hai nhịp, có bước giá và gia hạn khi có bid sát giờ.
- **BLIND:** suy luận sản phẩm qua Clue pool, mua bán manh mối và đặt/sửa bid bí mật.
- **LIVESTREAM:** host phát camera/micro, đấu nhiều sản phẩm, tự chốt sau 5 giây kể từ bid cuối; có chế độ Săn vé bí ẩn.

Các chức năng dùng chung gồm ví Coin, chat, reconnect, lịch sử, Replay và bảng xếp hạng. Xem [mô tả hệ thống và luật chơi](docs/system-description.md).

## Công nghệ và cấu trúc

```text
Electron + React + TypeScript ── REST / WebSocket / WebRTC ── Spring Boot ── MySQL
```

Client dùng Vite, Tailwind CSS và electron-builder; backend dùng Java 21, Spring Boot 3.3.5, Spring Security, JPA/JDBC và Flyway; database dùng MySQL 8.4.

```text
frontend/
  src/                   Giao diện và các chức năng React
  electron/              Main process, preload, quyền camera/micro
  scripts/               Chạy phát triển và build Electron
backend/
  src/main/java/         REST API, nghiệp vụ, ví và realtime
  src/main/resources/    Cấu hình Spring Boot và migration Flyway
database/                Schema khởi tạo, dữ liệu mẫu và migration BLIND cũ
deploy/livestream/       Cấu hình HTTPS/TURN cho triển khai qua VPN
docs/                    Mô tả hệ thống, phân công và thiết kế database
docker-compose.yml       Backend và MySQL cho local
```

## Phân công nhóm

| Thành viên | Phần phụ trách | Đóng góp đề xuất |
| --- | --- | ---: |
| Phạm Bá Tiến | Tài khoản, Ví Coin, Admin; UI và luật chơi livestream cơ bản | 25% |
| Nguyễn Minh Vinh | Đấu giá thường, quản lý sản phẩm, quản lý phiên ở Client | 25% |
| Nguyễn Thành Đạt | Đấu giá mù, thống kê sản phẩm, bảng xếp hạng | 25% |
| Triệu Tuấn Anh | Realtime, Room, Chat, Reconnect, Replay; cấu hình Săn vé bí ẩn | 25% |

Xem [phân công và ranh giới phối hợp](docs/team-assignment.md).

## Cơ sở dữ liệu

Schema gồm **28 bảng nghiệp vụ**, chia thành các nhóm: tài khoản/Coin, sản phẩm, đấu giá dùng chung/NORMAL, BLIND, livestream và nhiệm vụ/vé bí ẩn. Mỗi món trong livestream liên kết một lượt đấu riêng trong `auctions`, dùng chung bid và giao dịch Coin.

Thống kê, bảng xếp hạng, Replay và lịch sử mua được tổng hợp từ dữ liệu nghiệp vụ. Xem [từ điển dữ liệu, ERD, index và nguồn migration](docs/database-design.md).

## Khởi chạy local với Docker

### 1. Chuẩn bị

- Docker Desktop và Docker Compose đang hoạt động.
- Node.js **22.12+**, npm để chạy client; Windows nếu cần đóng gói bản Windows.
- Backend được build trong Docker nên không cần cài Java/Maven trên host.

Chạy các lệnh sau bằng PowerShell tại thư mục gốc repository.

### 2. Chạy MySQL và backend

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
docker compose up -d --build
docker compose ps
Invoke-RestMethod http://localhost:8080/api/health
```

Trong `.env`, giữ `MYSQL_DATABASE` và `DB_NAME` là `auction_db` để khớp script khởi tạo. `DB_USERNAME`/`DB_PASSWORD` phải khớp `MYSQL_USER`/`MYSQL_PASSWORD`. Nếu cổng MySQL 3306 đã được dùng, đổi `MYSQL_HOST_PORT=3307`; backend trong Docker vẫn kết nối `mysql:3306`.

Ở lần chạy với volume mới, MySQL nạp `database/init.sql`, sau đó backend áp dụng các migration Flyway mới. Volume cũ giữ dữ liệu; script khởi tạo không tự chạy lại. Database từ phiên bản cũ cần được đối chiếu với [lưu ý đồng bộ schema](docs/database-design.md#11-nguồn-schema-và-lưu-ý-đồng-bộ).

### 3. Chạy desktop client

Mở terminal khác tại thư mục gốc:

```powershell
cd frontend
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm ci
npm run dev
```

`frontend/.env` cần đặt `VITE_API_BASE_URL=http://localhost:8080`. Lệnh dev mở Electron và chạy Vite tại `http://localhost:5173`. Backend/MySQL chạy trong Docker; cửa sổ desktop chạy trên host. `npm run dev:web` chỉ mở chế độ web để xem giao diện.

Database khởi tạo có tài khoản Admin mẫu **`admin` / `Password@123`**, chỉ dành cho local. Với volume đã tồn tại, dùng tài khoản hiện có. Để thử luật mới, đăng ký tài khoản USER, nạp Coin giả lập và dùng Admin tạo sản phẩm/phiên mới. Livestream cần cho phép Electron truy cập camera và micro.

### 4. Theo dõi và dừng

```powershell
docker compose logs -f backend
docker compose stop
docker compose start
```

Nhấn `Ctrl+C` ở terminal client để dừng chế độ dev. `docker compose down` gỡ container nhưng giữ volume; **`docker compose down -v` xóa dữ liệu MySQL và ảnh sản phẩm trong volume**. Không chạy lại `database/init.sql` trên dữ liệu cần giữ vì script có lệnh DROP TABLE.

## Build client

Trong `frontend/`:

```powershell
npm run build      # Kiểm tra TypeScript, build giao diện và Electron
npm start          # Mở bản đã build
npm run pack:win   # Thư mục ứng dụng: release/win-unpacked/
npm run dist:win   # Bộ cài Windows: release/
```

Client đã đóng gói vẫn cần backend/MySQL chạy riêng. Địa chỉ `VITE_API_BASE_URL` được nhúng lúc build; đổi địa chỉ server thì cần khởi động lại dev hoặc build lại client. Các biến `VITE_*` chỉ chứa cấu hình công khai.

Triển khai nhiều máy có cấu hình riêng tại `docker-compose.radmin.yml` và `deploy/livestream/` cho HTTPS/TURN; hướng dẫn local ở trên dùng Compose mặc định.
