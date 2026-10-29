# Bảng xếp hạng người chơi

Giao diện `/leaderboard` và API `GET /api/leaderboard?type=ALL|BLIND&period=ALL_TIME|MONTH` đọc công khai. Mặc định hiển thị Top 10 toàn thời gian, mọi loại phiên. Tài khoản USER có thêm `GET /api/leaderboard/me` để xem vị trí của mình ngoài Top 10 và thành tích phòng PRIVATE. ADMIN không có hồ sơ người chơi.

## Quy tắc

- Bảng công khai chỉ dùng phiên `PUBLIC`, trạng thái `SOLD` hoặc `UNSOLD`, đã có `finished_at` và có bản ghi trong `auction_participants`. BLIND còn phải có `blind_rounds`, chứng minh phiên đã thực sự bắt đầu. Các phiên BLIND seed cũ không có `blind_rounds` sẽ không được tính.
- Số lần thắng là số phiên `SOLD` có `winner_user_id` bằng người chơi; số phiên đã chơi là số phiên hợp lệ người đó tham gia. Tỷ lệ thắng = thắng / đã chơi.
- Xếp theo số lần thắng giảm dần; khi bằng nhau, tỷ lệ thắng giảm dần. Người bằng cả hai tiêu chí nhận cùng hạng; tên tài khoản và ID chỉ dùng để giữ thứ tự hiển thị ổn định trong Top 10.
- Bộ lọc tháng dùng tháng lịch `Asia/Ho_Chi_Minh`, cắt theo `finished_at` lưu UTC. `ALL_TIME` không có giới hạn thời gian.
- `/me` chỉ trả thành tích PRIVATE của chính USER và tổng PUBLIC+PRIVATE. Coin mua sản phẩm là tổng `winning_price` của phiên đã thắng; không cộng tiền mua/bán Clue, số dư ví hoặc bid. API công khai không trả chi tiết phiên PRIVATE, Coin, bid, giá sàn hay người tham gia khác ngoài tên và thành tích tổng hợp từ PUBLIC.
- Với NORMAL, dữ liệu hiện có không có bảng round riêng; phiên kết thúc có người tham gia được xem là đã chơi. Nếu nghiệp vụ NORMAL sau này thêm mốc bắt đầu thực tế, cần đồng bộ lại điều kiện này.

Không tạo bảng leaderboard hay migration. Kết quả được tổng hợp trực tiếp từ `auctions`, `auction_participants`, `users` và `blind_rounds`. Chạy `LeaderboardIT` trên MySQL kiểm thử riêng để kiểm tra phân quyền, hòa hạng, tỷ lệ thắng, BLIND chưa bắt đầu, phòng PRIVATE và ranh giới tháng Việt Nam.
