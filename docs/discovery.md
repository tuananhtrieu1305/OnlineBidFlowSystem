# Khám phá phiên đấu giá

Khách, USER và ADMIN có thể đọc danh sách/chi tiết các phiên PUBLIC. Đây là màn hình tra cứu; chưa có nút gửi bid, join room hoặc tự chạy scheduler.

## API

- `GET /api/discovery/auctions?q=&auctionType=&status=&page=0&size=12`
- `GET /api/discovery/auctions/{id}`

Tìm tên sản phẩm theo chuỗi con, coi `%`, `_`, `!` là ký tự thường. `auctionType`: trống/NORMAL/BLIND; `status`: trống/UPCOMING/RUNNING/SOLD/UNSOLD. `q` tối đa 255 ký tự sau strip; page không âm, size 1–100, offset không vượt INT_MAX. ID phải là số nguyên dương trong BIGINT signed. Tham số sai trả 400; phiên không tồn tại hoặc PRIVATE cùng trả 404.

Danh sách sắp xếp ID giảm dần, có `items`, `page`, `totalPages`, `totalElements` (chuỗi) và `serverNow` UTC. Truy vấn đếm/danh sách cùng transaction read-only REPEATABLE_READ; phân trang offset không cam kết snapshot giữa hai lần gọi khi có phiên mới.

Mỗi phiên trả ID dạng chuỗi, loại, trạng thái, startTime/endTime UTC và thông tin cơ bản sản phẩm. Chi tiết bổ sung description/quantity. NORMAL trả startingPrice/currentPrice/minBidIncrement dạng chuỗi; currentPrice là MAX bid đã lưu, hoặc startingPrice khi chưa có bid. Đây không phải giá kết quả SOLD. BLIND không trả các trường giá này, leader hoặc bid người khác. Không trả estimatedPrice, roomCode, createdBy hay serialize entity/Admin DTO.

Không cung cấp thống kê lịch sử ở discovery; thống kê BLIND và own bid thuộc snapshot/phòng của module tương ứng. NORMAL không nhận thống kê ở API này.

## Giao diện

Trang chủ có tìm kiếm, bộ lọc và phân trang. Tên sản phẩm mở `#/auctions/{id}`. Có loading, empty, lỗi/retry, ảnh dự phòng; request cũ bị hủy khi đổi bộ lọc hoặc rời trang. Số Coin định dạng bằng BigInt; ngày hiển thị theo múi giờ thiết bị.

Dữ liệu tải khi mở trang/đổi bộ lọc; danh sách có nút Làm mới. Trang chi tiết ghi rõ chưa mở trả giá và dữ liệu không được cập nhật realtime. Không giả lập bid thành công hoặc trạng thái phiên.

## Kiểm chứng

- `DiscoveryIT`: guest/public/private, DTO BLIND, giá >2^53, lọc/trang/thứ tự, ký tự tìm kiếm, biên tham số và UTC.
- `discovery.spec.ts`: Electron với API mô phỏng, chi tiết BLIND, retry, cửa sổ 820px.
- `discovery-live.spec.ts`: fixture tạo qua API Admin thật → guest tìm/xem/reload PUBLIC → lọc BLIND rỗng → PRIVATE 404.
- Profile `discovery-coverage` yêu cầu ít nhất 80% dòng của module discovery; kết quả thực tế ở [báo cáo bàn giao](reviews/tien-completion.md).
