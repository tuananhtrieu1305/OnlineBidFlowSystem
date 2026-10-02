# Phase 2 — Kết quả triển khai

Ngày 02/10/2026, branch `pbtien`; baseline `99efef2`, checkpoint RED `a2731ea`.

Đã sửa lỗi phiên đăng nhập và xác minh bản Windows đóng gói. Bàn giao có điều kiện về dữ liệu seed cũ: các sai lệch dưới đây vẫn tồn tại, chưa được người dùng chấp nhận hoặc sửa. Không tuyên bố toàn bộ dữ liệu hay toàn bộ hệ thống đã hoàn thiện.

## Phát hiện và xử lý

| ID | Mức độ / phạm vi | Bằng chứng và kết quả |
| --- | --- | --- |
| P2-AUTH-01 | P1, frontend đăng nhập | USER mở ví với request chậm → logout → login ADMIN → response cũ trả 401 làm mất phiên mới. Test RED tái hiện; AuthProvider đánh dấu thế hệ phiên cho request và chỉ xử lý 401 của phiên hiện tại. Test GREEN giữ ADMIN; test hết phiên hiện tại vẫn qua. |
| P2-ENV-01 | Môi trường development | Container `auction_frontend` cũ của chính compose/workspace này chiếm 5173 và trả Hello World. Đã xác minh nhãn rồi dừng container; không xóa container, image hay volume. Development E2E đã qua. Không khởi động lại service frontend cũ. |
| P2-DATA-01 | Dữ liệu cũ, chưa xử lý | Wallet 2 lệch 2500 giữa khả dụng/khóa; ví 7–10 thiếu ledger đầu kỳ; SOLD 2/8/9 thiếu PAYMENT. Chi tiết tại `wallet-reconciliation.md`. Không đủ chứng cứ để tự điều chỉnh số dư hoặc tạo giao dịch bù. |

Rà soát dựa trên code và các test hiện có cho account/session, quyền USER/ADMIN, transaction/lock/settlement, upload ảnh, cấu hình phiên, tra cứu người dùng và SYSTEM. Không thay đổi nghiệp vụ bid, winner hoặc socket của thành viên khác.

## Kết quả kiểm thử

| Kiểm tra | Kết quả |
| --- | --- |
| Backend Java 21, `mvn -Pregistration-it verify`, MySQL riêng 33308 | 69 unit + 40 integration, không lỗi/skip |
| Frontend `npm run test:coverage` | 37 test qua; coverage helper không đại diện toàn bộ UI |
| Frontend build/typecheck và Electron regression | 25 test qua, gồm development và lỗi 401 cũ |
| Windows packaged app, backend thật 18080 | 3 test qua: đăng ký/login/cookie/reload/deposit/socket/logout; demo Admin; upload/reload/edit sản phẩm |
| Windows bản cuối dùng backend mặc định 8080 | Build qua; smoke isolation Node, chặn cửa sổ ngoài và asset traversal qua |
| `npm audit --audit-level=low` | 0 vulnerabilities tại thời điểm chạy |

Không cộng smoke chạy lại vào số regression độc lập. Dự án chưa có lệnh lint riêng. Chưa kiểm tra mọi tổ hợp keyboard, kích thước cửa sổ, thiết bị hoặc mọi tình huống mất mạng; không coi các test trên là chứng nhận không còn lỗi. Bản Windows dùng icon Electron mặc định và chưa ký số.

## Dữ liệu và cách chạy

SQL `database/audits/wallet-reconciliation.sql` chạy trong transaction chỉ đọc. Đọc lại DB làm việc lúc 03:57:11 UTC cho cùng số dư/ledger và các ngoại lệ như baseline 03:48:33 UTC; không sửa DB làm việc.

Script `frontend/scripts/create-phase2-demo.mjs` tạo tài khoản/ví/sản phẩm/phiên mới trên DB test riêng, ghi manifest không chứa mật khẩu. Đã kiểm chứng hai ví 10000 Coin và hai DEPOSIT tương ứng. Mỗi lần chạy tạo prefix mới; dữ liệu demo được giữ để xem, không có thao tác xóa rộng. Hướng dẫn trong `wallet-reconciliation.md`.

Chạy ứng dụng thường từ root:

```powershell
docker compose up -d mysql backend
cd frontend
npm run dev
```

Hoặc mở `frontend/release/win-unpacked/OnlineBidFlow.exe` sau khi backend 8080 sẵn sàng. Bản cuối đã build lại với URL mặc định; bản thử nghiệm 18080 không phải cấu hình bàn giao.

## Handoff Phase 3

- NORMAL/BLIND gọi service ví trong transaction READ_COMMITTED; khóa auction → wallets theo ID → ledger. Không cập nhật số dư trực tiếp.
- Settlement cùng transaction với winner/result/status; rollback toàn bộ khi lỗi; publish sau commit.
- BLIND không gửi giá sàn hoặc bid người khác; NORMAL không gửi thống kê giá sản phẩm trong phiên đang chạy.
- Kiểm thử bid, kết thúc tự động và reconnect với module thực tế của nhóm còn thuộc Phase 3. Fixture UPCOMING không mô phỏng scheduler đã hoàn thiện.
- Trước khi dùng dữ liệu cũ để demo thanh toán, cần xác định lịch sử chuẩn hoặc chuyển sang fixture sạch. Chưa có migration sửa seed vì nguyên nhân chưa đủ rõ.

Không push hoặc merge trong lượt này.
