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


## Phòng toàn màn hình và các nhịp đấu giá (2026-10-28)

- `/normal/:id` ra ngoài AppLayout; chỉ phòng đấu giá, nút × về danh sách, không sidebar. Header chứa người chơi/ví; đồng hồ nhịp trái, đồng hồ phiên phải. Desktop ba cột: sản phẩm/diễn biến, đặt giá/BXH, chat. Chỉ danh sách dài cuộn nội bộ. Màn nhỏ xếp lại để tránh ép chữ.
- Nhịp ban đầu được chia theo tỷ lệ 3:2:1 (được thay bằng hai nhịp bằng nhau ở cập nhật 2026-10-28 bên dưới). Không loại người, không đổi bước giá, không reset giá/khóa Coin. Chỉ server SOLD/UNSOLD mới chốt thắng/thanh toán.
- `scheduledEndsAt` trong snapshot là hạn dự kiến ban đầu. Cột `auction_normal_timing.scheduled_end_time` được thêm nếu thiếu khi backend chạy; cấu hình mới lưu mốc này ngay. Phiên cũ chưa có mốc dùng hạn hiện tại và cố định trước khi gia hạn tiếp. Không tái dựng được hạn gốc của lần gia hạn trước bản cập nhật.
- Mốc kết thúc nhịp 1/2 không đổi khi gia hạn nhịp 3. Đồng hồ phiên và nhịp 3 cùng dùng endsAt hiện tại.
- BXH live luôn có ở cột giữa; khi chuyển nhịp tự mở tổng kết nhịp vừa qua 10s rồi về live. Tab lịch sử nhịp xem lại xếp hạng cộng dồn tính tới mốc kết nhịp (theo timestamp bid server), không dùng giá phát sinh sau mốc đó.
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


### Tinh gọn phòng theo UI/UX Pro Max

- Áp dụng skill `.agents/skills/ui-ux-pro-max/SKILL.md`: tra cứu UX chữ dễ đọc/tương phản và hướng dẫn React/ARIA, dùng quy tắc khung ổn định/focus; giữ React 18 và không thêm thư viện.
- Gộp header tài khoản/ví và đồng hồ thành một toolbar, bỏ logo và thanh nhịp trang trí lặp. Hai đồng hồ cùng header, không lặp 00:00 khi đã chốt. Desktop dùng hai cột: khung ảnh lớn riêng bên trái, đặt giá và dữ liệu bên phải.
- Chuyển lịch sử sang tab Lượt trả cạnh Xếp hạng; không bỏ lịch sử hoặc tổng kết nhịp. Giữ khung giá, thông báo và vùng dữ liệu có chiều cao giới hạn, thanh cuộn nội bộ với gutter ổn định, không tự nở khi nhập số/thêm dữ liệu.
- Chat mặc định thu gọn, mở từ nút Chat trên header thành khung nổi không modal; không làm co giãn các cột. Giữ socket và nội dung soạn khi thu gọn; đếm tin mới, hỗ trợ aria-expanded/aria-controls, nút thu gọn và Escape trả focus về nút mở. Không đếm lịch sử tải lần đầu thành tin chưa đọc.
- Chỉ sửa giao diện, không đổi API/DB/luật bid/nhịp/gia hạn/thanh toán/hiệu ứng người thắng. Không chạy test/typecheck/build hoặc khởi động frontend theo yêu cầu người dùng; chỉ rà source.

## Chia phiên thành nhịp đầu và nhịp cuối (2026-10-28)

- Thời lượng dự kiến chia đều thành hai nhịp. Khi chuyển sang nhịp cuối, giao diện phủ đen ngắn với biểu tượng “Nhịp cuối”.
- Nhịp cuối kết thúc theo hạn server hiện tại. Bid hợp lệ trong cửa sổ chốt giá tiếp tục gia hạn deadline theo `extensionSeconds`; đồng hồ nhịp cuối vì vậy được cộng lại để người chơi kịp phản hồi.
- Không thay đổi luật bid, bước giá, số dư Coin, API hoặc database.


### Thu gọn thanh cuộn và căn lại header

- Ẩn scrollbar chrome ở khung đặt giá, BXH và lịch sử; vẫn dùng overflow:auto trong khung giới hạn, cuộn chuột/trackpad và bàn phím. Thêm tabindex và focus ring cho vùng cuộn để không mất khả năng thao tác khi không thấy scrollbar.
- Header desktop cao 88px: đồng hồ có độ rộng giới hạn, bỏ hai đường chia quanh đồng hồ; avatar/tên, hai số dư, Chat và nút thoát được căn giữa cùng hàng. Gỡ dấu kết nối màu cạnh tên (trạng thái kết nối vẫn có trong chat), giản lược nhãn khi phiên kết thúc.
- Chỉ sửa frontend, không chạy test/build hoặc khởi động frontend theo yêu cầu trước đó.


### Biểu đồ giá theo thời gian

- Thêm tab mặc định Biểu đồ giá bên cạnh Xếp hạng và Lượt trả; khi hết nhịp vẫn tự mở tổng kết BXH theo luồng hiện có.
- SVG đường bậc thang: Y là Coin, X là thời điểm server của bid; không nội suy giá tăng giữa các bid. Đường nền là giá khởi điểm hoặc mức ngay trước cửa sổ gần nhất, không tạo bid giả.
- Mặc định Gần nhất: tối đa 60 bid, khung thời gian quanh các lượt đó. Toàn phiên dùng thời gian bắt đầu đến snapshot server hoặc hạn chốt. Lịch sử lớn rút gọn vertices đường SVG nhưng giữ dữ liệu đọc/nhóm avatar và bảng Lượt trả đầy đủ.
- Avatar chữ cái người trả được đặt dưới mốc X. Gộp các bid cách nhau ít hơn 46px thành một avatar kèm số lượt, hover/focus hiển thị tên/giá/thời gian; bấm hoặc mũi tên lên/xuống để đổi lượt trong nhóm, trái/phải để qua nhóm. Không dùng ảnh/avatar từ nguồn ngoài.
- Cập nhật từ snapshot khi NORMAL_PRICE_UPDATED/AUCTION_STATE hoặc polling có sẵn; không thêm request/timer riêng hoặc đổi backend, ví, luật đấu giá. Trạng thái mất đồng bộ hiện rõ. ResizeObserver đo vùng vẽ; khung dữ liệu không tăng chiều cao khi thêm điểm.
- Áp dụng gợi ý chart/UX của ui-ux-pro-max: time-series line chart, scale thời gian thật, avatar/giá bổ sung màu, hỗ trợ bàn phím và bảng lịch sử thay thế. Không chạy test/typecheck/build hoặc khởi động frontend theo yêu cầu trước đó.


### Trục thời gian biểu đồ chạy trực tiếp

- Tab mặc định dùng cửa sổ 60 giây trượt: X=[thời gian server hiện tại - 60s, thời gian server hiện tại], các điểm/avatar dịch trái mỗi giây. Không còn neo mốc đầu hoặc dừng trục ở bid gần nhất.
- Dùng đồng hồ now có clockOffset sẵn trong phòng, không thêm timer/request riêng; đường giá kéo ngang tới hiện tại khi không có bid, dùng mức giữ ở đầu cửa sổ từ lịch sử trước đó. Không vẽ giá trước giờ mở phiên.
- Toàn phiên vẫn xem được toàn bộ lịch sử. Khi hết hạn thì dừng tại hạn server; gia hạn làm thời gian tiếp tục, SOLD/UNSOLD cố định ở endsAt. Không tự tăng giá hoặc tạo điểm bid giả.
- Readout hiển thị thời gian đang chạy, khi hover/focus avatar thì xem thời điểm bid đó. Sort bid memo theo mảng bid, không sort lại mỗi tick. Không chạy test/build/frontend.


### Xem lại biểu đồ kết quả bằng cuộn ngang

- Khi server chốt SOLD/UNSOLD, tự chuyển tab Biểu đồ giá sang toàn phiên; mốc thời gian dừng ở endsAt. Sau khi đóng chúc mừng vẫn xem được đường giá/avatar, có nút Xem lại biểu đồ trong kết quả SOLD.
- Timeline kết quả rộng hơn viewport (xấp xỉ một phút/màn hình, tối đa 24000px), cuộn ngang bằng trackpad/vuốt, kéo chuột hoặc bàn phím trái/phải/Home/End. Có Về đầu/Về cuối. Trục Y cố định bên trái khi lướt; mốc X rải theo chiều rộng.
- Lần đầu chốt mở tại cuối biểu đồ; các lần polling không kéo người dùng trở lại cuối. Focus avatar ngoài màn hình đưa avatar vào vùng xem. Các lượt sát nhau vẫn gộp, xem từng lượt trong nhóm; bảng Lượt trả giữ toàn bộ dữ liệu.
- Dùng lịch sử bid đã lưu trong API hiện có, không thay đổi dữ liệu hay luật thanh toán. Chỉ rà source, không chạy test/build/frontend theo yêu cầu trước đó.


### Đường nối giá mềm theo hình tham khảo

- Thay đường bậc thang bằng cubic nối các mốc bid; control points bị giới hạn giữa hai đầu nên không vọt lên/xuống ngoài hai mức giá. Các bid trùng timestamp dùng đoạn thẳng đứng, đuôi đến hiện tại vẫn nằm ngang ở mức giá cuối.
- Giữ màu xanh, tăng độ rõ các chấm bid, thêm đường dóng dọc mảnh và lưới ngang nhẹ. Đây là đường nối minh họa giữa các giá đã ghi nhận, không tạo bid/giá hay thay đổi dữ liệu; giá thật đọc ở chấm/avatar/readout.
- Giữ nguyên thời gian trượt 60s, avatar, cuộn ngang kết quả và các chức năng khác. Không chạy test/build/frontend.
