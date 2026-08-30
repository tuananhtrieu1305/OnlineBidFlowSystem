# Hệ thống đấu giá Online thời gian thực

## 1. Mục đích tài liệu

Tài liệu này mô tả các quy tắc nghiệp vụ chung của hệ thống đấu giá online thời gian thực.

Mọi thành viên và coding agent phải đọc tài liệu này trước khi thay đổi backend, frontend hoặc database.

Không được tự ý thay đổi các quy tắc NORMAL/BLIND, Wallet, Auction Result hoặc Database Schema nếu chưa có sự thống nhất của nhóm.

---

# 2. Tổng quan hệ thống

Hệ thống gồm:

- Một server trung tâm.
- Nhiều client.
- MySQL database.

Server lưu:

- Người dùng.
- Ví Coin.
- Sản phẩm.
- Phiên đấu giá.
- Người tham gia.
- Bid.
- Chat.
- Giao dịch Coin.
- Kết quả đấu giá.

Admin quản lý người dùng và khởi tạo các phiên đấu giá.

Người dùng phải đăng ký và đăng nhập trước khi sử dụng các chức năng đấu giá.

Mỗi người dùng có một ví Coin riêng.

Coin chỉ là tiền giả lập sử dụng bên trong hệ thống.

---

# 3. Auction Types

Hệ thống có hai loại đấu giá:

- NORMAL
- BLIND

Hai loại sử dụng chung dữ liệu product và auction nhưng có quy tắc xử lý và quyền cung cấp dữ liệu khác nhau.

---

# 4. NORMAL Auction

Trong NORMAL, người dùng được xem:

- Thông tin cơ bản sản phẩm.
- Hình ảnh sản phẩm.
- Giá khởi điểm.
- Giá hiện tại.
- Người/mức bid đang dẫn đầu theo dữ liệu server cho phép.
- Lịch sử bid.
- Bid của chính mình.
- Thời gian còn lại.

NORMAL không hiển thị historical product price statistics trong lúc auction đang RUNNING.

Người chơi chủ yếu dựa vào:

- starting_price
- current_price
- diễn biến bid của người khác

để quyết định giá tiếp theo.

## Điều kiện tham gia

User phải có:

available Coin >= 50% * starting_price

Ngoài ra user vẫn phải đủ Coin để đảm bảo mức bid thực tế.

## Bid rule

Bid mới phải thỏa:

new_bid >= current_price + min_bid_increment

Nếu bid hợp lệ:

1. Lưu bid.
2. Cập nhật leader/current price.
3. Yêu cầu Wallet module xử lý khóa/mở khóa Coin.
4. Gửi dữ liệu cần thiết cho Realtime module để broadcast.

Nếu leader cũ bị vượt:

- Coin của leader cũ được mở khóa.
- Coin của leader mới được khóa.

Nếu chính leader tăng bid:

- Chỉ khóa thêm phần chênh lệch.

---

# 5. BLIND Auction

BLIND cố tình giới hạn thông tin trực tiếp về auction.

User KHÔNG được xem:

- starting_price
- current_price
- bid của user khác
- leader
- highest bid
- estimated_price

User được xem:

- thông tin cơ bản product
- image
- thời gian còn lại
- bid của chính mình nếu đã bid
- số phiên SOLD trước đó
- average winning price
- minimum winning price
- maximum winning price

Nếu product chưa từng SOLD:

Hiển thị thông báo chưa có dữ liệu lịch sử.

## Bid rule

Mỗi user chỉ được gửi đúng một bid trong một BLIND auction.

Server kiểm tra:

- Auction đang RUNNING.
- User chưa bid trước đó.
- amount > 0.
- User đủ Coin để khóa amount.

Nếu hợp lệ:

- lưu bid
- khóa Coin
- chỉ xác nhận cho chính user gửi bid

Không broadcast:

- amount
- current_price
- highest_bid
- leader

## Winner

Khi auction kết thúc:

ORDER BY amount DESC, created_at ASC

Bid có:

- amount cao nhất
- nếu bằng amount thì created_at sớm nhất

được ưu tiên.

Sau đó kiểm tra:

highest_bid >= starting_price

Nếu đúng:

SOLD

Nếu sai:

UNSOLD

---

# 6. Wallet

Mỗi USER có một USER wallet.

Hệ thống có đúng một SYSTEM wallet.

Wallet gồm:

available_balance

và:

locked_balance

Ví dụ:

Ban đầu:

available_balance = 2000
locked_balance = 0

User bid 600:

available_balance = 1400
locked_balance = 600

Nếu bid bị vượt:

available_balance = 2000
locked_balance = 0

Các transaction type:

DEPOSIT
LOCK
UNLOCK
PAYMENT

Wallet module là module duy nhất chịu trách nhiệm trực tiếp thay đổi balance.

Auction module chỉ gửi yêu cầu lock/unlock/payment.

---

# 7. Product

Product gồm:

- name
- description
- image
- quantity
- estimated_price

estimated_price là dữ liệu nội bộ.

estimated_price không được cung cấp cho người chơi trong NORMAL hoặc BLIND.

Một product có thể xuất hiện trong nhiều auction khác nhau.

Điều này cho phép tính historical price statistics.

---

# 8. Product Historical Statistics

KHÔNG có bảng price_statistics.

Statistics được tính trực tiếp từ auctions.

Chỉ sử dụng auction:

status = SOLD

và đã kết thúc trước auction hiện tại.

Query logic:

WHERE product_id = ?
AND status = 'SOLD'
AND finished_at < current_blind_auction.start_time

Tính:

COUNT(*)

AVG(winning_price)

MIN(winning_price)

MAX(winning_price)

UNSOLD không tham gia statistics.

NORMAL RUNNING:

Không cung cấp statistics cho user.

BLIND RUNNING:

Cung cấp statistics cho user.

---

# 9. Auction Configuration

Admin cấu hình:

- product
- auction_type
- access_type
- room_code
- max_participants
- starting_price
- min_bid_increment
- start_time
- end_time

Auction type:

NORMAL
BLIND

Access type:

PUBLIC
PRIVATE

Lifecycle:

UPCOMING
    ->
RUNNING
    ->
SOLD hoặc UNSOLD

Admin chỉ tạo và quản lý cấu hình auction.

Admin không trực tiếp quyết định winner.

Winner được xác định tự động bởi NORMAL hoặc BLIND business logic.

---

# 10. PUBLIC / PRIVATE Room

## PUBLIC

User đã đăng nhập có thể vào room nếu auction cho phép tham gia.

## PRIVATE

User phải cung cấp:

auction_id
room_code

Server kiểm tra:

- Auction tồn tại.
- room_code đúng.
- Auction còn cho phép join.
- Room chưa vượt max_participants.

Sau khi hợp lệ:

- lưu participation nếu cần
- client join realtime room
- gửi state snapshot phù hợp auction type

---

# 11. Auction Result

## SOLD

Khi auction SOLD:

- winner_user_id có giá trị
- winning_price có giá trị
- finished_at có giá trị

Coin locked của winner được thanh toán vào SYSTEM wallet.

Coin locked của các user thua được unlock.

## UNSOLD

Khi auction UNSOLD:

winner_user_id = NULL

winning_price = NULL

finished_at có giá trị.

Toàn bộ Coin đang bị khóa liên quan phải được unlock.

---

# 12. Realtime

Mỗi auction có realtime room riêng.

Các event dự kiến:

AUCTION_STARTED
AUCTION_STATE
BID_ACCEPTED
PRICE_UPDATED
CHAT_MESSAGE
AUCTION_FINISHED
USER_JOINED
USER_LEFT

Realtime module chỉ truyền dữ liệu.

Realtime module KHÔNG quyết định:

- bid hợp lệ hay không
- winner
- Coin balance

NORMAL có thể broadcast:

- PRICE_UPDATED
- public bid history
- leader information phù hợp

BLIND tuyệt đối không broadcast:

- starting_price
- bid của user khác
- highest_bid
- leader

---

# 13. Chat

Mỗi auction có một chat room.

Chat message được lưu vào:

chat_messages

Server xử lý:

- độ dài message
- send frequency
- user có thực sự thuộc room hay không

Không cần tạo bảng chat room riêng.

Chat history được sử dụng cho:

- reconnect
- replay

---

# 14. Reconnect

Khi client mất kết nối:

1. Client reconnect.
2. Server xác thực lại user.
3. Xác định auction mà user đang tham gia.
4. Join lại room.
5. Gửi state mới nhất.

## NORMAL snapshot

Có thể gồm:

- auction state
- product info
- starting_price
- current_price
- bid history
- chat
- remaining time

Không gửi historical statistics trong NORMAL RUNNING.

## BLIND snapshot

Có thể gồm:

- auction state
- basic product info
- product statistics
- own bid
- chat
- remaining time

Không gửi:

- starting_price
- bid user khác
- highest_bid
- leader

---

# 15. Replay

Không tạo bảng replay.

Replay được dựng lại từ:

- auctions
- bids
- chat_messages

Replay chỉ dùng cho auction đã kết thúc.

## NORMAL

Có thể replay toàn bộ timeline:

- auction started
- bids
- chat
- auction result

theo timestamp.

## BLIND User Replay

User chỉ cần thấy:

- own bid
- chat
- product statistics đã được cung cấp
- winner
- winning_price
- final status

Không công khai toàn bộ hidden bids của user khác.

Admin có thể xem dữ liệu đầy đủ khi cần quản lý.

---

# 16. Leaderboard

Không tạo bảng leaderboard.

Leaderboard được tổng hợp từ auction participation và auction result.

Có thể hiển thị:

- số auction tham gia
- số lần thắng
- win rate
- total Coin spent

Ranking mặc định:

1. số lần thắng DESC
2. nếu bằng nhau: win rate DESC

---

# 17. Database Tables

Database có đúng 8 bảng nghiệp vụ chính:

1. users
2. wallets
3. products
4. auctions
5. auction_participants
6. bids
7. chat_messages
8. coin_transactions

Không tạo:

- leaderboard
- price_statistics
- replays
- socket_connections

---

# 18. Database Relationships

users -> wallets

1 USER có 1 USER wallet.

wallets -> coin_transactions

1 wallet có nhiều Coin transaction.

products -> auctions

1 product có thể có nhiều auction.

users -> auctions.created_by

1 ADMIN có thể tạo nhiều auction.

users -> auctions.winner_user_id

1 USER có thể thắng nhiều auction.

users -> bids

1 USER có nhiều bid.

auctions -> bids

1 auction có nhiều bid.

users -> chat_messages

1 USER có nhiều message.

auctions -> chat_messages

1 auction có nhiều message.

users -> auction_participants

1 USER tham gia nhiều auction.

auctions -> auction_participants

1 auction có nhiều participant.

auctions -> coin_transactions

1 auction có thể phát sinh nhiều Coin transaction.

---

# 19. Bid Database Rule

NORMAL cho phép cùng một user bid nhiều lần.

BLIND chỉ cho một bid/user/auction.

Do đó TUYỆT ĐỐI KHÔNG tạo:

UNIQUE(auction_id, user_id)

trên bảng bids.

BLIND one-bid rule phải được kiểm tra ở Java business logic.

---

# 20. NORMAL / BLIND Visibility Matrix

| Information | NORMAL | BLIND |
|---|---|---|
| Basic product info | Yes | Yes |
| Product image | Yes | Yes |
| estimated_price | No | No |
| starting_price | Yes | No |
| current_price | Yes | No |
| Other users' bids | Yes | No |
| Current leader | Yes | No |
| Historical average winning price | No | Yes |
| Historical minimum winning price | No | Yes |
| Historical maximum winning price | No | Yes |
| Historical SOLD count | No | Yes |
| Own bid | Yes | Yes |

Các quy tắc này phải được enforce tại:

Server / API / DTO.

Không dựa vào frontend để bảo vệ dữ liệu bí mật.

---

# 21. Responsibility Boundaries

## Phạm Bá Tiến

Module:

Account – Wallet – Admin

Phụ trách:

- register/login
- user management
- wallet creation
- Coin deposit
- Coin lock
- Coin unlock
- Coin payment
- transaction history
- SYSTEM wallet
- Admin auction configuration

Không phụ trách:

- bid business logic
- statistics
- winner determination
- socket runtime

---

## Nguyễn Minh Vinh

Module:

NORMAL Auction

Phụ trách:

- NORMAL participation rule
- min bid increment
- NORMAL bids
- leader
- current price
- request wallet lock/unlock
- public bid history
- NORMAL ending
- NORMAL SOLD/UNSOLD

Không:

- trực tiếp sửa wallet balance
- trực tiếp broadcast socket
- xử lý BLIND statistics

---

## Nguyễn Thành Đạt

Module:

BLIND – Product Statistics – Leaderboard

Phụ trách:

- BLIND auction
- historical product statistics
- hidden bids
- one bid/user
- starting price threshold
- timestamp tie breaking
- BLIND ending
- BLIND SOLD/UNSOLD
- leaderboard

Không:

- trực tiếp sửa wallet balance
- broadcast socket

---

## Triệu Tuấn Anh

Module:

Realtime – Room – Chat – Reconnect – Replay

Phụ trách:

- realtime/socket infrastructure
- room join/leave
- PUBLIC/PRIVATE access
- realtime client management
- broadcast
- chat
- anti-spam
- reconnect
- state synchronization
- replay

Module này chỉ broadcast dữ liệu mà NORMAL/BLIND business module cho phép.

Không:

- validate bid business rules
- determine winner
- modify Coin

---

# 22. Development Principles

Business logic nằm ở backend.

Frontend không được xem là security boundary.

Database lưu dữ liệu đầy đủ.

Backend quyết định field nào được trả về client.

Các thao tác liên quan đến bid và Coin sau này phải dùng database transaction phù hợp để tránh race condition khi nhiều request tới gần như đồng thời.

Không thay đổi schema hoặc business rule chỉ để việc implement trở nên dễ hơn.

Nếu cần thay đổi specification, phải trao đổi với nhóm trước.