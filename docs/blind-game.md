# Đấu giá BLIND: Clue, thị trường thông tin và bid kín

## Bắt đầu một phiên mới

1. Admin tạo phiên BLIND, chọn sản phẩm, giá sàn, quyền PUBLIC/PRIVATE, giờ bắt đầu theo lịch và hạn chờ bắt đầu. Mọi phiên BLIND có sức chứa đúng 4.
2. Admin mở trang **Thiết lập phòng BLIND** ở chi tiết phiên và lưu 4 manh mối thật, khác nhau trước khi có người tham gia. Tại đây Admin đặt thời gian mua bán Clue và thời gian đặt/sửa bid (mỗi mục 1–3600 giây, mặc định 300 và 100 giây). Có thể đổi hai thời lượng này cho đến khi phiên bắt đầu.
3. Bốn tài khoản USER vào phòng qua `/blind/{auctionId}`. PRIVATE cần mã phòng do Admin chia sẻ. Đủ 4 chỗ thì không nhận USER mới; người đã giữ chỗ vẫn vào lại được. Phiên vẫn ở trạng thái chờ.
4. Admin có thể chọn **Start now** để bắt đầu trước giờ theo lịch. Nếu không, scheduler tự bắt đầu khi đã đến giờ theo lịch. Cả hai cách đều cần đủ 4 người đang kết nối và 4 Clue. Nếu quá hạn chờ mà chưa bắt đầu, phiên thành UNSOLD.
5. Khi bắt đầu, server xáo 4 Clue bằng `SecureRandom`, ghi quyền sở hữu vào DB, và đổi `start_time`/`end_time` thành giờ chơi thực tế. Reconnect chỉ đọc lại quyền sở hữu đã ghi, không quay lại.

| Giai đoạn | Thời lượng | Hành động |
| --- | ---: | --- |
| REVEAL | 20 giây | Mở Clue riêng; ảnh/thông tin sản phẩm công khai |
| TRADE | Admin đặt, mặc định 300 giây | Chat; rao bán, đổi giá, hủy, mua và bán lại Clue |
| DISCUSS | 60 giây | Đóng giao dịch Clue; tiếp tục chat để chốt thông tin trước khi bid |
| BID | Admin đặt, mặc định 100 giây | Tạo hoặc sửa bid bí mật |
| LOCKED | 20 giây | Không nhận bid mới hoặc sửa bid; chat vẫn hoạt động |
| FINISHED | Sau đó | Chọn bid cuối hợp lệ cao nhất, hòa thì xác nhận sớm hơn |

Một người rời sau khi bắt đầu không dừng phiên. Slot của họ vẫn thuộc tài khoản đó; họ có thể reconnect vào đúng Clue và bid cũ. Người mới không được thế chỗ. Coin mua Clue chuyển trực tiếp giữa ví USER và được ghi bằng hai bút toán `CLUE_TRADE`, không đi qua ví SYSTEM. Coin đã mua không được hoàn nếu Clue không có ích. Buyer gửi `listingId` và `version`; nếu seller sửa giá/hủy trước khi giao dịch được xử lý, server từ chối với `LISTING_CHANGED`.

Bid được lưu theo từng lần xác nhận; chỉ bid cuối của mỗi USER cạnh tranh. Server khóa mức Coin đang bid, điều chỉnh phần chênh lệch khi sửa và hoàn các hold của người thua khi quyết toán. Giá sàn, bid của người khác và leader không trả qua API trạng thái hay WebSocket trong lúc chơi.

## API mới

- Admin: `GET/PUT /api/admin/blind/auctions/{id}/clues`.
- Admin: `GET/PUT /api/admin/blind/auctions/{id}/settings` và `POST /api/admin/blind/auctions/{id}/start`.
- USER đã vào phòng: `GET /api/blind/auctions/{id}` trả trạng thái, Clue mình sở hữu, listing công khai, bid của mình, thống kê lịch sử và mốc thời gian.
- USER giai đoạn TRADE: `PUT/DELETE /api/blind/auctions/{id}/listings/{clueId}`, `POST /api/blind/auctions/{id}/listings/{listingId}/buy`.
- USER giai đoạn BID: `POST /api/blind/auctions/{id}/bids`.
- Phòng và chat dùng `/ws/auction` hiện có với `JOIN_ROOM`, `LEAVE_ROOM`, `SEND_CHAT_MESSAGE`; client tự join lại khi reconnect. Các POST/PUT/DELETE dùng session và CSRF hiện có.

## Database cũ và kiểm thử

Với database đã có dữ liệu, áp dụng [migration 2026-10-26-blind-game.sql](../database/migrations/2026-10-26-blind-game.sql) **một lần**, sau khi backup, trước khi chạy backend mới. `database/init.sql` chỉ chạy khi volume mới được tạo; không chạy lại trên dữ liệu làm việc. Migration thêm 5 bảng BLIND và giá trị enum `CLUE_TRADE` mà không xóa bản ghi hiện có.
Sau đó áp dụng [migration 2026-10-29-blind-admin-start.sql](../database/migrations/2026-10-29-blind-admin-start.sql) **một lần** để thêm cấu hình thời lượng cho từng phiên. Các phiên chưa có cấu hình dùng mặc định 300/100 giây.

Các phiên BLIND RUNNING mẫu có từ trước không có `blind_rounds`/Clue nên không tự chuyển thành game mới. Tạo phiên BLIND mới để thử luồng 4 người. Kiểm thử tích hợp dùng MySQL riêng và `BlindGameIT`, không hướng vào database làm việc.

Trong trạng thái hiện tại, frontend tải trạng thái phòng và marketplace mỗi 2 giây; chat và sự kiện kết thúc nhận bằng WebSocket. Nếu mất phản hồi khi mua/bid, xem lại trạng thái phòng và ví trước khi gửi tiếp. Luồng phát sự kiện socket sau commit là best effort như contract hiện có.
Giao diện phòng BLIND dùng cùng khung toàn màn hình với NORMAL: thanh trạng thái, đồng hồ và ví ở trên; ảnh sản phẩm bên trái; bid và các tab dữ liệu bên phải; chat mở thành khung nổi. Các tab riêng của BLIND gồm Manh mối, Chợ Clue và Giá lịch sử. Trang thiết lập Admin dùng form quản trị chung; replay dùng khung kết quả và diễn biến cùng hệ kiểu chữ.
