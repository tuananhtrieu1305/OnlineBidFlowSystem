# Hoàn thiện phần Tiến — checklist và bằng chứng

Ngày kiểm chứng: 03/10/2026 (Asia/Saigon). Đã hoàn tất kiểm chứng chức năng trong phạm vi phần Tiến và discovery. Giới hạn dữ liệu seed, toolchain và tích hợp nhóm được nêu riêng bên dưới; không tuyên bố toàn hệ thống đấu giá hoàn thành.

## Phạm vi và nguyên tắc

Account/session/authorization, USER wallet/ledger, SYSTEM wallet, Admin users/products/auction configuration, wallet–auction integration, public discovery. Đọc SYSTEM_SPEC.md, TEAM_CONVENTIONS.md, báo cáo Phase 2/3 và hướng dẫn AGENTS do người dùng cung cấp (không tìm thấy AGENTS.md trong cây file repo).

Không đổi schema/quy tắc đấu giá, không viết thay NORMAL/BLIND/scheduler, không sửa ledger cũ, không push/merge/deploy. Bảo toàn thay đổi đang có ở SecurityConfig, HomePage, router và hai thư mục discovery.

## Checklist bàn giao

- [x] Account: đăng ký, login/logout, khôi phục phiên, CSRF và quyền USER/ADMIN.
- [x] USER wallet: nạp, số dư khả dụng/khóa, ledger, rollback và concurrency.
- [x] Admin: tra cứu người dùng và SYSTEM wallet, sản phẩm/ảnh, tạo/sửa cấu hình phiên.
- [x] Integration: NORMAL/BLIND adapter, thanh toán/UNSOLD, rollback, event sau commit và riêng tư.
- [x] Discovery: API công khai an toàn, lọc/tìm/phân trang, chi tiết, lỗi/rỗng/retry, Electron và backend thật.
- [x] Kiểm thử backend/MySQL, frontend coverage, typecheck/build và Electron hồi quy.
- [x] Dữ liệu demo sạch riêng; hướng dẫn chạy và tài liệu khớp code.
- [x] Audit cuối từng tiêu chí, không lấy kết quả cũ hoặc test mock làm bằng chứng backend thật.

## Môi trường và phát hiện ban đầu

- Nhánh `pbtien`, baseline HEAD `4d0a662`; có thay đổi discovery chưa commit từ trước Goal.
- Container test `onlinebidflow-registration-test` đã chạy, bind 127.0.0.1:33308; DB làm việc `auction_mysql` ở 3307, backend làm việc ở 8080. Không dừng/khởi động lại các service đang có.
- Java 21 tại `C:/Program Files/Java/jdk-21`, Maven cache dự án `.cache/m2`.
- Đã đối soát DB làm việc bằng `database/audits/wallet-reconciliation.sql` trong transaction READ ONLY. Sai lệch seed cũ giữ nguyên; không chỉnh dữ liệu.
- Test guest cũ mong placeholder danh sách chưa sẵn sàng; đã cập nhật theo empty state thật và mock API discovery riêng.

## Bằng chứng lượt hiện tại

| Kiểm chứng thực tế | Kết quả và bằng chứng |
| --- | --- |
| `mvn -Pregistration-it,integration-coverage verify` (Java21, DB33308) | 72 unit + 49 integration, 0 fail/error/skip; `.cache/tien-backend-baseline.log`. Coverage gate adapter >=80% qua. Đây là code production cuối, không có sửa production sau lần chạy. |
| Discovery mở rộng: `mvn -Pregistration-it,discovery-coverage -Dit.test=DiscoveryIT verify` | 5 integration qua, 0 skip; `.cache/tien-discovery-coverage.log`. Bao gồm 2 test cũ + 3 test bổ sung; không cộng trùng với 49 phía trên. Coverage discovery 29/29 dòng, 33/34 branch, không đại diện toàn backend. |
| `npm run test:coverage` | 37 test, 8 file qua; 67/67 dòng helper được instrument. Không đại diện toàn UI. |
| `npm run build` | Typecheck, Vite và Electron build qua. Log bản test `.cache/tien-live-build.log`, bản mặc định `.cache/tien-final-build.log`. |
| Electron regression `npx playwright test` | 26/26 qua, gồm development, discovery, quyền, session race, dữ liệu lớn, ảnh/form, lỗi/retry và cửa sổ 820px; `.cache/tien-electron-final.log`. |
| Electron + backend/MySQL thật, `playwright.tien-live.config.ts` | 7 hành trình qua ở `.cache/tien-live.log`; test discovery mới lỗi selector, sửa selector rồi riêng discovery qua ở `.cache/tien-discovery-live.log`. Tổng 8 hành trình độc lập đều đã qua; không gọi lượt đầu là 8/8. |
| Demo sạch | Manifest `.cache/demo2_e0fb1f01.json`, state=ready; SQL chỉ đọc xác nhận alice/bob đều 10000/0, ledger 10000/0. Fixture được tạo qua API register/deposit/product/auction; chỉ promote ADMIN trong DB test. |
| Kiểm tra artifact | Xem trực tiếp ảnh chụp live wallet và discovery detail; không tràn ngang ở 820px theo test. Bản frontend cuối chứa `http://localhost:8080`, không chứa `http://localhost:18080`; backend test 18080 đã kết thúc. |
| Windows đóng gói | `npm run pack:win` qua; executable mới `frontend/release/win-unpacked/OnlineBidFlow.exe`, app.asar ngày 03/10/2026 13:17 Asia/Saigon. 2/2 smoke test trên đúng executable qua: discovery BLIND/filter/retry/820px và cách ly Node/chặn cửa sổ mới/asset traversal. `.cache/tien-package.log`, `.cache/tien-packaged-smoke.log`. Smoke discovery dùng API mô phỏng; backend thật được kiểm tra ở live suite nêu trên. |
| Diff/schema | `git diff --check` qua; không đổi database/init.sql, schema hoặc quy tắc NORMAL/BLIND. Không push/merge/deploy; không thay container backend làm việc. |

### Tái hiện và xử lý trong lượt này

1. Baseline Electron 23 qua/3 lỗi: guest placeholder cũ; locator alert đăng xuất khớp cả lỗi discovery; test edit-conflict có input `200ệ` ngoài fixture. Hai lỗi test đầu được sửa đúng phạm vi. Test edit-conflict chạy lại không sửa nghiệp vụ đã qua; không kết luận đây là lỗi sản phẩm. Lượt cuối toàn bộ 26 qua.
2. Bổ sung test backend cho literal wildcard, page/size/ID biên, UTC và BLIND có bid thật. Lần đầu fixture thiếu `created_at` nên fail trước assertion; đã sửa fixture đúng schema, không sửa schema hoặc tính đó là RED nghiệp vụ. Sau sửa 5 test qua.
3. Bổ sung live discovery: dùng fixture tạo qua API thật, assert guest chỉ thấy PUBLIC, giá chính xác, bộ lọc, chi tiết/reload, PRIVATE 404, guest không đọc Admin và không có renderer error. Lỗi đầu là selector `getByLabel(..., exact:true)` trên label chứa select options; đổi sang role combobox với accessible name, kiểm chứng lại qua.
4. Thêm config gom live suite và tách `*-live.spec.ts` khỏi bộ test mock mặc định. README và registration docs được cập nhật; bổ sung `docs/discovery.md`, `docs/tien-demo.md`.
5. Không tìm được lỗi nghiệp vụ mới cần thay đổi ở account/wallet/Admin/integration qua rà code và các kiểm thử trên; không tự refactor các service đã đạt kiểm tra.

## Audit hoàn thành theo phạm vi

| Yêu cầu | Bằng chứng trực tiếp |
| --- | --- |
| Account/session/phân quyền | RegistrationIT, LoginIT, LoginLimitIT: hash, atomic user/wallet, concurrent username, CSRF, role, session rotation/logout/socket revoke. registration-live/login-live qua Electron thật. |
| Ví USER và ledger | WalletIT/WalletTransferIT: chỉ ví cá nhân, deposit/cursor, lock theo phiên, đổi leader, rollback, chống thiếu/overflow Coin, concurrent deposit/lock, settlement lặp, SYSTEM và ledger cân bằng. login-live nạp 1250, reload và lịch sử xác nhận. |
| Admin users/SYSTEM | AdminUserIT/SystemWalletIT và live tương ứng: USER/guest bị chặn, ví thiếu khác 0, tra đúng lịch sử, BIGINT/filter/cursor; SYSTEM không bị giả thành ví 0 khi lỗi. |
| Sản phẩm/cấu hình | ProductIT/AuctionConfigurationIT và live: multipart ảnh thật, reload/edit, bốn type/access, version conflict, giới hạn sửa khi có hoạt động, room join đồng thời. |
| Adapter đấu giá/realtime | AuctionWalletIntegrationIT (7), after-commit/fan-out/snapshot tests: outer transaction/lock, rollback, settlement/concurrent finish, riêng tư BLIND, UTC. Không thay thuật toán winner của nhóm. |
| Discovery | DiscoveryIT (5), discovery.spec và discovery-live; security matcher chỉ GET public projection, không mở Admin/replay. |
| Demo/tài liệu | Fixture mới đối soát khớp; `tien-demo.md` mô tả env/test/manual/reset; README đúng phạm vi hiện có. |

## Giới hạn còn tồn tại, không che bằng test xanh

- **Seed làm việc:** wallet2 lệch khả dụng −2500/khóa +2500 so ledger; wallet7–10 thiếu ledger đầu kỳ; SOLD2/8/9 thiếu PAYMENT. Snapshot mới trong `.cache/tien-working-db-audit.log`. Demo dùng USER/auction mới trong DB test; không sửa seed khi chưa biết lịch sử chuẩn, theo giới hạn Goal.
- **Npm audit 03/10/2026:** audit đầy đủ báo 13 high (hai nguồn cảnh báo lan qua dependency tree); `npm audit --omit=dev --audit-level=low` báo 0. Không diễn đạt là toàn bộ dependency sạch.
  - `braces@3.0.3` nằm dưới Tailwind/chokidar/micromatch; [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) chưa có bản vá tại thời điểm đọc. Project chỉ dùng glob cố định trong tailwind.config.js, không nhận pattern từ người dùng ứng dụng.
  - `http-cache-semantics@4.2.0` nằm dưới electron-builder → @electron/get → got/cacheable-request; [GHSA-ch52-4w7c-c8xp](https://github.com/advisories/GHSA-ch52-4w7c-c8xp). Cấu hình builder hiện không bật HTTP response cache tùy chỉnh hoặc proxy cache nhiều người dùng; đây là công cụ tải artifact build, không phải API session của ứng dụng.
  - Chưa tìm thấy đường khai thác hai cảnh báo qua chức năng runtime trong phạm vi Goal. Không nâng major Tailwind/hạ electron-builder theo `audit fix --force` chỉ để làm sạch báo cáo; các cảnh báo toolchain vẫn cần theo dõi và xử lý trong đợt dependency upgrade. Không đưa pattern không tin cậy hoặc cache xác thực dùng chung vào build.
- Bản nguồn và Windows unpacked mặc định đã kiểm chứng; không tạo bộ cài NSIS. Khi sao chép phải chuyển cả thư mục win-unpacked, không chỉ file exe. Icon/signing Windows giữ giới hạn cũ. Backend làm việc 8080 không được deploy trong Goal; demo backend mới dùng môi trường test theo hướng dẫn.
- Nạp Coin qua mất mạng không có idempotency key trong schema hiện tại: UI không tự retry và hướng người dùng kiểm tra ledger. Socket after-commit là best-effort; snapshot/replay cần được UI phòng của nhóm sử dụng.

## Phần chờ nhóm

Service nhận bid, thuật toán NORMAL/BLIND, winner, scheduler, UI phòng/chat/replay thuộc các module nhóm. Goal này kiểm chứng adapter bằng integration test và bàn giao contract; không tuyên bố luồng trả giá toàn hệ thống hoàn thành.
