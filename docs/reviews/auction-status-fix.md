# Sửa trạng thái và danh sách PUBLIC — 03/10/2026

Người dùng cho phép bổ sung tự mở phiên và cập nhật backend Docker local; không push hoặc triển khai bên ngoài.

## Nguyên nhân và bản sửa

- Backend 8080 cũ chưa có API discovery công khai, GET không đăng nhập trả 401. Đã build và thay riêng container backend, giữ MySQL và volume ảnh.
- Thiếu tự chuyển UPCOMING → RUNNING. Scheduler mỗi giây mở các phiên có start_time <= giờ UTC server < end_time, bằng UPDATE có điều kiện và row lock. Không xử lý winner/settlement hoặc sửa ví seed.
- Trang Admin/User chỉ tải một lần. Bổ sung polling mỗi 10 giây và tải lại khi cửa sổ được focus/hiển thị; hủy request và listener khi rời trang. Không refresh form chỉnh sửa.
- Phiên quá hạn chưa được kết toán hiển thị “Đã hết giờ · Chờ kết quả” theo serverNow; status DB/bộ lọc không bị đổi giả thành SOLD/UNSOLD.

## Kiểm chứng

- RED: hai Electron tests tái hiện dữ liệu không đổi khi focus. Test mới cho service chưa tồn tại thất bại biên dịch đúng nguyên nhân.
- 73 backend unit tests đạt. 52 integration tests hiện hữu đạt; hai AuctionStartIT đạt sau khi sửa fixture SOLD để đáp ứng check constraint. Có kiểm tra đủ NORMAL/BLIND × PUBLIC/PRIVATE, start đúng biên, future/expired/finished, idempotency và không ghi ledger.
- 41 frontend unit tests đạt; các helper được instrument có coverage 100%, không phải coverage toàn bộ UI.
- JaCoCo xác nhận hai lớp lifecycle mới đạt 4/4 dòng thực thi; các nhánh thời gian trong SQL được kiểm chứng bằng MySQL integration tests.
- 4 Electron tests Admin/discovery đạt: tạo bốn loại phiên, conflict, giữ form chưa lưu, cập nhật list/detail.
- 1 live Electron flow dùng MySQL riêng 33308/backend18080 đạt: Admin tạo/sửa lịch qua API, guest thấy PUBLIC chuyển UPCOMING → RUNNING tự động, PRIVATE vẫn 404.
- Build/typecheck, đóng gói Windows và smoke test executable đạt. Đã trả source build và executable về API8080.
- Kiểm tra executable với API8080 thật, không mock: #11 Desk Lamp và #12 Espresso Machine hiện “Đang diễn ra” ở trang user. API công khai và DB đều trả RUNNING. Ảnh `.cache/auction-local-fixed.png`.
- Trước/sau cập nhật: 11 ví, tổng available 69450, locked 5650; 14 giao dịch ledger. Không thay đổi các số này.
- Audit trước commit: runtime 0; toàn bộ dependency vẫn có 13 high đã ghi trong báo cáo bàn giao trước, không phát sinh nâng cấp dependency ở bản sửa này.

## Còn ngoài bản sửa

Nhận bid, chọn người thắng, scheduler kết thúc/thanh toán và room UI vẫn cần nối với module của nhóm. Bản sửa không coi việc hết giờ là đủ căn cứ để kết toán hoặc sửa lịch sử tiền.

Bản local: `frontend/release/win-unpacked/OnlineBidFlow.exe`. Cần giữ cả thư mục win-unpacked khi sao chép.
