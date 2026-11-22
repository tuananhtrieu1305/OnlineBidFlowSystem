# Kế hoạch livestream “Săn vé bí ẩn” — 3 phase

Trạng thái: cả 3 phase đã triển khai. Lịch sử phase 1–2 bên dưới mô tả thời điểm hoàn thành; khóa START tạm thời đã được gỡ trong phase 3. Khi người dùng nói “làm phase 1/2/3”, thực hiện đúng phase tương ứng trong tài liệu này; đọc trạng thái và code trước, cập nhật kết quả tại đây khi hoàn thành. Phase sau phụ thuộc phase trước; không tự triển khai phase khác. Nếu thiếu điều kiện, báo rõ phần còn thiếu.

## Phạm vi và phương án gọn nhất

- Thêm lựa chọn “Săn vé bí ẩn” khi Admin tạo livestream. Phiên cũ và phiên không bật lựa chọn này giữ hành vi hiện tại; không chuyển đổi phiên đang chạy.
- Tận dụng đấu giá LIVESTREAM, giữ Coin, thanh toán tự động, scheduler, WebSocket và khôi phục kết nối hiện có. Không tạo engine đấu giá/ví mới; không đổi NORMAL/BLIND, camera, chat, đăng ký hay thông báo.
- Danh mục hiện chưa có category/brand/color. Dùng mẫu nhiệm vụ cấu hình riêng cho phiên: tiêu đề + nhóm A và nhóm B chứa các sản phẩm thường hợp lệ. Ví dụ “mua bàn phím và chuột”: Admin chọn bàn phím vào A, chuột vào B. “Hai món cùng thương hiệu”: cả hai nhóm chứa hàng cùng thương hiệu. Không suy diễn thuộc tính từ tên/mô tả; không thêm thuộc tính vào danh mục chung.
- Backend yêu cầu tồn tại hai productId khác nhau, một thuộc A và một thuộc B. Một món không tính hai lần. Món bí mật không tham gia nhiệm vụ. Nhóm có thể giao nhau nhưng phải ghép được hai món khác nhau.
- Mỗi nhiệm vụ luôn cần hai sản phẩm. Đây là chuẩn tương đương về số lượng, không bảo đảm chi phí/độ cạnh tranh bằng nhau. Admin xem tổng giá khởi điểm thấp nhất của từng mẫu để cân đối; không xây thuật toán tự cân bằng.
- Giữ giới hạn hiện có 30 lot/phiên, gồm cả món bí mật khi bật mode; tối thiểu hai sản phẩm thường và một món bí mật khác các sản phẩm thường.

## Luật cố định cho cả 3 phase

1. Admin chọn đúng một món bí mật và giá khởi điểm ngay khi tạo phiên; giữ tồn kho theo cơ chế hiện có. Khóa sản phẩm, giá và cấu hình nhiệm vụ từ lúc lưu phiên. Không có tính năng sửa cấu hình sau lưu trong phạm vi này.
2. Khi USER lần đầu vào phòng đang SCHEDULED/LIVE, cấp ngẫu nhiên một mẫu còn khả thi, lưu riêng theo (sessionId, userId). Đăng ký trước vẫn chỉ dùng để nhận thông báo. Không cấp cho host, phiên đã kết thúc hoặc vòng cuối đã tiết lộ. Tải lại/ra vào lại không đổi nhiệm vụ, kể cả nhiệm vụ về sau không còn khả thi do đối thủ mua mất.
3. Mẫu khả thi lúc cấp phải có ít nhất một cặp sản phẩm khác nhau chưa SOLD, có thể còn được đấu (QUEUED/PRESENTING/OPEN/UNSOLD). Lot OPEN đã hết hạn hoặc có người dẫn đầu phải được xử lý theo trạng thái authoritative trước khi quyết định; không coi món thực tế đã chốt là còn hàng. Không có mẫu phù hợp: thông báo không còn nhiệm vụ khả thi, vẫn được xem/chat/đấu hàng thường; chưa ghi nhận nhiệm vụ thì có thể kiểm tra lại khi vào phòng lần sau.
4. Chỉ tính hàng thường mua trong chính phiên đó và đã thanh toán thành công. Sau settlement thành công, kiểm tra nhiệm vụ và cấp tối đa một vé không chuyển nhượng cho user. Cập nhật trong cùng transaction để rollback không phát vé; retry/reconnect không cấp trùng. Không thu thêm Coin để cấp vé.
5. Nhiệm vụ và tiến độ chỉ trả cho chủ nhiệm vụ qua dữ liệu cá nhân. Host chỉ thấy tổng số vé. Không broadcast danh sách nhiệm vụ hay danh tính người có vé; không hứa che được suy đoán từ lịch sử đấu giá công khai.
6. Khi và chỉ khi tất cả hàng thường SOLD và có ít nhất một vé, backend chuyển vòng cuối sang REVEALED và công bố món + giá, sau đó host mới mở đấu bằng thao tác hiện có. Không bắt đầu đồng hồ/nhận giá ngay trong bước tiết lộ.
7. Trước REVEALED, dữ liệu dành cho người xem/khách chỉ có placeholder hộp “?”; không lộ productId/auctionId, tên, ảnh, mô tả, giá hay thông tin dẫn xuất nhận diện món bí mật qua list/detail/state/snapshot/WebSocket/results hoặc API auction/discovery/replay liên quan. Admin có quyền biết cấu hình đã tạo; kiểm tra quyền tại server.
8. Backend chặn SELECT/NEXT/REOPEN/OPEN và mọi đường đặt giá trực tiếp có thể vượt điều kiện vòng cuối. Vé là điều kiện bổ sung cho quyền đặt giá, không thay thế kiểm tra Coin, presence, host health và thời hạn hiện có.
9. Một người có vé vẫn phải chủ động đặt giá ít nhất bằng giá khởi điểm và thanh toán theo engine hiện có; không tự mua. Có thể bỏ qua; host kết thúc lượt/phiên theo luồng hiện có. Nhiều người có vé vẫn có thể không đủ Coin hoặc không đặt giá; không tự trừ tiền.
10. Không ai có vé, còn bất kỳ hàng thường chưa SOLD, host kết thúc sớm hoặc phiên hết thời gian phục hồi: không tiết lộ món bí mật nếu chưa mở. Giải phóng phần tồn kho/hold chưa bán theo cơ chế hiện có; các giao dịch đã thanh toán giữ kết quả. Nếu đã REVEALED thì không che lại. Công khai điều kiện này trước khi người dùng tham gia.

## Phase 1 — Cấu hình Admin và dữ liệu nền

Mục tiêu: tạo và lưu được phiên mới, giữ nguyên phiên cũ, dữ liệu bí mật không bị lộ.

- Migration Flyway kế tiếp (kiểm tra số đang có khi làm; không sửa V1): cờ mode mặc định tắt; phân loại lot thường/bí mật; trạng thái vòng cuối DISABLED/LOCKED/REVEALED/OPEN/SOLD/SKIPPED phù hợp engine; bảng mẫu nhiệm vụ, hai nhóm sản phẩm, nhiệm vụ đã cấp và vé (unique session/user). Giữ trạng thái lot hiện tại, không dùng cột `phase` sẵn có để chỉ loại lot.
- Mở rộng `LiveInput`, `LiveService.create` và kiểm tra requestId retry để bao gồm toàn bộ cấu hình mới. Validate nhóm, giá, giới hạn, productVersion, tồn kho và loại trừ món bí mật; lỗi phải rollback toàn bộ.
- Thêm phần bật mode, chọn món bí mật/giá và cấu hình mẫu nhiệm vụ ở `HostLivestreamPages.tsx`; mở rộng `liveState.ts`, `useLivestream.ts` và catalog picker chỉ ở chỗ cần thiết.
- Phân tách dữ liệu Admin/public trong `LiveQueries`; che món bí mật trên mọi đường đọc liên quan. Đặt guard server ngăn đưa món cuối lên sớm ngay trong phase này. Chuẩn bị contract dữ liệu cá nhân cho phase 2.
- Không cho khởi chạy phiên mode mới khi luồng chơi còn chưa hoàn thiện (khóa tạm ở server đến phase 3); livestream thường vẫn chạy bình thường.

Kiểm chứng: tạo phiên thường và mode mới; reject cấu hình sai/trùng/thiếu stock; retry không tạo trùng; migration trên dữ liệu cũ; khách/USER không đọc được bí mật bằng API trực tiếp. Frontend typecheck và test tạo phiên liên quan.

Hoàn thành khi: Admin lưu được cấu hình hợp lệ, dữ liệu được khóa và bảo vệ, phiên cũ không thay đổi. Trạng thái: DONE (22/11/2026).

Kết quả phase 1:
- Thêm V4, `LiveMysteryConfig`, DTO cấu hình tùy chọn và lưu mẫu nhiệm vụ/hai nhóm; phiên cũ mặc định DISABLED, retry so sánh đầy đủ cấu hình. Có sẵn bảng nhiệm vụ đã cấp/vé cho phase 2, chưa phát nhiệm vụ/vé.
- `LiveQueries` phân quyền dữ liệu Admin/khách/USER; món bí mật không có productId/auctionId/giá/ảnh thật ở payload công khai. Các gateway discovery/room/replay cũ đã loại LIVESTREAM nên không cần sửa.
- Admin có checkbox mode, chọn món bí mật từ danh sách, cấu hình nhiều mẫu nhiệm vụ, xem tổng giá khởi điểm thấp nhất. Nút “Cấu hình nhanh phiên Săn vé bí ẩn demo” đọc tối đa 5 sản phẩm thật còn khả dụng, lấy lại thông tin/version, điền giá ước tính (fallback 100 Coin), chọn một món bí mật và tối đa ba mẫu nhiệm vụ theo tên sản phẩm thật. Nút chỉ điền biểu mẫu; người dùng kiểm tra rồi Lưu. Thiếu ba sản phẩm thì báo lỗi, không tạo dữ liệu giả.
- Phase 1 khóa mọi command mode mới ngoài END ở backend; UI không hiện nút START. Phiên thường dùng luồng cũ.
- Kiểm chứng: frontend typecheck/build; 7 Vitest; 5 Electron E2E tạo phiên/ảnh danh mục (3 test tạo phiên chạy lại trên bản cuối); ảnh màn hình demo đã được rà. Backend 24 test qua: LivePolicyTest (2), LiveMysteryConfigTest (6), LiveIT (9), LiveSelectionIT (5), LiveMysteryIT (1), LiveMysteryMigrationIT (1). Test backend cuối dùng JDK 25 hiện có, compile target 21, Byte Buddy experimental; MySQL 8.4 container riêng cổng 33319. Không thay dependency.
- V4 nâng cấp schema có livestream trước đó đã qua test và giữ dữ liệu/cờ mặc định. Kiểm tra full fresh-install bằng LiveMigrationIT bị chặn bởi lỗi có sẵn ở V3: V0 không tạo blind_clues nhưng V3 ALTER bảng đó. Không sửa V0/V3 ngoài phạm vi; test chức năng dùng database/init.sql trong container test riêng theo tài liệu repo.
- Chưa deploy/restart backend chính hay migrate database chính. Khi chạy bản backend mới trên database đã khởi tạo đầy đủ, Flyway áp dụng V4. Phase 2 tiếp tục từ schema/contract này; phase 3 mới gỡ khóa bắt đầu chơi.

## Phase 2 — Nhiệm vụ riêng và cấp vé

Mục tiêu: vào phòng nhận nhiệm vụ bền vững, mua đúng hai món thì nhận đúng một vé.

- Thêm service nhiệm vụ riêng trong package livestream để tránh phình `LiveService`; nối vào join và settlement thành công (`sold`). Dùng khóa phiên hiện có và unique constraints chống race.
- Cấp mẫu theo hai nhóm còn khả thi, xử lý người vào muộn, không đổi nhiệm vụ đã cấp. Đối chiếu hai productId khác nhau và kết quả thanh toán của chính user trong phiên.
- Snapshot cá nhân chứa nhiệm vụ, tiến độ 0/2–2/2 và vé; dữ liệu phiên chỉ có tổng số vé. Tận dụng snapshot theo actor và sự kiện AFTER_COMMIT hiện có; kiểm tra state merge không giữ dữ liệu cá nhân khi đổi tài khoản/phiên hoặc nhận snapshot cũ.
- Bổ sung ô nhiệm vụ/tiến độ/vé trong `LivestreamRoomPage.tsx`, trạng thái không còn mẫu khả thi, nhắc giữ Coin; host chỉ có số vé. Không thay bố cục camera/chat hay quy trình mua hiện có.

Kiểm chứng: hai nhóm giao nhau không đếm một món hai lần; thắng chưa thanh toán/rollback không có vé; thanh toán lần hai đủ bộ có vé; retry/concurrent settlement không cấp trùng; reload/rejoin và restart giữ nhiệm vụ; vào muộn/no eligible template; user khác/host không đọc được nhiệm vụ; phiên thường không bị tác động.

Hoàn thành khi: luồng nhiệm vụ và vé chạy đúng backend + UI, bí mật vẫn khóa và mode mới chưa mở cho phiên chơi thực tế. Trạng thái: DONE (22/11/2026).

Kết quả phase 2:
- Thêm `LiveMissionService` dùng schema V4, không thêm migration/dependency. Cấp ngẫu nhiên một template khả thi tại USER join đầu tiên; lưu theo session/user. Không cấp khi PAUSED/ENDED/đã tiết lộ hoặc cho host/Admin; rejoin giữ nhiệm vụ đã lưu. Không có template thì giữ trạng thái chưa cấp để có thể kiểm tra lại lần join sau.
- `LiveService.join` xử lý tick cho mode bí ẩn trước khi cấp nhiệm vụ để chốt lượt quá hạn hoặc pause khi host mất lease. OPEN còn hạn và đang có người dẫn đầu vẫn có thể tranh mua nên còn hợp lệ; SOLD không dùng để tạo nhiệm vụ mới.
- `LiveService.sold` gọi `afterPaid` sau settlement và đánh dấu lot SOLD, trước sự kiện LOT_SOLD. Tiến độ đòi hỏi món REGULAR cùng phiên, đúng winner và bút toán PAYMENT của ví USER; hai nhóm phải khớp hai productId khác nhau. Vé unique session/user, cùng transaction và khóa phiên với thanh toán; lỗi/retry/concurrent không để lại vé thừa.
- Snapshot riêng có root `mission` (sessionId/userId/version, status, title, groupA/groupB với tên và purchased, progress, ticket). List/detail/state không chứa nhiệm vụ đã cấp. Snapshot Admin trả mission=null; chỉ dữ liệu Admin có ticketCount, không có danh sách người có vé. Template cấu hình Admin đã có từ phase 1 không phải dữ liệu nhiệm vụ đã cấp cho từng người.
- `liveState.ts` chỉ nhận nhiệm vụ đúng actor/phòng/revision. Xóa nhiệm vụ khi vào/rời phòng và khi đổi tài khoản theo auth epoch hiện có; snapshot cũ hoặc nhiệm vụ của actor/phòng khác không ghi đè. Catalog refresh không làm mất nhiệm vụ trong phòng hiện tại.
- UI `LiveMissionPanel` thêm vào cột đấu giá hiện có: nhiệm vụ riêng, tiến độ 0/2–2/2, danh sách hàng hợp lệ gấp gọn, trạng thái không còn nhiệm vụ và thông báo có vé/giữ Coin; host chỉ thấy tổng số vé. Dùng progress HTML và status thông báo mà không đổi focus, camera/chat không bị dựng lại.
- Kiểm chứng: frontend typecheck/build; 11 Vitest (gồm snapshot cũ, sai actor/phòng/version và reset nhiệm vụ); 8 Electron E2E (3 nhiệm vụ + 5 điều khiển livestream cũ), đã rà ảnh UI. Backend 32 test qua: LiveMissionIT (9) + LiveMysteryIT (1), LiveIT (9), LiveSelectionIT (5), LivePolicyTest (2), LiveMysteryConfigTest (6). Bộ 31 test chạy đầy đủ, sau đó chạy lại 9 test nhiệm vụ khi bổ sung nhánh người khác mua/món ngoài nhiệm vụ. Backend dùng JDK 25/target 21 + Byte Buddy experimental và MySQL test riêng cổng 33319 như phase 1.
- Bao phủ nhiệm vụ bền vững sau rejoin/khởi tạo lại service đọc DB, riêng tư, nhóm giao nhau, thắng đang giữ Coin chưa thanh toán, rollback ngay sau ghi vé rồi retry, template phù hợp hàng còn lại, không khả thi, overdue sale, trạng thái đóng/tạm dừng và join/settlement đồng thời. Chưa chạy restart toàn bộ tiến trình backend; dữ liệu lưu DB được kiểm tra qua service mới.
- Vẫn giữ khóa command mode mới ngoài END. Test settlement dùng fixture DB mở lot để kiểm chứng backend; không thêm đường bypass vào sản phẩm. Phase 3 mới gỡ khóa, thêm điều kiện tiết lộ/quyền đặt giá vòng cuối và nghiệm thu luồng end-to-end thật. Chưa deploy/restart backend chính hay thay database chính.

## Phase 3 — Vòng bí mật, tích hợp và nghiệm thu

Mục tiêu: hoàn chỉnh phiên từ Admin tạo đến kết quả vòng cuối.

- Sau giao dịch cấp vé/chốt món thường cuối, đánh giá điều kiện và chuyển REVEALED đúng một lần trong transaction. Khôi phục/retry không bỏ sót hoặc tiết lộ hai lần.
- Mở rộng command hiện có để host đưa món đã REVEALED lên giới thiệu và OPEN; SELECT/NEXT không tự bỏ qua điều kiện. Chặn đặt giá không có vé tại backend trước khi ghi bid/giữ Coin; rà đúng các entry point đấu giá có thể chạm lot LIVESTREAM.
- Dùng lại countdown 5 giây, giữ/trả Coin, chốt mua, gavel, pause/resume, timeout và kết quả hiện có. Đồng bộ trạng thái vòng cuối khi sold/end/timeout; không tiết lộ món bị bỏ qua.
- UI hộp “?” trước mở; sau REVEALED hiển thị đầy đủ sản phẩm/giá rồi mới cho host mở đấu. USER có vé thấy đặt giá, còn lại thấy lý do khóa nhưng tiếp tục xem/chat. Kết quả phân biệt món thường, món cuối đã bán/chưa bán/không mở; món không mở tiếp tục che ở phía người xem.
- Hiển thị luật ở bước tạo/chi tiết và phòng live trước tham gia. Gỡ khóa khởi chạy mode mới sau khi luồng đầy đủ đã được kiểm chứng; cập nhật `docs/livestream.md` ở phần liên quan.
- Review diff theo phạm vi; chạy test backend livestream và hồi quy ví/settlement liên quan; frontend typecheck/build + test livestream; E2E luồng Admin tạo → hai USER nhận nhiệm vụ → mua đủ → nhận vé → bán hết → tiết lộ → chặn người không vé → chốt món cuối. Dùng database test riêng theo `docs/livestream.md`, không reset database chính.
- Bao phủ thêm: một người có vé mua/bỏ qua; nhiều vé nhưng không bid/thiếu Coin; không vé; còn hàng UNSOLD; host kết thúc sớm; disconnect/restart trước và trong vòng cuối; request lặp; kiểm tra payload không rò bí mật. Kiểm tra các luồng livestream thường, NORMAL/BLIND liên quan vẫn qua test hiện có.

Hoàn thành khi: kịch bản đầy đủ và các nhánh đặc biệt qua kiểm chứng, không có thay đổi ngoài phạm vi cần thiết. Ghi rõ các kiểm tra không chạy được và nguyên nhân, không báo hoàn tất kiểm chứng thay cho kết quả thật. Trạng thái: DONE (22/11/2026).

Kết quả phase 3:
- Thêm `LiveFinalService`, không thêm migration/dependency. Gỡ guard tạm khóa mode mới. Sau settlement + cấp vé, chuyển LOCKED → REVEALED cùng transaction khi tất cả lot REGULAR đã SOLD và có vé; tick phục hồi đánh giá lại có điều kiện, không phát lại sự kiện nếu không đổi trạng thái.
- Giữ món hiện tại sau chốt để gavel hiện có hoạt động. Host chọn/đưa món bí mật lên PRESENTING sau khi đã tiết lộ, rồi chủ động OPEN. NEXT lọc món bí mật chưa đủ điều kiện; SELECT/REOPEN/OPEN/START kiểm tra server. Bid cuối phải có vé đúng phiên, trước INSERT/giữ Coin; các kiểm tra presence, Coin, deadline, lease vẫn giữ nguyên. Một người có vé vẫn phải chủ động đặt giá, không tự mua.
- Trạng thái cuối: SOLD nếu đã bán; SKIPPED nếu kết thúc khi còn LOCKED; REVEALED nếu đã công bố nhưng không bán. OPEN giữ nguyên qua pause/resume; kết thúc khi không có bid hoặc timeout trả hold theo engine hiện có. Không che lại món đã tiết lộ, món chưa tiết lộ vẫn che cả sau ENDED.
- Các cổng NORMAL/BLIND và legacy room/replay đã loại LIVESTREAM; không sửa ngoài module để tránh tác động mode khác. Payload công khai/list/state/snapshot không lộ bí mật trước điều kiện; dữ liệu nhiệm vụ riêng tiếp tục dùng contract phase 2.
- UI bật START, hộp “?”, thông báo công bố + giá, nút đưa món cuối lên và lý do không có quyền đặt giá. Thêm luật ở form/chi tiết/phòng; kết quả phân biệt không mở với đã công bố chưa bán/đã bán. Giữ bảng giá/input/nút bid ở đầu cột bằng tóm tắt nhiệm vụ/vé gọn; các panel chi tiết nằm dưới, không thay camera/chat.
- Kiểm chứng backend: 49 test livestream/ví qua gồm LiveMissionIT (19, có 10 nhánh vòng cuối mới), LiveIT (9), LiveSelectionIT (5), LiveMysteryIT (1), LiveMysteryConfigTest (6), LivePolicyTest (2), AuctionWalletIntegrationIT (7). Scheduler tự động tắt trong bộ fixture thủ công để Spring context ví không pause phiên của context khác. Backend JDK 25/target 21 và Byte Buddy experimental như phase trước.
- Kiểm chứng frontend: typecheck/build; 11 Vitest; 16 Electron E2E dùng fixture (tạo 3, điều khiển 5, nhiệm vụ/vòng cuối 5, kết quả 3). Đã rà ảnh UI bản cuối. Các test mới đợi tải trang Electron trước khi mock để tránh race điều hướng lúc bootstrap.
- E2E thật `frontend/e2e/livestream-mystery-real.spec.ts`: PASS, ba cửa sổ Electron, Admin tạo 3 sản phẩm + phiên qua API thật, hai USER nhận nhiệm vụ qua WebSocket, USER mua hai món → có vé → tiết lộ → host đưa lên/OPEN → USER không vé bị HTTP 403 TICKET_REQUIRED nhưng chat được → USER có vé mua món cuối. Scheduler/giữ Coin/thanh toán thật; cuối cùng có 3 đơn, số dư 1.700/0 Coin từ 2.000. Chỉ thay camera bằng canvas để không yêu cầu thiết bị vật lý. Màn hình cấu hình Admin được kiểm tra riêng bằng E2E UI. Không kiểm thử thiết bị/Radmin thật trong phase này. Nhánh restart phục hồi gọi tick(restart=true) trên dữ liệu DB; không kill/restart cả tiến trình ngay giữa lượt đấu trong E2E.
- Môi trường E2E: MySQL container riêng `onlinebidflow-mystery-test`, cổng 33319, schema mới `auction_mystery_e2e_p3_2136`; backend cổng 18082. Build test từng trỏ 18082, build bàn giao đã trả về API mặc định localhost:8080. Không migrate/restart hay thay dữ liệu database chính.
- Hồi quy NORMAL/BLIND: 4/10 NormalApiTest lỗi thiếu product_gallery_images trong schema H2 test; 3/10 BlindGameIT lỗi assertion mã hóa JSON tên sản phẩm và kiểm tra online-start cũ. Đã chạy lại cùng hai suite trên bản sao HEAD riêng `.runtime/phase3-baseline`: trùng đúng 4 lỗi NORMAL và 3 lỗi BLIND, không phải phát sinh từ ba phase. Với H2 phải tắt Flyway vì migration MySQL V0 dùng UTC_TIMESTAMP; không sửa test/schema/mode khác ngoài phạm vi. Lỗi fresh-install V3 nêu ở phase 1 vẫn tồn tại.
- Đường chạy lại E2E thật: khởi tạo schema dành riêng từ database/init.sql trong container test (không dùng DB chính), bật backend scheduler thật ở 18082; build frontend với VITE_API_BASE_URL cùng origin; chạy Playwright với LIVESTREAM_MYSTERY_E2E=true, LIVESTREAM_API_URL và LIVESTREAM_TEST_DATABASE trỏ schema có prefix auction_mystery_e2e. Xem docs/livestream.md.
- Các phase đã hoàn thành; bước triển khai vào môi trường chính là công việc riêng, chưa thực hiện trong phiên này.

## Quy tắc thực hiện mỗi phase

- Chỉ thêm dependency nếu chứng minh stack hiện tại không đủ; phương án mặc định không thêm dependency.
- Trước khi sửa UI, đọc Modern Web Guidance và áp dụng theo React/Electron hiện tại. Khi triển khai quyền, input và giao dịch, áp dụng skill security-review; kiểm thử theo quy ước repository.
- Đọc hướng dẫn AGENTS.md áp dụng và diff hiện có trước khi sửa. Không đụng thay đổi ngoài nhiệm vụ của người dùng.
- Cuối phase: review diff, chạy kiểm tra liên quan, cập nhật TODO thành DONE/PARTIAL kèm tóm tắt file thay đổi và kiểm chứng. Không tự chạy phase kế tiếp.
