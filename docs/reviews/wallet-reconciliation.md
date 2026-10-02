# Đối soát chỉ đọc — 02/10/2026

Chạy database/audits/wallet-reconciliation.sql trên auction_mysql/auction_db, snapshot lúc03:48:33 UTC (10:48:33 Asia/Saigon). Không UPDATE/DELETE/INSERT hoặc sửa schema DB làm việc.

| Đối tượng | Snapshot | Ledger | Kết luận |
| --- | --- | --- | --- |
| SYSTEM ID1 | khả dụng1500, khóa0 |1500/0| Khớp; đúng một SYSTEM |
| USER wallet2 |4400/4100|6900/1600| Lệch khả dụng-2500, khóa+2500; nguồn hold chưa được giải thích |
| USER wallet7 |6000/0|0/0| Thiếu lịch sử đầu kỳ/nạp trong seed |
| USER wallet8 |9500/0|0/0| Thiếu lịch sử đầu kỳ/nạp trong seed |
| USER wallet9 |3900/0|0/0| Thiếu lịch sử đầu kỳ/nạp trong seed |
| USER wallet10 |8200/0|0/0| Thiếu lịch sử đầu kỳ/nạp trong seed |
| SOLD auction2 |winner3, giá1800|0 PAYMENT| Kết quả seed chưa có giao dịch thanh toán tương ứng |
| SOLD auction8 |winner8, giá3500|0 PAYMENT| Kết quả seed chưa có giao dịch thanh toán tương ứng |
| SOLD auction9 |winner9, giá4100|0 PAYMENT| Kết quả seed chưa có giao dịch thanh toán tương ứng |

Các ví3–6 và11 khớp delta. Không có kết quả ở query thiếu/trùng ví USER, hold âm, hold không gắn phiên, hold còn trong phiên kết thúc, delta sai dạng hoặc wallet_type/user_id sai. Đây là kết quả theo dữ liệu đang có, không chứng minh lịch sử thiếu đã được khôi phục.

**Không tự sửa:** cộng một LOCK2500 không đủ chứng minh đúng phiên/nguồn bid; tạo PAYMENT cho phiên seed có thể trừ tiền hai lần nếu snapshot đã phản ánh giao dịch thiếu. Cần nhóm xác nhận lịch sử chuẩn hoặc chấp nhận seed chỉ minh họa. Các bản ghi này không được dùng làm bằng chứng cho luồng thanh toán hoàn chỉnh. Service hiện tại chặn ledger khóa bất nhất.

## Demo riêng

Đọc lại lúc 03:57:11 UTC cùng ngày: tất cả số dư/ledger và các ngoại lệ trên giữ nguyên. Không ghi dữ liệu vào DB làm việc trong đợt rà soát.

`frontend/scripts/create-phase2-demo.mjs` tạo prefix ngẫu nhiên, ba tài khoản, hai ví USER nạp10000 Coin qua API, một sản phẩm và hai phiên UPCOMING (NORMAL/PUBLIC, BLIND/PRIVATE). Chỉ chạy với backend test18080 và DB test33308. DEMO_PASSWORD do người chạy đặt trong environment; manifest .cache/demo2_*.json chỉ chứa ID/username/trạng thái, không có mật khẩu hoặc mã phòng.

Promotion ADMIN là bước fixture bằng SQL vào container onlinebidflow-registration-test sau khi đối chiếu ID đăng ký qua HTTP; ví0 của tài khoản này được bỏ trước khi đổi role. Các khoản nạp dùng nghiệp vụ thật. Script không retry mutation; thất bại lưu state=incomplete để điều tra. Mỗi lần tạo prefix mới nên không cộng lại Coin vào ví cũ. Không có cleanup tự động xóa rộng hoặc thay dữ liệu làm việc.

Để chạy: khởi động MySQL kiểm thử theo hướng dẫn dự án, đặt JAVA_HOME(Java21), DB_HOST=127.0.0.1, DB_PORT=33308, DB_NAME=auction_db, DB_USERNAME/DB_PASSWORD của DB test và REGISTRATION_TEST_DATABASE=true; chạy `node scripts/registration-test-backend.mjs` trong frontend. Ở terminal khác cùng environment, đặt DEMO_PASSWORD rồi chạy `node scripts/create-phase2-demo.mjs`. Build UI với VITE_API_BASE_URL=http://localhost:18080 nếu muốn xem demo; xong build lại mặc định. Không dùng thông tin seed để đăng nhập demo.

Fixture này kiểm chứng tài khoản/ví/Admin; không tự bắt đầu phiên hoặc mô phỏng scheduler. Kiểm thử settlement/UNSOLD dùng harness MySQL integration có rollback/cleanup riêng; tích hợp bid thật thuộc Phase3.
