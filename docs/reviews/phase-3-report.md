# Phase 3 — Kết quả tích hợp phần Tiến

Ngày 02/10/2026, branch `pbtien`, baseline `2c350bb`.

Đã triển khai lớp tích hợp nội bộ và kiểm chứng trên MySQL riêng. Chưa hoàn thành luồng đấu giá end-to-end của cả nhóm: branch hiện tại chưa có service nhận bid NORMAL/BLIND, scheduler và UI phòng đặt bid. Không merge hoặc viết thay các module này trong lượt bàn giao phần Tiến.

## Đầu ra

- `AuctionWalletIntegration`: nhận bid đã lưu hoặc quyết định kết quả từ caller đáng tin; buộc outer READ_COMMITTED, khóa auction trước, gọi ví cùng transaction và ghi kết quả SOLD/UNSOLD. Chặn sai loại/bid, winner không có bid hỗ trợ, kết quả xung đột; kết thúc lặp không thanh toán hay phát kết quả hai lần.
- `AuctionRealtimeAfterCommit`: chuyển sự kiện bất biến sang publisher sau commit; rollback không gửi; lỗi transport không trả thất bại nghiệp vụ giả. BLIND chỉ xác nhận giá cho chủ bid.
- Fan-out tiếp tục với các session còn lại khi một socket lỗi, sau đó báo lỗi tổng hợp cho caller. Countdown snapshot NORMAL/BLIND dùng UTC, sửa trường hợp server múi giờ Việt Nam báo hết giờ sớm.
- Hướng dẫn caller tại `../auction-wallet-integration.md`; không thêm endpoint cho client tự chọn winner/thanh toán. Không đổi schema, dữ liệu seed hoặc protocol realtime.

## Bằng chứng RED → GREEN

| Checkpoint | Bằng chứng |
| --- | --- |
| `ce19529` | Test contract mới compile RED vì thiếu `AuctionWalletIntegration` |
| `2569487` | 7 MySQL integration test GREEN cho adapter; unit regression qua |
| `0cafbb6` | Runtime RED: socket đầu hỏng chặn socket sau; snapshot còn 10 phút UTC trả 0 giây tại Asia/Ho_Chi_Minh |
| `d5ebada` | 12 test liên quan GREEN sau sửa fan-out và countdown |

## Xác minh cuối

`mvn -Pregistration-it,integration-coverage verify` với Java21, MySQL test33308: **72 unit + 47 integration**, 0 fail/error/skip. Có test rollback bid/Coin/event, đổi leader, riêng tư BLIND/snapshot/replay, thanh toán và UNSOLD, gọi kết thúc đồng thời, gọi sai transaction và lỗi socket. Publisher dùng thật với transport test double trong test adapter; suite realtime hiện có có kiểm thử HTTP/session/WebSocket thật. Không gọi đây là test UI đặt bid end-to-end.

JaCoCo package `auction/integration`: **79/80 dòng = 98,75%**, branch **33/41 ≈80,49%**; gate dòng >=80% qua. Coverage không đại diện toàn bộ backend. `npm run build` (gồm typecheck) qua; `npm audit --audit-level=low` báo 0 vulnerabilities. Không sửa frontend nên không chạy lại toàn bộ Electron suite đã xác minh Phase2.

SQL đối soát chỉ đọc DB làm việc `auction_mysql/auction_db` lúc **04:13:46 UTC /11:13:46 Asia/Saigon**: số dư, ledger và ngoại lệ giống Phase2. SYSTEM1500/0; wallet2 lệch2500 giữa hai ngăn; wallet7–10 thiếu ledger đầu kỳ; SOLD2/8/9 thiếu PAYMENT. Không tự sửa những dữ liệu này. DB test đã dừng, volume được giữ; service ứng dụng đang chạy không bị thay bằng bản test.

## Phần cần nối tiếp bởi nhóm

1. NORMAL/BLIND nhận lệnh USER, kiểm tra quyền/thời gian/giá/giới hạn, lưu bid rồi gọi adapter. Winner và hòa giá do các module này tính.
2. Scheduler chọn phiên đến hạn, giữ khóa và gọi service kết thúc theo một transaction/phiên; không quét seed cũ để tự thanh toán khi chưa đối soát.
3. UI phòng đấu giá nhận event, tải lại ví/snapshot khi reconnect, đọc Replay để khôi phục kết quả; không tự retry bid sau timeout.
4. Thống nhất kiểu chuỗi cho BIGINT trong protocol realtime trước khi hỗ trợ ID/Coin >2^53−1. Lượt này giữ contract số hiện tại của module nhóm.

Realtime vẫn best-effort, chưa có outbox hay exactly-once/order toàn cục. Test fixture thể hiện caller đúng contract, không thay thế kiểm thử thuật toán đấu giá chưa có. Build backend mới đã tạo nhưng chưa deploy lên container ứng dụng; không push hoặc merge.
