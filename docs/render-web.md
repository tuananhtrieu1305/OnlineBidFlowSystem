# Đưa bản web lên Render

Dùng một Render Web Service chạy Docker để phục vụ cả React và Spring Boot trên cùng HTTPS origin. Backend này cũng tiếp nhận WebSocket cho phòng đấu giá. Dùng một instance vì phiên đăng nhập và một số trạng thái realtime hiện nằm trong bộ nhớ.

## Cấu hình Web Service

1. Kết nối repo GitHub, chọn nhánh có bản tích hợp, chọn runtime **Docker**. Để Root Directory trống, Dockerfile Path là `./Dockerfile.render` và Docker Build Context là `.`.
2. Đặt **Health Check Path** thành `/api/health`. Render cấp `PORT` ở runtime. Dùng HTTPS do Render cấp.
3. Đặt `VITE_API_BASE_URL` và `FRONTEND_ORIGINS` cùng bằng địa chỉ HTTPS Render cấp cho service, không thêm đường dẫn, ví dụ `https://onlinebidflow.onrender.com`. Dùng địa chỉ thật của service khi tạo. Nếu đổi domain, cập nhật hai biến và build lại.
4. Đặt `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD` theo MySQL 8 dành riêng cho bản deploy. Nếu MySQL kết nối qua internet, cấu hình `SPRING_DATASOURCE_URL` với TLS xác minh máy chủ, theo hướng dẫn của nhà cung cấp. Mật khẩu đặt trong biến bí mật trên Render. Cấu hình profile mặc định, vì profile `demo` phục vụ chứng chỉ Radmin trên máy Windows.

## Dữ liệu và ảnh

- Dùng MySQL 8. Dự án sử dụng cú pháp MySQL, nên Render Postgres không thay thế trực tiếp được.
- Nếu dùng DB demo mới, chuẩn bị schema NORMAL, BLIND và dữ liệu demo trước lần khởi động đầu. `database/init.sql` chỉ dùng cho DB demo trống vì có lệnh xóa bảng và chứa tài khoản seed. Kiểm tra tài khoản seed trước khi mở web công khai. Flyway của backend sẽ áp dụng các migration tiếp theo trên schema đã chuẩn bị.
- Nếu dùng bản sao dữ liệu hiện tại, tạo DB đích riêng, mang theo lịch sử Flyway tương ứng với schema và xác định dữ liệu nào được đưa lên. Các tài khoản, ví, lịch sử đấu giá và ảnh của DB local không được chuyển tự động.
- Để giữ ảnh tải lên giữa các lần deploy, gắn persistent disk vào `/var/data` trên Web Service và đặt `PRODUCT_IMAGE_DIR=/var/data/product-images`. Các ảnh có URL `/api/product-images/…` cần sao chép file tương ứng, giữ nguyên tên. Ảnh phụ hiện được lưu trong thư mục runtime và không nằm trong Git.
- Livestream dùng WebRTC. Khi demo giữa các mạng, cấu hình TURN riêng thông qua `TURN_HOST` và `TURN_SECRET` để dự phòng khi hai máy không kết nối trực tiếp được.

Sau deploy, kiểm tra đăng nhập, tải ảnh, vào một phòng NORMAL bằng hai tài khoản, cập nhật giá/chat qua WebSocket và kết nối lại. Nếu cần demo Livestream, thử camera và âm thanh trên hai mạng thực tế.
