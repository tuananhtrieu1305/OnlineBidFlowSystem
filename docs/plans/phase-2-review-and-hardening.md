# Phase 2 — Rà soát, sửa lỗi và chuẩn bị bàn giao phần Phạm Bá Tiến

Ngày lập: 02/10/2026. Trạng thái: kế hoạch, chưa thực hiện rà soát đầy đủ hoặc sửa dữ liệu.

## 1. Mục tiêu

Kiểm chứng các chức năng đã làm bằng những luồng có thể tái hiện; sửa lỗi trong phạm vi Tài khoản – Ví Coin – Admin; chuẩn bị bộ dữ liệu demo có nguồn gốc rõ ràng và tài liệu để nhóm tích hợp.

Không thêm chức năng khóa/mở tài khoản, đổi role, scheduler, xử lý bid/winner hoặc viết lại kiến trúc. Những thiếu sót thuộc NORMAL/BLIND được ghi thành hợp đồng và việc cần làm ở Phase 3. Không đặt tiêu chí “không còn bất kỳ lỗi nào”; tiêu chí là không còn lỗi nghiêm trọng đã biết trong phạm vi bàn giao, có bằng chứng kiểm thử và công khai phần chưa xác minh.

## 2. Hiện trạng và điểm cần xác minh lại

- Đã có đăng ký/đăng nhập/đăng xuất, ví USER, service Coin nội bộ, sản phẩm, cấu hình phiên, tra cứu người dùng và ví SYSTEM.
- Tài liệu Phase 1 ghi 23/24 Electron regression qua; test development mở nhầm ứng dụng “Hello World” ở localhost:5173. Đây là lỗi môi trường được ghi nhận, chưa kết luận code dev có lỗi.
- docs/wallet.md ghi lần đối soát trước: ví ID 2 locked_balance=4100, tổng locked_delta=1600. Phải đọc lại DB đang dùng khi triển khai; không coi số cũ là hiện trạng chắc chắn.
- Trong init.sql, các dòng ví Alice cho tổng available_delta=6900, locked_delta=1600, trong khi snapshot seed là4400/4100: lệch2500 giữa hai ngăn nhưng tổng bằng nhau. Đây chỉ là dấu hiệu của seed chưa đầy đủ; không đủ cơ sở tự bù một LOCK hoặc đổi số dư.
- Schema chưa có idempotency key cho nạp Coin; UI tránh tự retry khi kết quả không rõ. Không hứa exactly-once qua mất mạng. USER/Admin history và summary có những snapshot riêng; không suy diễn sai lệch tạm thời giữa hai request là mất Coin.
- Coverage frontend hiện chủ yếu đo helper, không phải toàn bộ component. Cần bổ sung test trạng thái thực tế, không dùng số coverage để thay thế kiểm tra luồng.

## 3. Thứ tự thực hiện và đầu ra

### 2A. Chốt baseline và môi trường kiểm thử

1. Ghi branch/commit, git status, thay đổi đang có; giữ nguyên phần việc khác của người dùng.
2. Xác định backend8080, MySQL làm việc3307, MySQL test33308, backend live test18080 và tiến trình phục vụ5173. Đọc command line/chủ sở hữu tiến trình và nội dung trang trước khi kết luận; không dừng một ứng dụng khác chỉ để giải phóng cổng.
3. Nếu5173 không thuộc dự án: phương án kiểm thử dev phải dùng môi trường/cổng riêng được cấu hình đồng bộ Vite, Electron dev URL và CSP. Không đổi riêng port Vite rồi bỏ qua allowlist của Electron; không mở wildcard origin. Hoặc dùng5173 khi chủ ứng dụng giải phóng cổng. Chọn phương án nhỏ nhất sau khi kiểm tra scripts hiện tại.
4. Chạy baseline unit/build/typecheck, MySQL integration và Electron, ghi test fail kèm nguyên nhân; phân biệt môi trường, test không ổn định và lỗi sản phẩm. Nếu dev test chưa chạy được, giữ trạng thái chưa xác minh thay vì đánh dấu pass.

Đầu ra: `docs/reviews/phase-2-baseline.md`, danh sách lỗi ban đầu có bước tái hiện. Không nâng dependency hoặc đổi cấu hình rộng khi chưa có lý do cụ thể.

### 2B. Rà soát backend và các bất biến Coin — ưu tiên cao nhất

| Phạm vi | Kiểm tra | Bằng chứng yêu cầu |
| --- | --- | --- |
| Đăng ký | Username trùng đồng thời, chuẩn hóa, giới hạn input, hash mật khẩu, tài khoản/ví cùng commit | MySQL test rollback, chỉ một tài khoản/ví khi đua đăng ký |
| Login/session | CSRF, rate limit, session fixation, logout, hết phiên; USER/ADMIN đúng quyền | HTTP và Electron; socket cũ mất quyền sau logout |
| Ví cá nhân | Chỉ đọc ví chính mình, số nguyên lớn, overflow, nạp đồng thời, lỗi không ghi nửa chừng | Balance/ledger trước và sau transaction; không mất cập nhật |
| Khóa/mở Coin | Hold theo auction, tăng phần chênh, đổi leader nguyên tử, rollback thiếu Coin | Hai ví/đa phiên và truy cập đồng thời |
| Thanh toán | SYSTEM duy nhất, trả người thua/phần dư, lặp cùng kết quả, xung đột winner/amount, UNSOLD | Bảo toàn tổng Coin, chỉ một cặp PAYMENT, kết quả và Coin cùng transaction |
| Sản phẩm | Validate/upload ảnh, đường dẫn, giới hạn dung lượng, ETag, đã dùng không sửa | HTTP/file test, tranh chấp sửa sản phẩm với tạo phiên |
| Cấu hình phiên | Giá/bước giá/timezone, trường server quản lý, quyền PRIVATE, ETag, khóa sửa khi có hoạt động | MySQL race join/edit và hai Admin sửa |
| Admin users/SYSTEM | Guest401/USER403, đúng ví, DTO không chứa bí mật, filter/cursor, precision | Contract tests với input lạ và ID lớn |

Mọi mutation Coin phải giữ thứ tự khóa auction → wallets theo ID → ledger và transaction READ_COMMITTED theo service hiện tại. Với fixture mới có ledger đầy đủ, tổng available+locked của USER và SYSTEM không đổi qua LOCK/UNLOCK/PAYMENT; chỉ DEPOSIT làm tăng tổng. Dùng BigInteger/BigDecimal khi kiểm chứng tổng nhiều ví, không tràn long.

Không sửa module của bạn khác chỉ để làm test pass. Nếu caller bid/finish chưa tồn tại, test service nội bộ/harness và ghi rõ tích hợp còn thiếu. Giữ tách bạch “khả dụng tối thiểu50% giá khởi điểm” của NORMAL với số Coin thực tế phải giữ đủ để thanh toán; quy tắc bid thuộc nhóm phụ trách đấu giá.

### 2C. Đối soát dữ liệu và bộ demo

Tạo `database/audits/wallet-reconciliation.sql` chỉ đọc, kèm cách chạy đúng database. Không đọc password_hash, cookie, secret vào báo cáo. Các query kiểm tra:

- Số lượng SYSTEM; USER thiếu/trùng ví, ví không khớp wallet_type/user_id/role.
- Tổng locked_delta so với locked_balance; hold âm theo wallet+auction; delta khóa không gắn phiên.
- SOLD: đúng người thắng/giá; SYSTEM nhận đúng lượng thanh toán, ví winner có dòng trừ locked tương ứng; hold còn lại sau kết thúc.
- UNSOLD: không có PAYMENT, không còn hold. Nhóm theo wallet/type/auction để tránh join nhân bản giao dịch và tính sai tổng.
- Dấu của DEPOSIT/LOCK/UNLOCK/PAYMENT, cặp PAYMENT và tổng delta theo phiên. Chỉ kết luận theo contract thực tế; không coi giao dịch seed thiếu thông tin là lỗi runtime đã chứng minh.
- Available_balance so với ledger: báo chênh lệch để điều tra, không mặc định tất cả ví lịch sử bắt đầu từ0. Phân loại “thiếu dữ liệu đầu kỳ/seed”, “bất biến bị vi phạm”, “cần module khác xác nhận”.

Đầu ra `docs/reviews/wallet-reconciliation.md`: database/mốc đọc, phạm vi snapshot, ID liên quan, số liệu thực tế, nguồn bằng chứng và phương án xử lý. Tránh đối chiếu snapshot từ các thời điểm khác nhau khi ứng dụng vẫn ghi dữ liệu; dùng consistent read trong cùng transaction cho báo cáo.

Đối với bản demo: ưu tiên tạo tài khoản/sản phẩm/phiên riêng qua nghiệp vụ đã có hoặc fixture chỉ dành cho DB demo riêng. Fixture bắt đầu từ ledger đầy đủ, có prefix, lặp chạy có kiểm soát và cleanup đúng phạm vi; không dùng init.sql để reset DB làm việc. Phiên cần RUNNING/SOLD do harness test thiết lập phải ghi rõ là fixture, không giả vờ scheduler đã hoàn thiện.

Nếu xác định được lỗi seed có cách sửa duy nhất từ bằng chứng: chuẩn bị patch seed cho lần khởi tạo mới và script sửa dữ liệu tồn tại riêng, có precondition số liệu cũ, transaction, expected row count, dry-run và kế hoạch rollback. Không áp script lên DB làm việc trước khi chốt đúng phương án với người dùng. Nếu nguyên nhân còn mơ hồ, giữ nguyên ví đó và dùng fixture sạch; không bịa giao dịch để ép số khớp.

### 2D. Rà soát Electron và trải nghiệm sử dụng

Đi qua guest → đăng ký → login USER → nạp/xem ví → logout → login ADMIN → sản phẩm → phiên → người dùng → SYSTEM. Mỗi bước xác minh response thật trước khi UI báo thành công.

- Mất mạng/timeout khi nạp hoặc tạo: trạng thái kết quả chưa rõ, không tự gửi lại mutation.
- Double click, request về đảo thứ tự, đổi filter khi đang tải, unmount, tải thêm lỗi và retry không nhân đôi dữ liệu.
- 401/403 ở list/detail/history: dữ liệu bảo vệ được ẩn; không chỉ ẩn menu; response cũ không làm xuất hiện lại dữ liệu của phiên đã hết quyền.
- Form bẩn, reload/back, ETag412, điều kiện409, thông báo giúp người dùng biết bước tiếp theo.
- Coin >2^53, SUM >long, mốc ngày/UTC/DST, lịch sử cùng timestamp; giá và nhãn không gây nhầm tiền thật.
- Keyboard/focus/label, tương phản trạng thái, cửa sổ820px và tên dài; không tràn toàn trang. Kiểm tra ảnh sản phẩm lỗi tải.
- Electron giữ contextIsolation/sandbox, không lộ Node cho renderer, không điều hướng/tạo cửa sổ đến URL ngoài allowlist, không đọc file qua asset traversal.

Thêm test cho lỗi thực tế hoặc rủi ro chưa được kiểm chứng, không viết hàng loạt test chỉ lặp lại implementation. Bản đóng gói Windows cần được smoke-test (mở app/login/gọi API/ảnh), vì npm start không chứng minh bản đóng gói chạy được.

### 2E. Sửa lỗi, xác minh lại và bàn giao

1. Mỗi lỗi có ID, mức độ, bước tái hiện, expected/actual, phạm vi và owner. Ưu tiên lỗi mất/trùng Coin, vượt quyền/rò dữ liệu, rollback sai trước lỗi giao diện.
2. Với lỗi code xác định được: test RED → sửa nhỏ → test GREEN; checkpoint theo workflow. Không refactor diện rộng cùng một bản sửa lỗi.
3. Sau bản sửa cuối, chạy bộ kiểm thử phù hợp và regression các điểm dùng chung. Chạy audit trước commit; không dùng npm audit fix --force tự động.
4. Xác minh lại DB làm việc theo chế độ chỉ đọc; so sánh với baseline, chứng minh không reset schema/volume hoặc làm biến đổi số dư ngoài thao tác đã thống nhất.
5. Ghi kết quả vào `docs/reviews/phase-2-report.md`, cập nhật docs module thực sự bị thay đổi, các lệnh chạy thử và checklist demo. Build frontend cuối dùng backend mặc định; tắt các service test do mình mở, giữ service ứng dụng.

## 4. Chạy kiểm thử và điều kiện môi trường

- Frontend: `npm run build`, `npm run test:coverage`, `npm run test:e2e`, `npm audit`; chạy live configs phù hợp với phần bị sửa.
- Backend: Java21, Maven local cache của dự án; `mvn -Pregistration-it verify` trên MySQL riêng với REGISTRATION_TEST_DATABASE=true. Profile coverage chỉ dùng theo module cần đo, không gộp các profile JaCoCo có includes khác nhau một cách tùy tiện.
- Test sửa SYSTEM/missing/duplicate/settlement không chạy song song trên DB dùng chung. Test dữ liệu phải rollback hoặc cleanup fixture; không xóa dữ liệu làm việc.
- Các lần test, thời gian và số lượng phải lấy từ output thực; không cộng số test chạy lặp thành nhiều test độc lập. Ghi rõ coverage module/helper và test môi trường bị chặn.

## 5. Tiêu chí kết thúc Phase 2

- Không còn lỗi nghiêm trọng đã biết trong phạm vi Tiến (mất/trùng Coin, vượt quyền, dữ liệu nửa giao dịch, app không chạy) mà chưa có xử lý. Phát hiện vấn đề nghiêm trọng chưa sửa được phải ghi phase chưa đạt, không chỉ đổi nhãn thành giới hạn.
- Tất cả test bắt buộc cho code sửa qua; không còn test fail không rõ nguyên nhân. Nếu test development/đóng gói bị chặn bởi môi trường, ghi rõ phạm vi chưa xác minh và không tuyên bố kiểm thử toàn bộ đã hoàn tất.
- Có báo cáo đối soát và bộ demo sạch. Nếu dữ liệu cũ chưa đủ căn cứ sửa, ghi nhận ngoại lệ được chấp nhận, không dùng ví đó để chứng minh luồng Coin; “bàn giao có điều kiện” khác với “đã xử lý sạch dữ liệu cũ”.
- Có hướng dẫn chạy và hợp đồng cho Phase3: caller transaction/isolation/thứ tự khóa, settlement cùng result/status, publish sau commit, payload NORMAL/BLIND không rò bí mật.
- Commit theo nhóm thay đổi trên branch hiện tại; không push hoặc merge khi chưa được yêu cầu. Không gộp code nhóm chưa kiểm tra vào lượt rà soát này.

## 6. Các file dự kiến tạo/sửa

```text
docs/reviews/phase-2-baseline.md
docs/reviews/wallet-reconciliation.md
docs/reviews/phase-2-report.md
database/audits/wallet-reconciliation.sql
backend/src/test/...                     # bổ sung test theo lỗi tìm thấy
frontend/e2e/...                        # regression, lỗi mạng, session, race
frontend/tests/...                      # boundary/validation có lỗi thực tế
docs/{wallet,products,auction-configuration,user-management,system-wallet}.md
```

Production files chỉ được xác định sau bằng chứng lỗi; plan không đặt trước một danh sách refactor. Script sửa seed/migration chỉ được tạo khi đã rõ nguyên nhân và phương án.

Nguồn lập plan: các tài liệu module hiện có, init.sql, kết quả và giới hạn Phase1. Lần này chỉ tạo kế hoạch; không đọc số dư DB trực tiếp, không đổi dữ liệu, không chạy lại kiểm thử và không tuyên bố có phát hiện runtime mới.
