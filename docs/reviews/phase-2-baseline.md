# Baseline Phase 2 — 02/10/2026

HEAD trước rà soát: 99efef2, branch pbtien. Chỉ có plan Phase2 chưa track; không có production changes khác.

Môi trường: Docker backend8080, MySQL3307. Container auction_frontend cũ giữ5173, label Compose xác nhận thuộc đúng D:/it/Project/OnlineBidFlowSystem nhưng service không còn trong compose hiện tại. Không có bind mount. Có thể dừng container cũ để Vite dự án chạy đúng cổng; giữ nguyên container/image để phục hồi bằng docker start nếu cần.

Baseline kiểm thử trước phase: frontend37 unit, Electron23/24 (development mở nhầm Hello World); backend69 unit và40 IT tính theo danh sách test hiện tại, chưa chạy lại toàn bộ trong phase này tại thời điểm lập baseline. Không dùng số cũ làm bằng chứng kiểm thử cuối.

Đọc DB làm việc: SYSTEM1500/0 khớp ledger; ví2 available4400/locked4100 so với ledger6900/1600; ví7–10 có available6000/9500/3900/8200 nhưng không có lịch sử tương ứng. Đây là dữ liệu lịch sử/seed cần đối soát, không tự sửa. Báo cáo query đầy đủ lưu riêng trong wallet-reconciliation.md.

Rủi ro đang tái hiện: response401 từ request của tài khoản cũ có thể xóa phiên mới vì AuthProvider xử lý401 toàn cục mà chưa nhận diện thế hệ phiên gửi request. Cần test thất bại trước khi kết luận và sửa.
