# Tích hợp Auction — Wallet — Realtime

`AuctionWalletIntegration` là điểm nối nội bộ cho module NORMAL/BLIND. Không có API HTTP/socket cho client tự gọi khóa Coin, chọn winner hoặc thanh toán. Kết quả do module đấu giá đã kiểm tra quyết định; adapter kiểm tra dữ liệu tham chiếu, cập nhật ví và ghi kết quả cùng transaction.

## Trách nhiệm caller

Mỗi lệnh nghiệp vụ dùng outer `@Transactional(isolation = Isolation.READ_COMMITTED)`. Giữ khóa ghi auction **trước khi** đọc trạng thái, thời gian, các bid và leader; không khóa ví trước. Xác thực USER từ session phía server, quyền tham gia PUBLIC/PRIVATE, điều kiện 50%, bước giá, giới hạn một bid BLIND và hạn chót nằm ở caller. Không lấy userId/winner/previousLeader từ dữ liệu client rồi truyền thẳng vào adapter.

| Quyết định đã kiểm tra | Điểm gọi sau khi lưu/flush bid |
| --- | --- |
| NORMAL bid hợp lệ | `normalBidAccepted(auctionId, bidId, previousLeaderUserId, nextMinimumBid)` |
| BLIND bid hợp lệ | `blindBidAccepted(auctionId, bidId)` |
| Kết thúc có winner | `finishSold(auctionId, winnerUserId, winningAmount)` |
| Không có winner | `finishUnsold(auctionId)` |

Adapter chỉ nhận bid đã tồn tại, thuộc đúng phiên, thuộc USER đã tham gia và có amount dương. NORMAL/BLIND sai loại bị từ chối. `nextMinimumBid` do caller tính bằng phép toán có kiểm tra overflow; phải lớn hơn bid hiện tại và phù hợp bước giá. Adapter không kiểm tra lại toàn bộ thuật toán chọn leader/winner.

## Luồng bid

```text
Session USER → service NORMAL/BLIND
  → mở transaction READ_COMMITTED
  → lock auction, đọc trạng thái/thời gian/quyền và kiểm tra bid
  → lưu bid + flush nếu dùng JPA
  → gọi adapter
      → lock auction (cùng transaction)
      → đọc bid theo auctionId + bidId
      → WalletTransferService: lock wallets theo ID, kiểm tra ledger, khóa/hoàn Coin
      → đăng ký sự kiện transaction
  → COMMIT → listener AFTER_COMMIT → publisher socket
```

Thiếu Coin/lỗi ledger/lỗi lưu bid phải làm rollback cả lệnh. Không catch lỗi rồi commit riêng bid hoặc trả thành công. Nếu dùng JPA, flush trước khi gọi adapter để JDBC thấy bid mới. Không tự gửi thêm socket event trong caller, tránh gửi lặp hoặc gửi trước commit.

Adapter không cung cấp idempotency cho request đặt bid. Module nhận lệnh phải kiểm tra trùng/giới hạn bid ở trong khóa auction. Không gọi lại `normalBidAccepted` cho bid cũ sau khi đã có leader mới. Chỉ retry **toàn bộ transaction** khi đã biết rollback; timeout không chứng minh transaction thất bại.

## Luồng kết thúc

Caller giữ khóa auction, kiểm tra thời gian/trạng thái và chọn kết quả bằng quy tắc NORMAL/BLIND (BLIND hòa giá theo thứ tự server ghi nhận). Gọi một phương thức finish; adapter thanh toán hoặc hoàn Coin, rồi ghi `status`, `winner_user_id`, `winning_price`, `finished_at` UTC. Không cập nhật status trước khi gọi adapter, vì ví cần phiên RUNNING để thực hiện lần đầu.

`finishSold` kiểm tra giá đạt giá sàn và có bid đúng winner/amount đã lưu. Đây là kiểm tra kết quả có dữ liệu hỗ trợ, không thay thế việc chọn winner cao nhất hay giải quyết hòa giá. `finishUnsold` không tự đánh giá các bid; caller chịu trách nhiệm quyết định không có winner hợp lệ.

Lặp SOLD cùng winner/amount hoặc UNSOLD sẽ kiểm tra trạng thái ledger và không gửi lại sự kiện. Kết quả xung đột bị từ chối. Hai caller đồng thời được tuần tự hóa bằng khóa auction. Result và Coin rollback cùng nhau nếu lỗi.

Result dùng JDBC cùng transaction manager JPA. Nếu caller đang giữ managed `Auction`, dùng `entityManager.refresh(auction)` sau adapter trước khi đọc lại; không ghi entity stale đè lên kết quả vừa lưu. Mỗi transaction nên xử lý một auction và một lệnh; không xử lý nhiều auction với thứ tự khóa tùy ý.

## Sự kiện và khôi phục kết nối

| Sự kiện | Người nhận | Dữ liệu |
| --- | --- | --- |
| NORMAL_PRICE_UPDATED | Thành viên room | Giá, mức tối thiểu tiếp theo, leader |
| BLIND_BID_ACCEPTED | Các session của chủ bid | Giá của chính họ và bidRef; không broadcast room |
| AUCTION_FINISHED | Thành viên room | SOLD/UNSOLD, winner và winningPrice; không có giá sàn hay lịch sử bid kín |

Listener chỉ chạy AFTER_COMMIT. Lỗi một socket không ngăn gửi tới những người còn lại; lỗi transport được ghi nhận mà không trả thất bại nghiệp vụ giả sau commit. Không log payload bid kín. Giữ kiểm tra lease/quyền trên session socket của hạ tầng hiện tại.

Thông báo là best-effort: chưa có outbox, ACK hay đảm bảo thứ tự toàn cục khi nhiều transaction cùng commit. Reconnect phải xác thực lại và JOIN_ROOM để lấy snapshot mới; khi đã kết thúc có thể đọc Replay. Client không được cộng/trừ Coin chỉ dựa trên số sự kiện nhận được; tải lại ví từ API. Khôi phục kết quả mất sự kiện bằng Replay hiện có, không giả định snapshot chứa toàn bộ kết quả.

Protocol realtime hiện tại dùng JSON number cho nhiều BIGINT, khác contract ví dùng chuỗi. Khi nhóm nối UI phải thống nhất nâng version/chuyển BIGINT sang chuỗi trước khi hỗ trợ giá/ID ngoài phạm vi số nguyên an toàn JavaScript. Lượt này không âm thầm đổi protocol của module realtime.

## Chạy test

MySQL test riêng `onlinebidflow-registration-test` đã được khởi tạo, cổng33308; **không dùng DB làm việc**. Từ root, trong PowerShell:

```powershell
docker start onlinebidflow-registration-test
$env:JAVA_HOME = 'C:/Program Files/Java/jdk-21'
$env:DB_HOST = '127.0.0.1'
$env:DB_PORT = '33308'
$env:DB_NAME = 'auction_db'
$env:DB_USERNAME = 'root'
$env:DB_PASSWORD = '<mật khẩu DB test của bạn>'
$env:REGISTRATION_TEST_DATABASE = 'true'
mvn -B -ntp -f backend/pom.xml '-Dmaven.repo.local=D:/it/Project/OnlineBidFlowSystem/.cache/m2' '-Pregistration-it,integration-coverage' verify
docker stop onlinebidflow-registration-test
```

Chạy trong terminal riêng để không mang environment DB test sang ứng dụng thường. Tests tự tạo fixture có prefix và cleanup đúng ID; không reset DB/volume. Coverage profile chỉ đo package `auction/integration`, không đại diện toàn bộ backend.

## Phần còn chờ module nhóm

Service bid NORMAL/BLIND, scheduler chuyển UPCOMING/RUNNING/kết thúc, thuật toán winner và màn hình đặt bid chưa có trong branch này. Test caller fixture chứng minh contract adapter, không chứng minh các chức năng trên đã được triển khai. Dữ liệu seed cũ vẫn theo ngoại lệ trong `reviews/wallet-reconciliation.md`.
