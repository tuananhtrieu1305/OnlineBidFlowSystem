# Tích hợp NORMAL với pbtien và tuananh

Nhánh làm việc local: codex/integrate-normal.

- Nền pbtien: d5fe7a46aea010453e527c87f82cf4059135e366.
- tuananh: d7657b49aaa6ff7c376d875a135e54f54ca40474 đã là ancestor của pbtien;
  không merge realtime lần hai.
- Phần NORMAL local cũ đã được sao lưu bằng Git stash với mô tả
  `Backup local NORMAL before integrating pbtien and tuananh`.

Giữ các chức năng có sẵn của pbtien: đăng ký, login/logout session + CSRF,
ví USER/nạp Coin/lịch sử, quản trị người dùng, ví SYSTEM, sản phẩm/ảnh,
cấu hình phiên và Khám phá. Giữ realtime của tuananh: room, chat, snapshot,
reconnect, replay backend; không sao chép lại security hoặc entity/repository.

NORMAL được đặt trong package auction.normal. REST admission gọi RoomAccessService;
việc chuyển Coin và chốt phiên gọi AuctionWalletIntegration/WalletTransferService.
Nhận sự kiện realtime bằng broadcaster AFTER_COMMIT có sẵn. Dùng Clock UTC chung
và AuctionStartScheduler chung; scheduler NORMAL chỉ chốt phiên đến hạn.

Frontend NORMAL dùng AuthProvider/login chung, cookie session/CSRF và API ví chung.
Các route /normal và /normal/:id nằm trong sidebar có sẵn, dùng nền trắng ngà,
xanh cổ vịt và font Be Vietnam Pro của dự án. Ảnh dùng bộ kiểm tra product image chung.
PRIVATE cần mã phòng cho socket khi reconnect. Chat được xác nhận theo requestId.

Không thay đổi schema hoặc reset DB thực. Seed Alice đang thiếu ledger giữ Coin của
phiên #5; dịch vụ ví sẽ trả WALLET_LEDGER_INCONSISTENT thay vì chấp nhận dữ liệu lệch.
Chi tiết: reviews/wallet-reconciliation.md và ../backend/API.md.

Kiểm thử backend dùng H2 MySQL mode cho NORMAL và unit/socket tests có sẵn.
Kiểm thử Electron giả lập API và WebSocket; không thay thế kiểm thử MySQL triển khai.
Các test session quản trị được tải lại sau khi cài mock để tránh yêu cầu khởi động
chạy trước fixture; test đổi tài khoản chỉ đổi mock session sau khi login thành công.

## Kết quả kiểm tra local ngày 2026-10-10

- Backend: mvn verify thành công với 85 test; lần chạy NormalApiTest sau bổ sung
  kiểm tra CSRF/ledger và rollback sau cập nhật ví thành công 10/10 (tổng 86 test).
- Frontend: npm test 41/41; npm run build thành công.
- Electron: npx playwright test 29/29. NORMAL kiểm tra login/session/CSRF,
  PRIVATE sai/đúng mã, chat, sự kiện vượt giá cập nhật giá/ví trong 2 giây,
  từ chối bid, mất kết nối và logout.
- Kiểm tra diff không có lỗi khoảng trắng.
- Chưa kiểm thử với MySQL thực của người dùng; DB thật không bị sửa.


## Danh sách sản phẩm và vào phòng NORMAL

- `/normal` hiển thị thẻ sản phẩm từ DB, ảnh, trạng thái, thời gian, bộ lọc PUBLIC/PRIVATE và tìm kiếm.
- PUBLIC: nút Vào phòng gọi API tham gia (kiểm tra Coin) rồi mở `/normal/:id`.
- PRIVATE đang mở: nhập mã trong hộp thoại; server kiểm tra mã cả khi đã là thành viên. Mã được chuyển trong state của router cho kết nối realtime, không lưu vào localStorage.
- Phiên đã kết thúc mở kết quả theo quyền xem hiện có; PRIVATE chưa tham gia không được xem giá và lịch sử.
- Ảnh hỗ trợ đường dẫn upload của backend và `https://images.unsplash.com` dùng trong seed; ảnh lỗi hoặc thiếu hiển thị placeholder.
- USER chỉ tham gia/đặt giá. Tạo và sửa phiên vẫn thuộc ADMIN qua trang quản trị và API `/api/admin/auctions`.


## Nhịp đấu giá NORMAL và BXH cuối phiên (2026-10-27)

- Form ADMIN NORMAL thêm thời lượng mặc định 5 phút (tính endTime từ startTime), ngưỡng gia hạn, số giây phản hồi và ngưỡng BXH. Có thể nhập giờ kết thúc trực tiếp.
- `normalTiming`: `{closingWindowSeconds:30, extensionSeconds:30, leaderboardSeconds:60}`; mỗi giá trị nguyên 1–3600, extensionSeconds >= closingWindowSeconds. Chỉ lưu/sửa theo điều kiện sửa phiên cũ (chưa bắt đầu/chưa có hoạt động).
- Bảng bổ sung `auction_normal_timing` được tạo nếu thiếu khi khởi động. Không reset DB. Các phiên không có cấu hình dùng 30/30/60 giây.
- Bid hợp lệ trong ngưỡng cuối phiên cập nhật `end_time = max(end_time, thời_điểm_bid + extensionSeconds)` cùng transaction khóa phiên, bid và ví. Bid lỗi rollback toàn bộ, không gia hạn. Sự kiện giá AFTER_COMMIT khiến client tải lại thời hạn mới.
- UI thêm thông báo bid/vượt giá/gia hạn, đồng hồ lớn, vị trí người chơi, nút điền giá nhanh có nhãn và bảng một dòng/người theo giá cao nhất. BXH mở trong chặng cuối và giữ đến khi kết thúc, kể cả sau khi gia hạn; vào lại phòng dùng hạn hiện tại.
- Kết quả chính thức chỉ dựa trên SOLD/UNSOLD từ server; có màn hình người thắng/giá thắng/thanh toán Coin.
- Không chạy test hoặc khởi động/build frontend theo yêu cầu người dùng; backend được biên dịch và chạy với `-Dmaven.test.skip=true`.


## Phòng toàn màn hình và ba nhịp (2026-10-28)

- `/normal/:id` ra ngoài AppLayout; chỉ phòng đấu giá, nút × về danh sách, không sidebar. Header chứa người chơi/ví; đồng hồ nhịp trái, đồng hồ phiên phải. Desktop ba cột: sản phẩm/diễn biến, đặt giá/BXH, chat. Chỉ danh sách dài cuộn nội bộ. Màn nhỏ xếp lại để tránh ép chữ.
- Nhịp theo tỷ lệ 3:2:1 của thời lượng ban đầu (6 phút => 3/2/1 phút; 5 phút => 2:30/1:40/0:50). Không loại người, không đổi bước giá, không reset giá/khóa Coin. Chỉ server SOLD/UNSOLD mới chốt thắng/thanh toán.
- `scheduledEndsAt` trong snapshot là hạn dự kiến ban đầu. Cột `auction_normal_timing.scheduled_end_time` được thêm nếu thiếu khi backend chạy; cấu hình mới lưu mốc này ngay. Phiên cũ chưa có mốc dùng hạn hiện tại và cố định trước khi gia hạn tiếp. Không tái dựng được hạn gốc của lần gia hạn trước bản cập nhật.
- Mốc kết thúc nhịp 1/2 không đổi khi gia hạn nhịp 3. Đồng hồ phiên và nhịp 3 cùng dùng endsAt hiện tại.
- BXH live luôn có ở cột giữa; khi chuyển nhịp tự mở tổng kết nhịp vừa qua 10s rồi về live. Tab Nhịp 1/2/3 xem lại xếp hạng cộng dồn tính tới mốc kết nhịp (theo timestamp bid server), không dùng giá phát sinh sau mốc đó.
- Giữ thông báo bid/vượt giá/gia hạn. Chat đã nhận vẫn hiển thị khi phiên đóng, chuyển sang chỉ đọc. Không chạy test hay khởi động/build frontend theo yêu cầu trước đó.


### Ổn định kích thước phòng và tăng cỡ chữ

- Cột giữa dùng grid với vùng đặt giá có chiều cao cố định theo viewport; BXH dùng phần còn lại với min-height:0. Grid thân phòng có hàng minmax(0,1fr), không lấy chiều cao tối thiểu của bảng dữ liệu làm chiều cao khung.
- Bảng lịch sử/BXH/chat có vùng cuộn riêng, chiều cao giới hạn, scrollbar-gutter:stable và thanh cuộn luôn có chỗ. Input dùng flex-basis:0, width:0, height cố định để số nhập không làm nở khung.
- Dành sẵn chiều cao cho phản hồi bid và tổng kết nhịp; luật phiên là lớp nổi bên trong, không đẩy BXH xuống. Table-layout:fixed và ellipsis ngăn tên/giá dài làm rộng cột.
- Tăng chữ bảng lên 14px, chat 15px, nhãn chính 13–16px; giảm bo góc, bóng và chip trang trí. Chỉ thay frontend; không cần khởi động lại backend. Không chạy test/build hoặc khởi động frontend theo yêu cầu trước đó.


### Tạo phiên demo nhanh trong ADMIN

- Sidebar Đấu giá thường chỉ hiện cho USER; ADMIN quản lý ở Phiên đấu giá.
- Nút Tạo phiên demo nhanh nằm ngay dưới Tạo phiên: chọn sản phẩm có số lượng trong trang đầu danh sách, ưu tiên có ảnh, lấy lại productVersion rồi gọi API tạo phiên ADMIN có sẵn.
- NORMAL/PUBLIC, khởi điểm 1000 Coin, bước 100, bắt đầu sau 30s theo giờ server, thời lượng 3 phút (90/60/30s), quy tắc gia hạn 30/30, nổi bật BXH 60s cuối. Thành công mở chi tiết ADMIN kèm mã phiên.
- Chỉ tạo khi người dùng bấm nút. Không thêm sản phẩm, đổi dữ liệu sản phẩm, tạo bid/tài khoản/Coin giả hoặc sửa phiên đang có. Khi kết quả POST không chắc chắn, khóa nút và yêu cầu xem lại danh sách, không retry tự động.
- Chỉ thay frontend, không cần restart backend. Không chạy test hoặc khởi động/build frontend theo yêu cầu trước đó.


### Chúc mừng người thắng

- Khi snapshot server xác nhận SOLD và có winner/winningPrice, mở native dialog với nền đen, tên, avatar chữ cái theo username, sản phẩm và giá thắng. Chưa có trường ảnh avatar người dùng nên không lấy ảnh ngoài hoặc tạo ảnh giả.
- Người thắng thấy “Bạn đã thắng!”, người khác thấy “Chúc mừng người thắng!”. Không mở chỉ vì đồng hồ về 0 và không mở với UNSOLD.
- Confetti CSS chạy một lần; tôn trọng prefers-reduced-motion. Đóng bằng ×, Escape hoặc Xem kết quả; có nút Xem người thắng để mở lại. Polling không tự mở lại sau khi người dùng đóng.
- Chỉ sửa frontend; không chạy test/build hay khởi động frontend theo yêu cầu trước đó.
