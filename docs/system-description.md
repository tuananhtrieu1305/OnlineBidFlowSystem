# Hệ thống đấu giá online thời gian thực

## 1. Tổng quan

- Hệ thống gồm server trung tâm và nhiều client, hỗ trợ ba chế độ: đấu giá thường (`NORMAL`), đấu giá mù (`BLIND`) và đấu giá livestream (`LIVESTREAM`). Server quản lý tài khoản, ví Coin, sản phẩm, phiên đấu giá, người tham gia, bid, chat, giao dịch và kết quả.
- Người dùng đăng ký, đăng nhập và nạp Coin giả lập vào ví riêng. Coin chỉ có giá trị trong hệ thống; ví phân biệt số dư khả dụng và số Coin đang khóa. Admin quản lý người dùng, sản phẩm, cấu hình phiên và điều hành livestream.
- Sản phẩm có tên, mô tả, hình ảnh, số lượng và giá ước tính nội bộ. Một sản phẩm có thể xuất hiện trong nhiều phiên để lưu lịch sử bán và thống kê giá. Giá ước tính không được cung cấp cho người chơi trong NORMAL/BLIND.
- Phiên NORMAL/BLIND có thể là `PUBLIC` hoặc `PRIVATE`; phòng PRIVATE yêu cầu mã phòng và có thể giới hạn sức chứa. Livestream hiện là phiên công khai, yêu cầu đăng nhập để vào phòng, chat và đặt giá.

## 2. Đấu giá thường (NORMAL)

- Admin chọn sản phẩm, giá khởi điểm, bước giá tối thiểu, lịch đấu và cấu hình thời gian. Người chơi biết thông tin sản phẩm, giá khởi điểm, giá hiện tại, người dẫn đầu và lịch sử bid; không xem thống kê giá bán cũ trong lúc đấu.
- Khi tham gia, người dùng cần Coin khả dụng tối thiểu bằng 50% giá khởi điểm. Khi bid, phải đủ Coin bảo đảm toàn bộ mức giá; giá mới tối thiểu bằng giá hiện tại cộng bước giá, với giá hiện tại ban đầu là giá khởi điểm.
- Phiên gồm **hai nhịp liên tục**: nhịp đầu trả giá công khai; nhịp cuối bắt đầu tại ngưỡng cuối phiên theo lịch ban đầu và kéo dài đến khi chốt, kể cả thời gian gia hạn. Giá và bid được giữ xuyên suốt hai nhịp.
- Bid hợp lệ trong khoảng sát giờ do Admin cấu hình sẽ gia hạn nếu cần, bảo đảm còn đủ thời gian phản hồi tính từ bid đó. Bảng xếp hạng trong phòng hiển thị mức giá cao nhất của từng người và có thể xem lại kết quả từng nhịp.
- Server khóa Coin của người dẫn đầu, mở khóa cho người bị vượt giá và cập nhật diễn biến tới phòng. Hết thời hạn cuối cùng, server chọn bid hợp lệ cao nhất để chốt kết quả.

## 3. Đấu giá mù (BLIND)

- Người chơi thấy ảnh nhưng chưa biết tên, mô tả sản phẩm, giá sàn, bid của người khác hoặc người dẫn đầu. Thống kê giá bán cũ không được cung cấp trong lúc chơi; người chơi suy luận qua manh mối (Clue), giao dịch thông tin và thảo luận.
- Admin cấu hình sức chứa **3–30 người**, Clue pool gồm các manh mối khác nhau, số lượng ít nhất bằng sức chứa và tối đa **100**; có thể thêm **0–10 Clue hệ thống** được công bố lần lượt trong giai đoạn BID. Admin đặt lịch mở phòng và thời lượng mua bán Clue, đặt/sửa bid.
- Phòng bắt đầu ngay khi đủ người giữ chỗ và online. Sau **5 phút** kể từ lúc mở, nếu có ít nhất 3 người online thì bắt đầu với những người đó; ít hơn thì hủy (`CANCELLED`). Mỗi người nhận ngẫu nhiên một Clue riêng từ pool. Khi đã bắt đầu, chỉ người trong lượt chơi được reconnect, không nhận người thay thế.

| Giai đoạn | Hoạt động |
| --- | --- |
| REVEAL — 20 giây | Nhận và xem Clue riêng. |
| TRADE — Admin cấu hình | Chat, đăng bán và mua Clue bằng Coin. |
| DISCUSS — 60 giây | Đóng chợ Clue, tiếp tục thảo luận. |
| BID — Admin cấu hình | Gửi hoặc sửa bid bí mật; nhận Clue hệ thống theo lịch. |
| FINISHED | Công bố sản phẩm, kết quả, top 3 bid cuối và diễn biến phiên. |

- Mỗi người có một lượt đăng bán một Clue, được sửa giá hoặc hủy tin; mỗi Clue chỉ bán thành công một lần, không bán lại. Coin mua Clue chuyển trực tiếp từ người mua sang người bán và không hoàn vì thông tin không hữu ích.
- Người chơi được sửa bid đến hết giai đoạn BID; chỉ **bid xác nhận cuối cùng** của mỗi người được xét. Server điều chỉnh Coin khóa theo mức bid. Bid cao nhất đạt giá sàn sẽ thắng; hòa giá thì bid cuối được server ghi nhận sớm hơn thắng. Không có bid đạt yêu cầu thì `UNSOLD`.

## 4. Đấu giá livestream (LIVESTREAM)

- Admin tạo và làm host phiên phát camera, micro trực tiếp; mỗi phòng nhận tối đa **10 kết nối người xem**. Một phiên có nhiều sản phẩm, mỗi lượt dành một đơn vị hàng. Host chọn sản phẩm, giới thiệu rồi mở đấu, có thể đưa món chưa bán lên đấu lại.
- Bid đầu tiên phải đạt giá khởi điểm; các bid sau phải cao hơn giá dẫn đầu. Mỗi bid hợp lệ khóa Coin và đặt lại đồng hồ **5 giây**. Hết giờ, server tự chốt người thắng, thanh toán và lưu món đã mua. Host phải chờ chốt lượt đang có bid trước khi đổi sản phẩm hoặc kết thúc phiên.
- Khi host mất kết nối, phiên tạm dừng và giữ thời gian còn lại. Host kết nối lại, kiểm tra camera rồi chủ động tiếp tục; quá 5 phút không tiếp tục thì phiên kết thúc, các món chưa bán được đóng và Coin đang giữ được giải phóng. Các giao dịch đã hoàn tất vẫn giữ nguyên.
- Chế độ tùy chọn **Săn vé bí ẩn** có sản phẩm bí mật và nhiệm vụ riêng được giao ngẫu nhiên cho từng người. Mua, thanh toán đủ hai sản phẩm khác nhau phù hợp nhiệm vụ sẽ nhận một vé không chuyển nhượng. Sau khi bán hết hàng thường và có người nhận vé, hệ thống tiết lộ món bí mật; host mở vòng cuối, chỉ người có vé được bid, những người khác vẫn xem và chat.

## 5. Coin và kết quả

- Server kiểm tra bid, thời hạn, quyền tham gia và số dư; lưu bid, khóa/mở khóa Coin và quyết toán nhất quán để tránh xử lý trùng khi có yêu cầu đồng thời.
- Khi bán thành công (`SOLD`), Coin khóa của người thắng được thanh toán vào ví hệ thống; các khoản khóa còn lại được giải phóng. Nếu `UNSOLD`, toàn bộ Coin đang khóa cho lượt đấu được mở khóa. Tiền mua Clue là giao dịch riêng giữa người chơi.

## 6. Realtime, lịch sử và bảng xếp hạng

- Mỗi phòng đồng bộ trạng thái, bid được phép công khai, chat và kết quả tới đúng người tham gia. Server giới hạn độ dài, tần suất chat và lọc dữ liệu bí mật trước khi trả qua API hoặc realtime.
- Khi reconnect, hệ thống xác thực lại, cho client vào lại phòng theo quyền và đồng bộ trạng thái mới nhất, gồm bid, Clue hoặc nhiệm vụ riêng đã lưu.
- Sau phiên, người dùng xem kết quả và lịch sử giao dịch. Replay NORMAL dựng lại bid, chat và kết quả; diễn biến BLIND gồm các lần đặt/sửa bid và giao dịch Clue kèm nội dung, không hiển thị chat. Livestream có tổng kết phiên và các món đã mua.
- Bảng xếp hạng tổng hợp số phiên tham gia, số lần thắng và tỷ lệ thắng; xếp theo số lần thắng rồi tỷ lệ thắng. Bảng công khai chỉ tính phiên PUBLIC đã kết thúc; người chơi xem thêm thành tích PRIVATE và tổng Coin mua sản phẩm của chính mình.
