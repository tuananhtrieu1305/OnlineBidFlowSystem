# Cấu hình phiên đấu giá — Phạm Bá Tiến

Admin mở **Phiên đấu giá → Tạo phiên**, chọn sản phẩm, loại NORMAL/BLIND, quyền PUBLIC/PRIVATE, giá và lịch; xem lại rồi xác nhận. Có thể tạo nhiều phiên từ cùng một sản phẩm. Giao diện dùng nền trắng ngà/xanh cổ vịt như phần sản phẩm.

## API và quyền

Tất cả endpoint dưới `/api/admin/auctions` yêu cầu session ADMIN. POST/PUT cần CSRF. Không dùng DTO Admin cho public discovery hoặc socket.

| Method | Path | Ý nghĩa |
| --- | --- | --- |
| GET | `/api/admin/auctions` | Tìm theo q, status, auctionType, accessType; page từ 0, size 1–100 |
| GET | `/api/admin/auctions/{id}` | Chi tiết Admin, ETag và điều kiện sửa |
| POST | `/api/admin/auctions` | Tạo UPCOMING; trả 201, Location và ETag |
| PUT | `/api/admin/auctions/{id}` | Thay cấu hình; bắt buộc If-Match từ chi tiết |

Ví dụ POST:

```json
{
  "productId": "12",
  "productVersion": "\"etag-tu-api-san-pham\"",
  "auctionType": "NORMAL",
  "accessType": "PRIVATE",
  "startingPrice": "1000",
  "minBidIncrement": "100",
  "maxParticipants": 20,
  "startTime": "2030-01-02T10:00:00+07:00",
  "endTime": "2030-01-02T11:00:00+07:00"
}
```

PUT dùng cùng cấu hình nhưng bỏ productId/productVersion; không được đổi sản phẩm sau khi tạo. ID và Coin là chuỗi số nguyên dương trong giới hạn signed BIGINT; NORMAL kiểm tra cả tràn giá + bước giá. BLIND bắt buộc minBidIncrement=null. PUBLIC bắt buộc maxParticipants=null; PRIVATE cho phép null hoặc số nguyên dương. Server từ chối trường lạ, tự lấy createdBy từ session, tự tạo trạng thái/kết quả/mã phòng. Mã PRIVATE ngẫu nhiên 12 ký tự, được giữ khi sửa PRIVATE → PRIVATE; đổi sang PUBLIC sẽ xóa mã. Danh sách không trả mã phòng, giá sàn hoặc ETag chi tiết.

Frontend nhập giờ địa phương và gửi UTC. API yêu cầu offset/Z; database lưu DATETIME theo UTC, độ chính xác microsecond. Các trường ngày Auction/AuctionParticipant dùng JDBC LocalDateTime trực tiếp để tránh JVM Asia/Saigon làm lệch giờ qua Timestamp. Không tự đổi dữ liệu lịch sử đã có. Tham khảo [Hibernate direct Java Time JDBC mapping](https://docs.hibernate.org/orm/6.5/javadocs/org/hibernate/cfg/MappingSettings.html).

## Điều kiện sửa và giao dịch đồng thời

Chỉ sửa khi UPCOMING, chưa đến giờ bắt đầu, chưa có participant, bid, chat hoặc giao dịch Coin. ETag tránh Admin ghi đè bản sửa của nhau. Create khóa product và kiểm tra productVersion cùng transaction, tránh tạo phiên từ thông tin sản phẩm cũ.

`JpaRoomDataGateway.authorizeAndRegister` khóa cùng hàng auction mà update sử dụng, kiểm tra mã/sức chứa và ghi participant trong một transaction READ_COMMITTED. `RoomMembershipService` chỉ cập nhật membership bộ nhớ sau khi gateway hoàn tất. Hai người tranh chỗ cuối chỉ một người được vào; reconnect không tạo thêm participant. Không gọi riêng validateJoin rồi ensureParticipant trong đường runtime. Default gateway phục vụ fake/probe không thay thế bảo đảm transaction của JPA.

Module bid/lifecycle của nhóm khi ghi dữ liệu phải phối hợp khóa hàng auction trước khi đổi trạng thái/ghi hoạt động, theo thứ tự auction → wallet. Phần cấu hình không quyết định winner, không sửa Coin, không broadcast bid và không có scheduler. Phiên quá giờ vẫn UPCOMING cho đến khi lifecycle được tích hợp; UI khóa sửa và thông báo chờ cập nhật.

## Lỗi và trải nghiệm

- 400: input/filter/ID không hợp lệ; 401/403: xác thực/quyền/CSRF.
- 404: phiên hoặc sản phẩm không tồn tại.
- 409: START_TIME_PASSED, START_TIME_REACHED, AUCTION_HAS_ACTIVITY hoặc AUCTION_NOT_EDITABLE.
- 412: PRODUCT_CHANGED/AUCTION_CHANGED; tải dữ liệu mới trước khi gửi lại.
- 428: thiếu If-Match. Timeout/5xx: kết quả chưa chắc chắn; kiểm tra danh sách, không tự retry tạo phiên.

Form có bước xác nhận, cảnh báo rời trang khi chưa lưu, trường theo loại phiên, mã phòng ẩn mặc định và nút hiện/sao chép. Lưu thành công chỉ sau phản hồi server.

## Kiểm thử

- `mvn -Pregistration-it verify`: dùng MySQL kiểm thử riêng với REGISTRATION_TEST_DATABASE=true, không chạy trên DB làm việc.
- `mvn -Pregistration-it,auction-coverage -Dit.test=AuctionConfigurationIT verify`: coverage cấu hình, ngưỡng line 80%.
- `npm run test:coverage` và `npm run test:e2e`: validation, bốn tổ hợp, sửa xung đột, dirty form, Electron regression.
- `playwright.auctions-live.config.ts`: cần build VITE_API_BASE_URL=http://localhost:18080, DB_PORT=33308, container onlinebidflow-registration-test; kiểm tra session/API/MySQL/WebSocket thật. Build lại frontend mặc định sau khi chạy.

Không thay schema hoặc reset dữ liệu MySQL trong lần triển khai này.
