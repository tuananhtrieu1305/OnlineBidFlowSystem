# Bàn giao và demo phần Tiến

Phạm vi đã có: tài khoản/session/phân quyền, ví USER/nạp/lịch sử, ví SYSTEM, tra cứu người dùng, sản phẩm/ảnh, cấu hình phiên và khám phá PUBLIC. Các thao tác khóa/hoàn/thanh toán Coin là API nội bộ có integration test; chưa có UI đặt bid để demo chúng end-to-end.

## Môi trường kiểm thử riêng

Yêu cầu Node 22.12+, Java 21, Maven, Docker; dependencies frontend đã cài bằng `npm ci`. Dùng container `onlinebidflow-registration-test` bind `127.0.0.1:33308`, không dùng `auction_mysql` hoặc backend làm việc ở 8080. Cách tạo DB test lần đầu tại [registration.md](registration.md#mysql-integration-tests). Nếu container test đã tồn tại, kiểm tra và chỉ khởi động nó; không import lại init.sql lên dữ liệu có sẵn.

Trong PowerShell tại root, thiết lập cho mỗi terminal chạy backend/test:

```powershell
$env:JAVA_HOME='C:/Program Files/Java/jdk-21' # điều chỉnh đường dẫn nếu khác
$env:DB_HOST='127.0.0.1'
$env:DB_PORT='33308'
$env:DB_NAME='auction_db'
$env:DB_USERNAME='root'
$env:DB_PASSWORD='registration_test_only' # chỉ mật khẩu container test theo hướng dẫn
$env:REGISTRATION_TEST_DATABASE='true'
$env:PRODUCT_IMAGE_DIR="$PWD/.cache/tien-live-images"
$env:DEMO_PASSWORD=Read-Host 'Mật khẩu riêng cho tài khoản demo (12–72 byte UTF-8)'
```

## Chạy kiểm thử bàn giao

```powershell
cd backend
mvn -Pregistration-it,integration-coverage verify
if ($LASTEXITCODE -ne 0) { throw 'Backend verification failed' }
cd ../frontend
npm run test:coverage
$env:VITE_API_BASE_URL='http://localhost:18080'
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed' }
npx playwright test --config playwright.tien-live.config.ts
```

Live suite tự bật/tắt JAR backend test ở 18080; cổng này phải trống. Suite có 8 hành trình trên Electron với API/MySQL thật. Chỉ trong tiến trình backend test của suite, hạn mức register/login được nâng lên 100/phút để các fixture độc lập không chặn nhau. Test rate limit mặc định nằm trong backend suite.

Coverage discovery riêng: trong backend chạy `mvn -Pregistration-it,discovery-coverage -Dit.test=DiscoveryIT verify` với cùng biến DB test. Trên máy này có thể thêm `'-Dmaven.repo.local=../.cache/m2'` để tái sử dụng cache dự án. Không chạy đồng thời các suite ghi cùng database test.

Hồi quy Electron với API mô phỏng: `npx playwright test` trong frontend (cần cổng 5173 trống). API mô phỏng không thay thế live suite.

## Demo thủ công bằng fixture sạch

1. Trong terminal có environment trên, tại frontend chạy `node scripts/registration-test-backend.mjs`; giữ tiến trình chạy.
2. Mở terminal khác với cùng environment, tại frontend chạy `node scripts/create-phase2-demo.mjs`. Script tạo một ADMIN, hai USER có 10.000 Coin qua API nạp thật, một sản phẩm, một phiên NORMAL/PUBLIC và một BLIND/PRIVATE. Manifest `.cache/demo2_*.json` ghi tên/ID và trạng thái; không lưu mật khẩu/mã phòng. Dùng DEMO_PASSWORD vừa đặt để đăng nhập. Nếu script thất bại, xem manifest `incomplete` trước khi chạy lại; không tự retry mutation.
3. Build với `VITE_API_BASE_URL=http://localhost:18080`, rồi `npm start`.
4. Khách: tìm prefix trong manifest, xem phiên PUBLIC và thông tin sản phẩm. Phiên PRIVATE không xuất hiện.
5. USER: đăng nhập → Ví Coin → nạp 500 Coin → kiểm tra khả dụng và DEPOSIT → reload → đăng xuất.
6. ADMIN: tra cứu USER vừa nạp và đối chiếu số dư/lịch sử; xem SYSTEM; thêm/sửa sản phẩm và ảnh; tạo/sửa phiên UPCOMING chưa có hoạt động. PRIVATE có mã phòng chỉ dành cho Admin.

Fixture mới có số dư/ledger nhất quán. Database test vẫn có các bản ghi seed gốc: không dùng ví/phiên seed cũ để chứng minh thanh toán. Không dùng nút Admin hay SQL để giả lập winner hoặc chạy các phiên seed đến hạn.

## Khôi phục cấu hình bàn giao sau test

Đóng ứng dụng demo và dừng backend test bằng Ctrl+C. Trong frontend:

```powershell
Remove-Item Env:VITE_API_BASE_URL -ErrorAction SilentlyContinue
Remove-Item Env:E2E_EXECUTABLE -ErrorAction SilentlyContinue
npm run build
```

Nếu có `frontend/.env`, xác minh nó trỏ đúng server bàn giao; environment trống dùng giá trị trong file hoặc mặc định 8080. Không phân phối bản build còn trỏ 18080. `npm run pack:win` tạo executable Windows; không tự publish. Không cần sửa/deploy backend đang chạy để thực hiện kiểm thử này.

Bản Windows unpacked đã tạo và smoke test ngày 03/10/2026 tại `frontend/release/win-unpacked/OnlineBidFlow.exe`, trỏ mặc định 8080. Sao chép cả thư mục `win-unpacked` khi bàn giao. Để demo trên backend test 18080, dùng bản source build ở bước demo hoặc đóng gói riêng với đúng VITE_API_BASE_URL; executable mặc định không tự đổi URL theo environment lúc chạy. Backend làm việc 8080 chưa được deploy trong lượt hoàn thiện này.

## Phần nhóm cần nối

- NORMAL/BLIND: nhận lệnh user, kiểm tra quyền/thời gian/giá, lưu bid, tính winner; gọi [AuctionWalletIntegration](auction-wallet-integration.md) đúng transaction/lock order.
- Lifecycle: scheduler bắt đầu/kết thúc phiên; không tự thanh toán seed chưa đối soát.
- Room UI: join/chat/reconnect/snapshot/replay; không tự retry bid khi kết quả chưa xác định.
- Khóa tài khoản là đề xuất chưa có đặc tả/schema; quản lý người dùng hiện là tra cứu tài khoản/ví/lịch sử, không tuyên bố có khóa/xóa USER.

Xem [báo cáo kiểm chứng và giới hạn](reviews/tien-completion.md), gồm audit dependency ngày thực hiện.
