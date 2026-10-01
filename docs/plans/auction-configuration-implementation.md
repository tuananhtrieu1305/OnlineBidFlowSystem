# Implementation plan — Admin tạo và cấu hình phiên đấu giá

Ngày: 2026-10-01. Trạng thái: kế hoạch, chưa triển khai.
Chủ sở hữu: Phạm Bá Tiến. Baseline pbtien, sản phẩm hoàn thành ở 3121efe.

## 1. Mục tiêu và phạm vi

Admin chọn sản phẩm đã lưu, cấu hình NORMAL/BLIND, PUBLIC/PRIVATE, giá và thời gian, tạo phiên UPCOMING; xem danh sách/chi tiết và sửa cấu hình khi còn an toàn. Có API và giao diện Electron thật, dùng MySQL hiện tại.

Không xử lý bid, winner, thanh toán, thống kê, Replay hay bảng xếp hạng. Không thêm nút bắt đầu/kết thúc thủ công. Scheduler chuyển UPCOMING → RUNNING và kết thúc phiên là phần lifecycle dùng chung, chưa có trong code khảo sát; phải bàn giao rõ dependency này. Tạo được phiên không đồng nghĩa luồng đấu giá đã vận hành đầy đủ.

Không đổi schema/init.sql/volume. Không thêm DRAFT/CANCELLED, không xóa/hủy phiên trong mốc này. Các policy mới dưới đây là đề xuất cho implementation, không coi là quy định đã ghi trong SYSTEM_SPEC.

## 2. Kết quả khảo sát code

- Auction entity có các trường schema nhưng chỉ getters, thiếu getter createdBy/minBidIncrement. AuctionRepository mới có truy vấn lịch sử theo product/time.
- Chưa có AdminAuctionController, configuration service hoặc scheduler.
- ProductService khóa PESSIMISTIC_WRITE product khi sửa, chặn mọi sản phẩm đã gắn auction. Module tạo phiên phải khóa cùng product trước khi insert.
- Product có thể được tái sử dụng nhiều phiên; editable=false nghĩa là không sửa sản phẩm, KHÔNG phải không được chọn cho phiên mới.
- /api/admin/** đã yêu cầu ADMIN; session/CSRF, CORS If-Match/ETag và kiểu BIGINT string đã có.
- RoomAccessService so mã phòng sau trim, phân biệt hoa/thường. AuctionRoomDetails.joinable cho UPCOMING và RUNNING.
- RoomMembershipService đang validateJoin rồi ensureParticipant bằng các bước/transaction khác nhau. Kiểm tra còn chỗ và insert participant chưa nguyên tử với sửa cấu hình hoặc join khác.
- JpaRoomDataGateway bỏ maxParticipants khi map PUBLIC. Đề xuất mốc này chỉ cấu hình giới hạn người cho PRIVATE, đúng phạm vi mô tả nhóm; không âm thầm cho nhập PUBLIC limit rồi bỏ qua runtime.
- Ngày giờ trong entity là LocalDateTime; quy ước cấu hình mới lưu UTC, không dùng timezone mặc định của host.

## 3. Quy tắc dữ liệu và quyền sửa

| Trường | Quy tắc |
| --- | --- |
| productId | String ID dương <= Long.MAX_VALUE, sản phẩm phải tồn tại; không yêu cầu editable=true |
| auctionType | Chính xác NORMAL hoặc BLIND |
| accessType | Chính xác PUBLIC hoặc PRIVATE |
| startingPrice | Chuỗi Coin nguyên dương <= Long.MAX_VALUE; Admin được thấy ở cả hai loại |
| minBidIncrement | NORMAL: chuỗi nguyên dương; BLIND: bắt buộc null |
| startTime/endTime | ISO-8601 có offset/Z; normalize UTC với độ chính xác microsecond; end > start, start > serverNow khi tạo/sửa |
| roomCode | PUBLIC null; PRIVATE server sinh mã ngẫu nhiên 12 ký tự chữ hoa/số bằng SecureRandom |
| maxParticipants | PRIVATE null (không giới hạn) hoặc JSON integer 1..Integer.MAX_VALUE; PUBLIC null |
| createdBy/status/result | Server quản lý; không nhận từ client |

Không tự lấy estimatedPrice làm startingPrice. Hai giá có ý nghĩa khác nhau; Admin phải nhập giá khởi điểm. Không tiết lộ giá ước tính/giá sàn BLIND trong DTO USER hoặc sự kiện public.

NORMAL: kiểm tra startingPrice + minBidIncrement không overflow Long. Giá bid tương lai vẫn cần NORMAL module kiểm tra overflow riêng. Không đặt trần thời lượng hay khoảng chờ tối thiểu không có trong đặc tả; kiểm tra start còn ở tương lai ngay trước lưu, không chỉ khi mở form.

Tên phiên chưa có trong schema: dùng mã #id và tên sản phẩm để hiển thị. Không tự thêm title/description của phiên. Không tự kiểm tra tồn kho hoặc cấm hai phiên cùng sản phẩm chạy trùng thời gian vì đặc tả chưa quy định.

### Điều kiện sửa đề xuất

Cho sửa khi đồng thời: status=UPCOMING, now < startTime, chưa có auction_participants, bids, chat_messages hoặc coin_transactions liên quan. Nếu đã có bất kỳ hoạt động nào, chỉ xem. Việc người chơi leave không xóa participation để mở lại quyền sửa.

Sau tạo không đổi productId trong mốc này: tránh phải khóa product cũ/mới và khiến sản phẩm đã dùng trở lại editable. Sai sản phẩm cần nhóm bổ sung luồng hủy/thay thế riêng, không xóa phiên trực tiếp.

Các trường còn lại được sửa theo điều kiện trên. PRIVATE → PRIVATE giữ mã; PUBLIC → PRIVATE sinh mã mới; PRIVATE → PUBLIC xóa mã. Không có endpoint đổi mã độc lập trong mốc này. Không nhận roomCode tự chọn. Mã không cần unique toàn hệ thống vì join dùng auctionId + roomCode; không đổi logic so mã của realtime.

## 4. API

| API | Chức năng |
| --- | --- |
| GET /api/admin/auctions?q=&status=&auctionType=&accessType=&page=0&size=20 | Danh sách với bộ lọc allowlist, size tối đa100, id DESC |
| GET /api/admin/auctions/{id} | Chi tiết đầy đủ cho Admin, ETag, serverNow |
| POST /api/admin/auctions | Tạo UPCOMING, 201 + Location + chi tiết |
| PUT /api/admin/auctions/{id} | Sửa cấu hình, If-Match bắt buộc, 200 + ETag mới |

Body create: productId, productVersion, auctionType, accessType, startingPrice, minBidIncrement, startTime, endTime, maxParticipants. productVersion lấy từ chi tiết sản phẩm để tránh tạo phiên dựa trên thông tin cũ; server so sau khi khóa product. Update chỉ gồm các trường cấu hình có thể sửa, không nhận productId/productVersion/roomCode/status/createdBy/result. Từ chối field lạ và JSON coerce.

List item chỉ gồm id, product summary (id/name/imageUrl), type/access/status, start/end, participantCount và khả năng sửa; không trả roomCode trong danh sách. Detail bổ sung startingPrice/minBidIncrement/maxParticipants/roomCode/createdBy/result và version. ID/Coin/count Long dùng string. Product summary không cần estimatedPrice.

Filter q trim tối đa255, tìm tên sản phẩm hoặc ID phiên chính xác; escape LIKE literal và bind parameter. Dùng projection/batch query, không query product/participant từng dòng. Response list có items/page/size/totalElements/totalPages/serverNow.

editable/editBlockedReason là gợi ý UI, server kiểm tra lại khi mutation. Nếu status còn UPCOMING nhưng đã qua startTime: editable=false, reason=START_TIME_REACHED, không giả trạng thái RUNNING. UI hiển thị “Đã đến giờ bắt đầu, chờ hệ thống cập nhật”.

Lỗi: 400 validation + fieldErrors; 401; 403; 404 auction/product không có; 409 AUCTION_NOT_EDITABLE hoặc START_TIME_PASSED; 412 AUCTION_CHANGED/PRODUCT_CHANGED; 428 VERSION_REQUIRED; 500 generic. Dùng Clock injectable cho quy tắc thời gian và test, không sleep để kiểm thử boundary.

POST không có durable idempotency vì schema không có key: chặn double-submit, không tự retry khi timeout/5xx. Khi chưa rõ kết quả, giữ bản nhập và hướng dẫn kiểm tra danh sách trước khi tạo lại. Không giả định hai request giống nhau là cùng một phiên.

## 5. Transaction và phối hợp realtime bắt buộc

### Tạo phiên

READ_COMMITTED → resolve Admin từ session → validate input → khóa product bằng ProductRepository.findForUpdate → so productVersion → kiểm tra giờ server → tạo Auction UPCOMING, createdBy từ user đăng nhập, result fields null → flush/commit. Từ sau commit ProductService sẽ chặn sửa product. Rollback không để lại phiên hoặc thay đổi sản phẩm.

### Sửa phiên

READ_COMMITTED → khóa auction PESSIMISTIC_WRITE → đọc lại trạng thái/thời gian/hoạt động → so ETag → cập nhật whitelist → flush/commit. Update không khóa product vì productId bất biến. ETag hash canonical các field persisted, không chứa serverNow/derived count. Đọc lại điều kiện hoạt động độc lập với ETag.

### Join phòng và sửa cấu hình

Chỉ thêm auction lock ở Admin là KHÔNG đủ. Cần phối hợp phần của Tuấn Anh để có operation join nguyên tử ở persistence boundary:

1. Khóa auction cùng PESSIMISTIC_WRITE trong READ_COMMITTED.
2. Đọc cấu hình mới nhất, validate roomCode/status/capacity và participation hiện có.
3. Insert participation nếu chưa có, commit.
4. Sau commit mới cập nhật membership trong bộ nhớ và gửi snapshot/event bằng runtime hiện có.

Giữ DTO/event bên ngoài; không broadcast raw AdminAuctionResponse. Có thể thêm method atomic authorize-and-register vào RoomDataGateway thay cho validateJoin + ensureParticipant tách rời, kèm adapter cho test/probe. Đây là thay đổi dùng chung cần bàn giao với Tuấn Anh; không nhận viết lại socket runtime.

Race phải có kết quả rõ: update thắng trước thì join dùng cấu hình mới; join thắng trước thì update bị409. Hai join vào chỗ cuối chỉ một người được đăng ký; người đã tham gia reconnect không bị tính thêm.

Nếu phần atomic join chưa tích hợp, KHÔNG coi tính năng sửa cấu hình hoàn chỉnh và không mở PUT/UI edit cho người dùng; create/list/detail có thể bàn giao riêng. Không dựa vào việc kiểm tra COUNT hiện tại để tuyên bố đã giải quyết race.

Quy tắc thứ tự khóa: create chỉ khóa product; update/join/lifecycle khóa auction; wallet runtime auction → wallets tăng dần. Không tạo đường auction → product trong scope này, tránh vòng khóa với ProductService. Realtime chỉ cập nhật sau commit; nếu socket ngắt sau khi đăng ký thì participation vẫn được lưu cho reconnect.

## 6. Giao diện Electron

Giữ nền #F6F5F1, brand #145C53, Be Vietnam Pro và bố cục Admin hiện có. Thêm navigation “Phiên đấu giá”.

Routes: /admin/auctions, /admin/auctions/new, /admin/auctions/:id, /admin/auctions/:id/edit. Trang chi tiết sản phẩm thêm nút “Tạo phiên từ sản phẩm này” dẫn tới new?productId=...; vẫn cho tái sử dụng sản phẩm đã dùng.

Form 3 nhóm trên một trang:

1. Sản phẩm: tìm kiếm server, chọn, preview ảnh/tên/số lượng. Bản tạo có thể đổi lựa chọn; bản sửa chỉ đọc.
2. Kiểu đấu giá/quyền vào: nhãn “Đấu giá thường (NORMAL)” và “Đấu giá mù (BLIND)”; “Phòng công khai (PUBLIC)” và “Phòng riêng (PRIVATE)”. Không gọi NORMAL là PUBLIC vì đây là hai thuộc tính độc lập.
3. Giá và lịch: giá khởi điểm luôn nhập cho Admin; NORMAL có bước giá, BLIND ẩn input và gửi null; PRIVATE cho giới hạn người; PUBLIC reset null. Thời gian hiển thị timezone máy bằng nhãn rõ, chuyển sang UTC khi gửi. Xác nhận lại thời gian bắt đầu/kết thúc trước khi lưu; reject local date không tồn tại do DST thay vì âm thầm đổi giờ.

Sau tạo thành công vào trang chi tiết: mã phiên, sản phẩm, cấu hình, lịch, trạng thái; PRIVATE có nút hiện/ẩn và sao chép mã. Không đặt roomCode trong URL/query/localStorage hoặc log; clipboard là hành động rõ ràng của Admin. Không copy tự động.

List có filter status/type/access, tìm kiếm debounce, phân trang/loading/empty/error. Detail hiển thị lý do khóa sửa. 412 giữ bản nhập, cho tải mới có xác nhận; 409 chuyển sang chế độ chỉ xem và hướng dẫn. Có dirty-form warning, focus lỗi đầu, disabled khi submit, hoạt động được ở cửa sổ820px. 401/403 ẩn dữ liệu Admin.

## 7. File dự kiến và ranh giới

```text
backend/.../auction/configuration/
  controller/AdminAuctionController.java
  controller/AuctionConfigurationExceptionHandler.java
  service/AuctionConfigurationService.java
  service/AuctionConfigurationInput.java
  service/AuctionConfigurationVersion.java
  dto/AdminAuctionResponse.java
  dto/AdminAuctionListResponse.java
backend/.../auction/entity/Auction.java                 # factory/update whitelist/getters
backend/.../auction/repository/AuctionRepository.java  # lock/list/detail queries
frontend/src/features/auctions/configuration/
  auctionConfigurationApi.ts
  validation.ts
  AdminAuctionsPage.tsx
  AuctionConfigurationForm.tsx
  ProductPicker.tsx
  auctions.css
```

Dùng Clock bean chung có UTC, không tạo utility thời gian rải rác. Chỉ tách thêm file khi có code thật. Shared files: navigation/router, product detail link, realtime persistence gateway/test khi tích hợp atomic join. Không mở broad permission trong SecurityConfig, không thêm API public trả entity.

## 8. Các mốc triển khai

1. Contract/input/Clock và test RED: enum, giá, null rules, UTC, quyền, server-owned fields.
2. Create/list/detail backend + transaction khóa product + productVersion; integration test MySQL.
3. Form tạo, product picker, list/detail và mã phòng; live Electron tạo đủ bốn tổ hợp NORMAL/BLIND × PUBLIC/PRIVATE.
4. Phối hợp atomic join; update/ETag/điều kiện sửa; test concurrency thật và UI edit. Không bỏ qua dependency này.
5. Regression auth/product/wallet/socket/reconnect/replay; build/typecheck/audit, docs hợp đồng lifecycle; commit theo checkpoint, chỉ push khi được yêu cầu.

## 9. Test và tiêu chí nghiệm thu

- Guest401/USER403 cho mọi Admin endpoint; POST/PUT thiếu CSRF403; giả createdBy/status/winner/roomCode bị400.
- Bốn tổ hợp type/access đều lưu đúng schema; PRIVATE code đủ độ dài/nguồn random; PUBLIC roomCode/maxParticipants null; BLIND increment null.
- startingPrice/increment 0/âm/thập phân/overflow, maxParticipants coerce, ID ngoài range, product không tồn tại, field lạ bị từ chối.
- Clock fixed: start==now, start quá khứ, end<=start; offset khác nhau nhưng cùng instant; máy ở timezone khác vẫn lưu/đọc cùng UTC.
- Sản phẩm đã dùng vẫn tạo được phiên mới; sản phẩm bị sửa sau khi picker tải thì productVersion cũ bị412; rollback create không khóa sửa sản phẩm vĩnh viễn.
- Sửa chỉ ở UPCOMING tương lai chưa hoạt động; kiểm tra từng bảng participant/bid/chat/coin. RUNNING/SOLD/UNSOLD và UPCOMING quá giờ đều bị chặn.
- Hai Admin cùng sửa: chỉ version đầu thắng. Sửa vs join, hai người vào chỗ cuối và reconnect kiểm tra bằng barrier/latch trên MySQL, không H2.
- ETag không đổi chỉ vì serverNow thay đổi; timestamp precision round-trip không tạo mismatch giả.
- Join PRIVATE đúng/sai mã, PUBLIC không cần mã; snapshot NORMAL/BLIND và Replay không lộ roomCode/estimatedPrice/giá sàn BLIND qua thay đổi mới.
- E2E form conditional fields, dirty form, 409/412/offline, product picker stale query, hết phiên, cửa sổ820px; live POST+GET+PUT và socket join dùng session thật.
- Không có scheduler: test không giả vờ chờ để phiên tự bắt đầu. Docs/UI thể hiện đúng trạng thái lưu và giới hạn tích hợp.

Hoàn thành mốc cấu hình khi Admin tạo/xem/sửa đúng điều kiện, dữ liệu tồn tại sau restart, product history được bảo vệ và join/update dùng chung khóa. Chạy đấu giá end-to-end chỉ hoàn thành sau khi lifecycle và module NORMAL/BLIND của nhóm được nối vào.

## 10. Tài liệu bàn giao

Tạo docs/auction-configuration.md ghi API, input mẫu, giờ UTC, mã phòng, lỗi, phạm vi edit, hợp đồng atomic join và dependency lifecycle. Cập nhật docs/TEAM_CONVENTIONS.md chỉ các quyết định đã chốt khi triển khai; không sửa SYSTEM_SPEC hoặc schema ngầm.

Nguồn khảo sát: SYSTEM_SPEC.md, database/init.sql, docs/TEAM_CONVENTIONS.md, docs/products.md, docs/wallet.md, Auction.java, AuctionRepository.java, RoomAccessService.java, RoomMembershipService.java, JpaRoomDataGateway.java, AuctionRoomDetails.java. Không có thay đổi code nghiệp vụ trong lần lập plan này.
