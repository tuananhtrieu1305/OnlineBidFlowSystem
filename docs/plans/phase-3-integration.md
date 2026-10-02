# Phase 3 — Tích hợp phần Tiến với đấu giá và realtime

Ngày 02/10/2026. Baseline `2c350bb`, branch `pbtien`.

Trạng thái: đã triển khai lớp tích hợp trong phạm vi dưới đây; kết quả tại `../reviews/phase-3-report.md`. Luồng bid/scheduler/UI của cả nhóm còn chờ module tương ứng.

## Phạm vi dựa trên code hiện tại

Repo có service Coin, cấu hình phiên, room/chat/snapshot/replay và publisher socket; chưa có service bid NORMAL/BLIND hoặc scheduler. Phase này triển khai điểm nối nội bộ, test bằng caller fixture và tài liệu bàn giao. Không coi fixture là nghiệp vụ đấu giá đã hoàn thành. Giữ dữ liệu làm việc và schema nguyên trạng.

NORMAL/BLIND vẫn sở hữu xác thực người đặt bid, điều kiện tham gia, bước giá, một bid kín/người, thời gian, chọn winner và xử lý hòa giá. Lớp tích hợp không chọn winner, không nhận trực tiếp quyết định từ client, không có endpoint thanh toán hoặc kết thúc phiên.

## Thiết kế và trình tự

1. Thêm `auction/integration/AuctionWalletIntegration`: bắt buộc outer transaction READ_COMMITTED. Caller khóa auction trước khi đọc bid, kiểm tra nghiệp vụ và lưu/flush bid. Adapter nhận ID bid đã lưu; kiểm tra bid thuộc phiên và đúng loại, gọi service ví rồi phát domain event bất biến. NORMAL nhận previous leader và next minimum do module tính; BLIND chỉ gửi xác nhận đến chủ bid.
2. Kết quả do caller quyết định. Adapter thanh toán/hoàn Coin và ghi SOLD/UNSOLD trong cùng transaction, theo thứ tự khóa auction → wallets → ledger. SOLD cần bid của winner khớp giá và đạt giá sàn. Lặp cùng kết quả kiểm tra ledger nhưng không phát lại sự kiện; kết quả xung đột bị từ chối. Caller không sửa managed Auction sau JDBC; refresh nếu cần.
3. Listener AFTER_COMMIT chuyển domain event sang payload realtime hiện có. Rollback không gửi sự kiện; socket lỗi không biến một commit thành thất bại nghiệp vụ hoặc làm dừng fan-out đến người khác. Không ghi bid kín vào log.
4. Test MySQL riêng: NORMAL đổi leader, BLIND giữ riêng, thiếu Coin rollback bid/ledger, rollback kết quả, SOLD/UNSOLD và lặp/concurrent finish, gọi sai transaction/type/bid, snapshot/replay đọc dữ liệu đã commit. Test publisher đảm bảo một socket hỏng không chặn socket còn lại.
5. Chạy regression backend/MySQL, coverage riêng package tích hợp >=80% dòng; build frontend để bảo đảm không ảnh hưởng contract. Đối soát DB làm việc chỉ đọc, dừng DB test sau khi xong. Ghi báo cáo và hướng dẫn gọi adapter.

## Các giới hạn cần thể hiện rõ

- Socket là thông báo best-effort sau commit, không phải hàng đợi bền vững. Crash giữa commit và gửi được phục hồi bằng snapshot/replay; chưa có outbox/exactly-once. Client phải tải lại snapshot khi reconnect và không tự retry bid sau timeout.
- Contract realtime hiện có vẫn giữ nguyên kiểu dữ liệu. Chuẩn hóa BIGINT thành chuỗi cho toàn bộ module realtime là thay đổi protocol cần phối hợp riêng.
- Các giao dịch seed cũ chưa đủ căn cứ sửa vẫn là ngoại lệ Phase 2.
- Luồng người dùng đặt bid end-to-end chỉ hoàn thành khi module NORMAL/BLIND và UI phòng đấu giá gọi adapter này. Không tạo scheduler tự quét dữ liệu seed cũ trong lượt tích hợp.

## Tiêu chí bàn giao

Plan, adapter và listener có test RED/GREEN; Coin/result không commit riêng lẻ; không broadcast bid BLIND; lỗi socket không gây phản hồi thất bại giả sau commit; tài liệu chỉ rõ caller thật còn thiếu. Commit tại branch hiện tại, không push/merge.
