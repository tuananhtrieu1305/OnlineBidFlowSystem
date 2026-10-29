# Thống kê sản phẩm cho Admin

Trang `/admin/products/{id}` hiển thị thống kê ngay dưới thông tin sản phẩm. Dữ liệu được đọc từ `GET /api/admin/products/{id}/statistics?page=0`; chỉ tài khoản ADMIN có quyền gọi. Không cần bảng hoặc migration mới.

## Quy tắc tính

- Tổng phiên gồm UPCOMING, RUNNING, SOLD và UNSOLD của đúng sản phẩm. Tỷ lệ bán thành công = SOLD / (SOLD + UNSOLD); chưa có phiên kết thúc thì hiển thị `—`.
- Giá gần nhất, trung bình, thấp nhất, cao nhất, trung vị và biểu đồ chỉ dùng phiên SOLD có `finished_at` và `winning_price`. Trung vị chỉ hiển thị khi có ít nhất 5 phiên SOLD. Giá trung bình và trung vị được làm tròn về Coin nguyên.
- Kết quả theo NORMAL và BLIND được tách riêng. Bảng lịch sử chỉ gồm SOLD/UNSOLD, sắp theo `finished_at` mới nhất rồi `id`, 10 dòng/trang. Biểu đồ dùng 10 phiên SOLD gần nhất theo cùng thứ tự thời gian.
- Giá ước tính lấy từ API chi tiết sản phẩm đã dành cho Admin; giao diện tính chênh lệch giữa giá bán trung bình và giá ước tính. API thống kê không trả `estimatedPrice`, giá sàn, bid hay người thắng.
- UNSOLD chưa có cột lý do, nên không phân loại phiên thiếu người và phiên không đạt giá sàn.

Thống kê người chơi trong BLIND giữ quy tắc riêng: chỉ dùng các phiên SOLD kết thúc **trước khi** phiên hiện tại bắt đầu. API thống kê Admin không thay thế hoặc mở rộng dữ liệu trả cho người chơi.

## Kiểm thử

`ProductStatisticsIT` kiểm tra phép tính, dữ liệu rỗng, phân trang và quyền truy cập trên MySQL kiểm thử riêng (`REGISTRATION_TEST_DATABASE=true`). `product-statistics.spec.ts` kiểm tra hiển thị và chuyển trang trong Electron.
