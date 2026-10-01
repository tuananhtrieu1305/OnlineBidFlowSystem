# Implementation plan — Ví Coin

Ngày: 2026-10-01. Trạng thái: kế hoạch, chưa triển khai.
Baseline: pbtien sau merge 4857eaf. Chủ sở hữu: Phạm Bá Tiến.

## 1. Mục tiêu và phạm vi

Hoàn thiện ví cho người đã đăng nhập: xem số dư, nạp Coin giả lập, xem lịch sử; cung cấp service nội bộ khóa, mở khóa và thanh toán cho NORMAL/BLIND. Giao diện tiếp tục dùng nền #F6F5F1, xanh #145C53 và Be Vietnam Pro.

Không triển khai bid, winner, scheduler kết thúc phiên, CRUD sản phẩm, cấu hình phiên hay quản lý người dùng trong đợt này. Không tích hợp thanh toán tiền thật. Không mở API cho client tự khóa/mở khóa/thanh toán.

Chia làm hai mốc bàn giao:

1. **Ví người dùng:** xem ví, nạp giả lập, lịch sử và giao diện hoàn chỉnh.
2. **Ví phục vụ đấu giá:** hợp đồng service, kiểm soát đồng thời, khóa theo phiên và thanh toán nguyên tử; bàn giao ví dụ gọi cho hai module đấu giá.

## 2. Hiện trạng đã kiểm tra

- Wallet entity và WalletRepository đã tồn tại. WalletService chỉ có createUserWallet, được gọi trong transaction đăng ký.
- wallets có available_balance, locked_balance, wallet_type và user_id; mỗi USER một ví, đúng một ví SYSTEM theo đặc tả.
- coin_transactions có wallet_id, auction_id nullable, transaction_type, available_delta, locked_delta, created_at. Các loại hợp lệ: DEPOSIT, LOCK, UNLOCK, PAYMENT.
- Đăng nhập dùng session HttpOnly; axios đã bật withCredentials. POST cần CSRF; danh tính lấy từ Authentication phía server.
- Realtime đã nối session thật. Chưa có giao diện phòng hoặc nghiệp vụ bid.
- Schema chưa có idempotency key; ledger seed chỉ là ví dụ, không bảo đảm tái dựng đầy đủ số dư hiện tại.
- SYSTEM_SPEC.md yêu cầu trao đổi với nhóm trước khi đổi schema/nghiệp vụ. Không chạy lại init.sql hoặc xóa volume để triển khai ví.

## 3. Quy tắc và bất biến

- Chỉ Wallet module được sửa số dư. Controller không tính toán Coin.
- Coin là số nguyên; từ chối số âm, 0 ở thao tác yêu cầu số tiền, số thập phân, overflow và trường JSON không cho phép.
- available_balance và locked_balance không âm. Dùng phép cộng/trừ có kiểm tra overflow; không dùng double.
- Mọi thay đổi số dư và ledger cùng một transaction. Không có tình huống tăng Coin nhưng ghi lịch sử thất bại vẫn commit.
- Ví hiện tại là nguồn đọc số dư; không tự sửa nó bằng cách cộng ledger seed.
- Thao tác unlock/payment phải kiểm tra số khóa thuộc đúng auction_id, không lấy Coin đang giữ cho phiên khác.
- Điều kiện NORMAL có tối thiểu 50% giá khởi điểm, bước giá, một bid/người ở BLIND và chọn winner thuộc module đấu giá. Wallet chỉ kiểm tra và thực hiện tài chính của yêu cầu đã được module nghiệp vụ xác nhận.
- USER không được đọc ví/giao dịch của người khác hoặc ví SYSTEM. Thiếu ví trả lỗi dữ liệu có kiểm soát, không tự tạo lại và bỏ qua bất nhất.
- Chưa quyết định cho ADMIN có ví cá nhân: seed admin không có USER wallet. Đợt này màn hình ví dành cho USER; SYSTEM wallet được dùng nội bộ, màn hình quản trị ví làm sau.

| Thao tác, số tiền A | Delta khả dụng | Delta đang khóa | Ghi chú |
| --- | ---: | ---: | --- |
| DEPOSIT | +A | 0 | auction_id null |
| LOCK | -A | +A | Có auction_id |
| UNLOCK | +A | -A | Có auction_id |
| PAYMENT ví người thắng | 0 | -A | Có auction_id |
| PAYMENT ví SYSTEM | +A | 0 | Cùng phiên, cùng transaction thanh toán |

## 4. API mốc 1

| API | Chức năng | Quyền |
| --- | --- | --- |
| GET /api/wallet | Số dư ví cá nhân | USER |
| POST /api/wallet/deposits | Nạp giả lập; body chỉ có amount | USER + CSRF |
| GET /api/wallet/transactions | Lịch sử cá nhân, phân trang/lọc loại | USER |

- Không nhận userId, walletId, role hay balance từ client.
- Số Coin và ID BIGINT trả dạng chuỗi thập phân để không mất chính xác trong JavaScript. Input amount cũng là chuỗi số nguyên chuẩn; frontend không chuyển qua Number để tính toán tiền.
- GET /wallet trả walletId, availableBalance, lockedBalance, updatedAt. Không cần lưu totalBalance; UI có thể cộng bằng BigInt.
- POST thành công trả 201 cùng transaction và snapshot ví sau commit. Từ chối amount vượt Long.MAX_VALUE hoặc làm tràn số dư. Hạn mức nạp nhỏ hơn nếu nhóm muốn sẽ là quyết định nghiệp vụ riêng, không tự thêm.
- Lịch sử dùng cursor, limit mặc định 20/tối đa 100; thứ tự created_at DESC, id DESC. Cursor chứa cặp mốc thời gian/ID, được validate và truy vấn luôn giới hạn wallet của người đang đăng nhập.
- DTO lịch sử chỉ có ID, auctionId, loại, hai delta, thời gian. Không trả entity Auction/Product, bid hay giá bí mật. Không suy diễn số dư sau mỗi giao dịch vì schema không lưu snapshot.
- Lỗi: 400 dữ liệu sai; 401 hết phiên; 403 sai quyền/CSRF; 404 không có ví; 409 số dư không đủ/xung đột nghiệp vụ; 429 vượt tần suất; 500 lỗi nội bộ an toàn.
- Thêm limiter có giới hạn bộ nhớ theo tài khoản cho nạp (đề xuất kỹ thuật: 10 request/phút, cấu hình được). Limiter không thay thế transaction hay chống trùng.

### Nạp trùng và request không rõ kết quả

Schema hiện tại không thể phân biệt chắc chắn một request gửi lại với lần nạp mới có cùng số tiền. Không tuyên bố exactly-once chỉ nhờ disable nút hoặc rate limit.

Mốc 1 giữ schema: chặn double click khi request đang chạy; không tự retry POST; timeout hiển thị “Chưa xác định kết quả nạp. Kiểm tra số dư và lịch sử trước khi nạp tiếp”, rồi cho tải lại ví/lịch sử. Hai POST được server nhận độc lập vẫn có thể tạo hai lần nạp.

Nếu nhóm yêu cầu retry an toàn qua mất mạng/restart: đề xuất migration bổ sung khóa request duy nhất theo wallet, payload fingerprint và dữ liệu kết quả đủ trả lại. Cùng khóa/cùng payload trả kết quả cũ; cùng khóa/khác payload trả 409. Chốt thiết kế và được nhóm thống nhất trước khi thực hiện migration; không dùng cache RAM thay bảo đảm bền vững.

## 5. Hợp đồng service mốc 2

Tên dưới đây là hợp đồng dự kiến cần đồng bộ với NORMAL/BLIND trước khi họ gọi:

| Phương thức | Trách nhiệm |
| --- | --- |
| lockToAmount(auctionId, userId, targetAmount) | Đưa tổng Coin giữ cho cặp phiên/user lên target; chỉ trừ phần tăng thêm |
| releaseAll(auctionId, userId) | Hoàn toàn bộ số giữ của user tại phiên đó; không đụng phiên khác |
| settleAuction(auctionId, winnerUserId, winningAmount) | Thu số giữ của winner vào SYSTEM, hoàn số giữ còn lại của phiên |
| releaseAuction(auctionId) | Hoàn toàn bộ Coin của phiên UNSOLD |

- Đây là service Java nội bộ, không phải REST công khai. Yêu cầu transaction bên ngoài bằng Propagation.MANDATORY cho các thao tác đấu giá.
- Auction service khóa phiên, validate, gọi Wallet, lưu bid/kết quả trong cùng transaction. Không REQUIRES_NEW cho Wallet vì sẽ phá rollback toàn bộ.
- lockToAmount lặp lại cùng target không ghi thêm ledger; target nhỏ hơn số đang giữ bị từ chối, muốn hoàn phải gọi release rõ ràng.
- releaseAll/releaseAuction lặp lại khi số giữ đã về 0 là no-op.
- Thanh toán chỉ được thực hiện một lần trong transition kết thúc phiên dưới khóa của auction. Khi retry, đối chiếu trạng thái terminal và ledger PAYMENT: cùng kết quả đã hoàn tất là no-op; kết quả khác hoặc ledger thiếu/vênh trả lỗi. Không chỉ kiểm tra locked_balance tổng.
- Trường hợp winner giữ nhiều hơn winningAmount: thu đúng winningAmount và hoàn phần dư trong cùng transaction; thiếu tiền giữ thì rollback, không tự trừ Coin của phiên khác.
- Không broadcast trực tiếp từ Wallet. Auction module phát sự kiện sau commit theo hợp đồng realtime; nếu cần cập nhật ví riêng qua socket thì thêm event riêng cho đúng user trong đợt tích hợp tiếp theo.

### Khóa và tính nhất quán

1. Auction module khóa hàng auction trước bằng SELECT FOR UPDATE.
2. Lấy toàn bộ wallet cần sửa (leader cũ/mới hoặc winner/losers/SYSTEM), khóa theo wallet ID tăng dần trước khi sửa bất kỳ ví nào.
3. Đọc số giữ theo phiên từ ledger: SUM(locked_delta) của cặp wallet_id/auction_id, sau khi đã khóa wallet. Không dùng truy vấn snapshot cũ trong cùng transaction; chọn isolation READ_COMMITTED tại transaction đấu giá hoặc current read phù hợp.
4. Validate số dư và ghi thay đổi + ledger, rồi commit cùng bid/kết quả.
5. Nạp chỉ khóa wallet, không khóa ngược lại auction. Các nhóm phải tuân thủ cùng thứ tự khóa để giảm deadlock.

Đối với NORMAL đổi leader, tránh hai lời gọi service tự khóa ví theo thứ tự tùy ý. Cung cấp bước acquireWalletsForUpdate cho tập ví, hoặc facade chuyển leader khóa cả hai ví theo thứ tự rồi thực hiện lock/release. Thống nhất một cách trước khi tích hợp.

SYSTEM wallet: truy vấn theo wallet_type, không hardcode ID=1. Kiểm tra có đúng một ví; lỗi cấu hình thì rollback. Nếu nhiều phiên cùng thanh toán, khóa ví SYSTEM cùng thứ tự ID với các ví khác.

### Kiểm tra dữ liệu hiện có trước mốc 2

Ledger mẫu trong init.sql không đầy đủ để chứng minh mọi Coin đang khóa thuộc phiên nào. Viết kiểm tra chỉ đọc so sánh locked_balance với tổng locked_delta và theo phiên; báo các bản ghi bất nhất. Không tự tạo transaction bù hoặc reset dữ liệu.

Test dùng fixture tự tạo cân bằng trong DB riêng. Nếu dữ liệu local thực tế không đối soát được, dừng thao tác ảnh hưởng ví đó với lỗi rõ ràng và thống nhất cách chuyển đổi dữ liệu cùng nhóm. Đây là điều kiện mở chức năng khóa/thanh toán trên dữ liệu cũ.

## 6. Giao diện desktop

- Thêm “Ví Coin” ở thanh bên cho USER đã đăng nhập. Truy cập trực tiếp /wallet yêu cầu kiểm tra session trước khi tải dữ liệu.
- Đầu trang: tiêu đề, ghi rõ “Coin giả lập, chỉ có giá trị trong hệ thống”.
- Hai khối số dư: Coin khả dụng nổi bật, Coin đang khóa có giải thích “Đang được giữ cho các phiên đấu giá”.
- Nút Nạp Coin mở dialog: nhập số nguyên, nút xác nhận và đóng; có thể thêm mức chọn nhanh, không coi chúng là hạn mức nghiệp vụ.
- Khi gửi: khóa submit, không tăng số dư trước server xác nhận. Thành công cập nhật ví và tải trang đầu lịch sử, thông báo số Coin vừa nạp.
- Lịch sử dạng bảng: thời gian, loại, mã phiên nếu có, thay đổi khả dụng, thay đổi đang khóa. Có lọc loại, tải thêm, trạng thái rỗng/lỗi/loading.
- Lỗi tải lịch sử không làm mất phần số dư đã tải thành công. Lỗi nạp không xóa input để người dùng sửa.
- Hết phiên chuyển về đăng nhập, xóa dữ liệu ví khỏi bộ nhớ hiển thị; không tự gửi lại lần nạp cũ sau login.
- Reconnect/focus và sau thao tác nạp: tải lại số dư. Chưa cần thêm socket event cho ví trong mốc 1.
- Bàn phím, focus dialog, aria-busy/alert, không dùng màu làm dấu hiệu duy nhất; kiểm tra cửa sổ 820×650.

## 7. Cấu trúc thay đổi dự kiến

```text
backend/src/main/java/com/group6/auction/wallet/
  controller/WalletController.java
  dto/WalletResponse.java, DepositRequest.java, TransactionResponse.java
  entity/Wallet.java, CoinTransaction.java, TransactionType.java
  repository/WalletRepository.java, CoinTransactionRepository.java
  service/WalletService.java, WalletQueryService.java, WalletTransferService.java
  validation/DepositInput.java
  exception/WalletException.java, WalletExceptionHandler.java

frontend/src/features/wallet/
  api/walletApi.ts
  pages/WalletPage.tsx
  components/WalletBalances.tsx, DepositDialog.tsx, TransactionTable.tsx
  validation.ts
  wallet.css

docs/wallet.md
backend/src/test/java/com/group6/auction/WalletIT.java
frontend/tests/wallet-validation.test.ts
frontend/e2e/wallet.spec.ts
```

Tái sử dụng axios, AuthProvider, CSRF và layout; tách helper lấy CSRF dùng chung nếu cần. Không tạo hệ xác thực riêng cho ví. Giữ createUserWallet hoạt động để không hồi quy đăng ký.

## 8. Thứ tự thực hiện

1. Kiểm tra branch/worktree, xác nhận scope và đọc quy ước repo. Đối soát dữ liệu chỉ đọc; chốt contract với các module đấu giá và quyết định idempotency nếu cần đổi schema.
2. Viết test API xem ví/quyền truy cập và test nạp/ledger trước; xác nhận RED.
3. Thêm DTO, entity giao dịch, truy vấn theo người dùng, khóa ví và nạp nguyên tử. Chạy MySQL integration đến GREEN.
4. Làm /wallet, dialog nạp và lịch sử; test thành công, sai dữ liệu, hết phiên, mất mạng và double click.
5. Bàn giao mốc 1 với tài liệu API và giới hạn retry rõ ràng.
6. Viết fixture nhiều ví/nhiều phiên; test khóa theo phiên, leader tăng giá/chuyển leader, rollback và concurrency.
7. Triển khai service mốc 2; test thanh toán SYSTEM/hoàn losers, UNSOLD và gọi lặp.
8. Bàn giao ví dụ transaction cho NORMAL/BLIND; chạy regression account/realtime, build và audit; commit theo các mốc. Chỉ push khi được yêu cầu.

## 9. Kiểm thử bắt buộc và tiêu chí hoàn thành

**API/quyền:** chưa login 401, sai CSRF 403, ADMIN không dùng endpoint ví USER, inject userId/balance bị từ chối, không xem giao dịch người khác.

**Nạp:** số hợp lệ; 0/âm/thập phân/ký tự/overflow bị từ chối; nạp đồng thời không lost update; lỗi ghi ledger rollback balance; lịch sử phân trang không trùng/bỏ sót theo cursor trong tập đã duyệt.

**Giữ Coin:** không âm; nhiều phiên độc lập; leader tăng chỉ khóa chênh lệch; chuyển leader nguyên tử; thiếu Coin rollback cả bid và ví; unlock không vượt số giữ của phiên.

**Kết thúc:** tổng Coin được bảo toàn qua lock/unlock/payment; SYSTEM nhận đúng winningAmount; hoàn losers; UNSOLD hoàn hết; gọi kết thúc lặp không thu hai lần; nhiều phiên kết thúc đồng thời không làm lệch SYSTEM.

**Giao diện:** số lớn hiển thị đúng; Enter/double click chỉ gửi một request đang xử lý; timeout không báo thành công; refresh khớp server; dialog dùng được bằng bàn phím; không tràn ngang; đăng xuất xóa dữ liệu cá nhân khỏi màn hình.

Mốc 1 hoàn thành khi USER tự nạp và kiểm tra lịch sử thật trên Electron + MySQL mà không làm hỏng đăng ký/đăng nhập. Mốc 2 hoàn thành khi các nghiệp vụ ví vượt qua test đồng thời/rollback và hai module đấu giá có hợp đồng gọi rõ ràng. Coverage báo đúng phạm vi được đo, không lấy coverage helper làm coverage toàn dự án.

## 10. Rủi ro cần theo dõi

- Dữ liệu seed ledger chưa đầy đủ: không dùng nó làm fixture kiểm chứng tài chính và không tự chỉnh dữ liệu người dùng.
- Không có idempotency key: mốc 1 có giới hạn retry đã nêu; muốn bảo đảm bền vững phải thống nhất migration.
- BIGINT MySQL unsigned lớn hơn Java long: phạm vi app giới hạn Long.MAX_VALUE; phát hiện dữ liệu vượt phạm vi thay vì ép kiểu im lặng.
- Gọi service khác transaction hoặc khóa sai thứ tự sẽ gây race/deadlock: phải test ở ranh giới Auction–Wallet, không chỉ test riêng từng hàm.
- Schema chưa cưỡng chế đúng một SYSTEM wallet bằng unique constraint riêng: kiểm tra dữ liệu và khóa ví trong runtime; không tự thêm schema ngoài kế hoạch đã thống nhất.
