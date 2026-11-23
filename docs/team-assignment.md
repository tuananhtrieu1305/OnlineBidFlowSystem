# Phân công công việc và tỷ lệ đóng góp

Nhóm phân công theo chức năng, kết hợp phát triển độc lập và phối hợp tích hợp. Tỷ lệ đóng góp đề xuất là **25% cho mỗi thành viên**, dựa trên phạm vi, độ phức tạp và trách nhiệm hoàn thiện các phần được giao; tổng cộng **100%**.

| Thành viên | Phần phụ trách | Mô tả công việc | Tỷ lệ đóng góp |
| --- | --- | --- | ---: |
| **Phạm Bá Tiến** | Tài khoản – Ví Coin – Admin – Đấu giá livestream: UI và luật chơi cơ bản | Đăng ký/đăng nhập, phân quyền, quản lý người dùng; ví Coin, nạp, khóa/mở khóa, thanh toán, lịch sử giao dịch và ví hệ thống. Xây dựng chức năng quản trị, cấu hình phiên; UI livestream cho host/người xem và nghiệp vụ cơ bản: mở đấu, nhận bid, đếm ngược, chốt kết quả, tạm dừng/tiếp tục, tích hợp thanh toán. | **25%** |
| **Nguyễn Minh Vinh** | Đấu giá thường – Quản lý sản phẩm – Quản lý phiên đấu giá ở Client | Nghiệp vụ NORMAL: điều kiện tham gia, bước giá, bid công khai, giá/người dẫn đầu, hai nhịp đấu, gia hạn và kết thúc phiên. Quản lý thông tin, hình ảnh sản phẩm; xây dựng danh sách, tìm kiếm, lọc, xem chi tiết và tham gia phiên trên Client; hiển thị diễn biến và kết quả NORMAL. | **25%** |
| **Nguyễn Thành Đạt** | Đấu giá mù – Thống kê sản phẩm – Bảng xếp hạng | Nghiệp vụ BLIND: phòng chờ, Clue pool, chia Clue, Clue hệ thống, mua bán manh mối, các giai đoạn chơi, đặt/sửa bid kín và xác định kết quả. Bảo vệ dữ liệu bí mật; xây dựng thống kê sản phẩm cho Admin và bảng xếp hạng người chơi từ lịch sử tham gia/kết quả. | **25%** |
| **Triệu Tuấn Anh** | Realtime – Room – Chat – Reconnect – Replay – Đấu giá livestream: cấu hình Săn vé bí ẩn | Hạ tầng socket, join/leave phòng, quyền PUBLIC/PRIVATE, đồng bộ trạng thái, broadcast, chat/chống spam, reconnect và Replay. Phụ trách kết nối realtime, truyền camera/micro của livestream; xây dựng cấu hình Săn vé bí ẩn gồm sản phẩm bí mật, mẫu nhiệm vụ, điều kiện nhận vé và quyền tham gia vòng cuối. | **25%** |
| **Tổng cộng** | | | **100%** |

## Phối hợp và ranh giới trách nhiệm

- Mỗi thành viên hoàn thiện backend, giao diện, kiểm thử và tài liệu trong phần được giao; cùng kiểm thử tích hợp và sửa lỗi liên quan.
- Tiến phụ trách chức năng tạo/cấu hình phiên trong khu vực Admin; Vinh phụ trách tra cứu, xem chi tiết và tham gia phiên ở Client. Vinh quản lý dữ liệu sản phẩm; Đạt phụ trách thống kê từ lịch sử bán sản phẩm.
- Module NORMAL/BLIND/livestream kiểm tra bid và xác định kết quả, sau đó gọi dịch vụ ví của Tiến để xử lý Coin. Hạ tầng realtime truyền dữ liệu theo quyền và quy tắc công khai/bí mật do từng module cung cấp.
- Tiến và Tuấn Anh phối hợp tích hợp livestream: Tiến phụ trách UI và luật đấu cơ bản; Tuấn Anh phụ trách truyền thông realtime và cấu hình Săn vé bí ẩn. Hai thành viên cùng hoàn thiện luồng nhiệm vụ, cấp vé, mở vòng bí mật và đồng bộ kết quả.
