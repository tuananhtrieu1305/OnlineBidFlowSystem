# Đấu giá BLIND: Clue, thị trường thông tin và bid kín

## Bắt đầu một phiên mới

1. Admin tạo phiên BLIND, chọn sản phẩm, giá sàn, quyền PUBLIC/PRIVATE và sức chứa từ 3 đến 30 người. Admin đặt giờ mở phòng theo lịch; không nhập giờ đóng phòng.
2. Ngay trong form tạo/sửa phiên, Admin nhập số Clue khác nhau đúng bằng sức chứa (tối đa 30), rồi đặt thời gian mua bán Clue và thời gian đặt/sửa bid. Cả cấu hình phiên, Clue và thời lượng được lưu trong một transaction. Mặc định sức chứa là 4; đổi số người sẽ thay đổi số ô Clue và khi giảm sẽ bỏ các ô cuối.
3. Đúng giờ hẹn, scheduler tự mở phòng. Admin có thể bấm **Start now** để mở sớm. Hạn chờ 5 phút luôn tính từ thời điểm mở thực tế; chỉ phòng đã mở mới nhận người chơi. Sau khi mở, không sửa sức chứa, Clue hoặc thời lượng.
4. Khi số người đã giữ chỗ và đang online cùng đạt sức chứa, scheduler bắt đầu phiên ngay. Nếu đến hạn 5 phút mà có ít nhất 3 người online, phiên bắt đầu với đúng những người đó. Server rút ngẫu nhiên số Clue bằng số người chơi từ toàn bộ Clue đã lưu và chia mỗi người một Clue. Người giữ chỗ nhưng offline lúc hết hạn không được tham gia phiên đã bắt đầu.
5. Đến hạn mà dưới 3 người online, phiên chuyển thành `CANCELLED`. Khi đã bắt đầu, người chơi có thể reconnect; người mới không được thế chỗ.

| Giai đoạn | Thời lượng | Hành động |
| --- | ---: | --- |
| REVEAL | 20 giây | Mở Clue riêng; ảnh sản phẩm luôn hiện, tên và mô tả vẫn bí mật |
| TRADE | Admin đặt, mặc định 300 giây | Chat; mỗi người đăng bán một Clue một lần, có thể sửa giá hoặc hủy; mỗi Clue chỉ bán thành công một lần |
| DISCUSS | 60 giây | Đóng giao dịch Clue; tiếp tục chat để chốt thông tin trước khi bid |
| BID | Admin đặt, mặc định 100 giây | Tạo hoặc sửa bid bí mật |
| LOCKED | 20 giây | Không nhận bid mới hoặc sửa bid; chat vẫn hoạt động |
| FINISHED | Sau đó | Chọn bid cuối hợp lệ cao nhất, hòa thì xác nhận sớm hơn; mở thông tin sản phẩm, top 3 bid và diễn biến phiên |

Một người rời sau khi bắt đầu không dừng phiên. Slot của họ vẫn thuộc tài khoản đó; họ có thể reconnect vào đúng Clue và bid cũ. Người mới không được thế chỗ. Coin mua Clue chuyển trực tiếp giữa ví USER và được ghi bằng hai bút toán `CLUE_TRADE`, không đi qua ví SYSTEM. Coin đã mua không được hoàn nếu Clue không có ích. Buyer gửi `listingId` và `version`; nếu seller sửa giá/hủy trước khi giao dịch được xử lý, server từ chối với `LISTING_CHANGED`.

Bid được lưu theo từng lần xác nhận; chỉ bid cuối của mỗi USER cạnh tranh. Gửi lại đúng mức bid cũ bị từ chối và không đổi thời điểm phân xử hòa; replay bỏ qua các bản ghi trùng mức giá từ dữ liệu cũ. Server khóa mức Coin đang bid, điều chỉnh phần chênh lệch khi sửa và hoàn các hold của người thua khi quyết toán. Giá sàn, bid của người khác và leader không trả qua API trạng thái hay WebSocket trong lúc chơi.
Tin đăng của chính mình hiện trong chợ nhưng không thể tự mua. Khi một Clue được mua, tin đăng bị đóng và Clue đó không thể bán lại; hủy tin cũng sử dụng hết lượt đăng bán của người bán. Lịch sử bid và giao dịch Clue chỉ hiện trong **Xem diễn biến phiên** sau khi phiên kết thúc; lịch sử không chứa chat.

## API mới

- Admin: `POST/PUT /api/admin/auctions` nhận `blindSetup` gồm `clues`, `tradeSeconds`, `bidSeconds`; dữ liệu được lưu cùng phiên.
- Admin: `POST /api/admin/blind/auctions/{id}/open` mở phòng sớm và bắt đầu hạn chờ 5 phút; scheduler cũng mở phòng khi đến giờ hẹn.
- USER: `GET /api/blind/auctions` trả danh sách phiên PUBLIC/PRIVATE, trạng thái, ảnh sản phẩm nhưng che tên/mô tả trước khi kết thúc, số chỗ đã giữ và quyền tham gia của chính mình; không trả mã phòng, giá sàn, Clue hoặc bid.
- USER đã vào phòng: `GET /api/blind/auctions/{id}` trả trạng thái, Clue mình sở hữu, listing công khai, bid của mình và mốc thời gian. Sau khi kết thúc mới trả sản phẩm thật và top 3 bid cuối.
- USER giai đoạn TRADE: `PUT/DELETE /api/blind/auctions/{id}/listings/{clueId}`, `POST /api/blind/auctions/{id}/listings/{listingId}/buy`.
- USER giai đoạn BID: `POST /api/blind/auctions/{id}/bids`.
- Phòng và chat dùng `/ws/auction` hiện có với `JOIN_ROOM`, `LEAVE_ROOM`, `SEND_CHAT_MESSAGE`; client tự join lại khi reconnect. Các POST/PUT/DELETE dùng session và CSRF hiện có.

## Database cũ và kiểm thử

Với database đã có dữ liệu, áp dụng [migration 2026-10-26-blind-game.sql](../database/migrations/2026-10-26-blind-game.sql) **một lần**, sau khi backup, trước khi chạy backend mới. `database/init.sql` chỉ chạy khi volume mới được tạo; không chạy lại trên dữ liệu làm việc. Migration thêm 5 bảng BLIND và giá trị enum `CLUE_TRADE` mà không xóa bản ghi hiện có.
Sau đó áp dụng [migration 2026-10-29-blind-admin-start.sql](../database/migrations/2026-10-29-blind-admin-start.sql) và [migration 2026-11-01-blind-variable-players.sql](../database/migrations/2026-11-01-blind-variable-players.sql) **một lần, theo thứ tự**. Migration mới mở rộng slot Clue, thêm thời điểm mở phòng và trạng thái `CANCELLED`. Các phiên chưa có cấu hình dùng mặc định 300/100 giây.

Các phiên BLIND RUNNING mẫu có từ trước không có `blind_rounds`/Clue nên không tự chuyển thành game mới. Tạo phiên BLIND mới để thử luồng mới. Kiểm thử tích hợp dùng MySQL riêng và `BlindGameIT`, không hướng vào database làm việc.

Trong trạng thái hiện tại, frontend tải trạng thái phòng và marketplace mỗi 2 giây; chat và sự kiện kết thúc nhận bằng WebSocket. Nếu mất phản hồi khi mua/bid, xem lại trạng thái phòng và ví trước khi gửi tiếp. Luồng phát sự kiện socket sau commit là best effort như contract hiện có.
Giao diện phòng BLIND dùng cùng khung toàn màn hình với NORMAL: thanh trạng thái, đồng hồ và ví ở trên; ảnh sản phẩm bên trái nhưng tên/mô tả chỉ mở sau khi kết thúc; bid, Manh mối và Chợ Clue bên phải; chat mở thành khung nổi. Sau khi kết thúc, phòng hiện top 3 bid. Trang thiết lập Admin dùng form quản trị chung; **Xem diễn biến phiên** hiện các lần đặt/sửa bid và giao dịch Clue kèm nội dung Clue, không hiện chat.
