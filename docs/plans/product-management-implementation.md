# Implementation plan — Admin quản lý sản phẩm

Ngày: 2026-10-01. Trạng thái: đã triển khai; hợp đồng và hướng dẫn thực tế tại [products.md](../products.md).
Chủ sở hữu: Phạm Bá Tiến. Baseline: pbtien, module ví đã hoàn thành ở 6a5234c.

## 1. Mục tiêu và phạm vi

Admin có thể đăng nhập, xem/tìm sản phẩm, thêm sản phẩm có ảnh, xem chi tiết và sửa sản phẩm chưa sử dụng. Sản phẩm được lưu thật trên MySQL; ảnh nằm trên server trung tâm để mọi desktop client truy cập được. Dữ liệu sản phẩm sẵn sàng cho bước tạo phiên tiếp theo.

Bao gồm API, giao diện Electron, lưu ảnh bền vững trong Docker, phân quyền và kiểm thử. Không triển khai tạo phiên, bid, winner, thống kê giá, quản lý người dùng hoặc ví hệ thống trong mốc này. Không thêm nút “Tạo phiên” không hoạt động; bổ sung khi module cấu hình phiên được triển khai.

Không đổi schema, không chạy lại init.sql, không xóa volume. Các quy tắc mới đề xuất dưới đây phải được ghi rõ khi bàn giao nhóm, không coi là quy tắc đã có trong SYSTEM_SPEC.

## 2. Kết quả khảo sát repository

- products có id, name VARCHAR(255), description TEXT nullable, estimated_price BIGINT UNSIGNED nullable, quantity INT UNSIGNED, image_url VARCHAR(500) nullable.
- Product entity hiện chỉ có getters; ProductRepository mới kế thừa JpaRepository.
- auctions.product_id tham chiếu trực tiếp products. Một sản phẩm được dùng ở nhiều phiên. Chưa có product snapshot/version, thời gian tạo/sửa hoặc soft delete.
- AdminPage mới là placeholder. AuthProvider, session, CSRF và kiểm tra ADMIN ở /api/admin/** đã có.
- TEAM_CONVENTIONS yêu cầu Admin API nằm trong module product; ProductResponse của người dùng không chứa estimated_price.
- Realtime ProductSnapshot hiện có productId, name, description, imageUrl; không có estimatedPrice. Không đổi hợp đồng realtime trong mốc này.
- CSP ở frontend/vite.config.ts chỉ cho img-src self/data, nên ảnh HTTP từ backend hiện sẽ bị chặn. Phải cập nhật đúng origin backend và blob preview.
- Spring Boot 3.3.5/Java21, JPA, Bean Validation đã có. Không cần nâng framework hay thêm thư viện UI để làm chức năng này.

## 3. Quyết định đề xuất

### 3.1 Sản phẩm đã dùng trong phiên

Đề xuất mốc đầu: nếu tồn tại bất kỳ auction tham chiếu product, chỉ cho xem, không sửa bất kỳ trường nào, kể cả ảnh và quantity. Áp dụng cả UPCOMING/RUNNING/SOLD/UNSOLD để giữ thông tin nhất quán giữa phòng, lịch sử và Replay.

Đây là chính sách đề xuất vì schema không có snapshot; SYSTEM_SPEC chưa quy định chi tiết quyền sửa. Nếu nhóm cần sửa UPCOMING hoặc chỉnh sản phẩm đã bán mà vẫn giữ lịch sử cũ, cần thiết kế snapshot/version riêng trước, không sửa âm thầm qua UI.

Không triển khai xóa trong mốc này: chưa có yêu cầu rõ và xóa sản phẩm đã liên kết phá lịch sử. Không giả lập archive bằng cách sửa tên. Cho phép tên sản phẩm trùng vì schema không có unique name. Không tự copy sản phẩm để né khóa sửa vì product ID cũng dùng tổng hợp lịch sử giá.

quantity được quản lý như thông tin sản phẩm/lô hàng theo schema hiện tại, không tự trừ tồn kho hoặc ngăn bán lại; semantics tồn kho thuộc quyết định nhóm riêng.

### 3.2 Dữ liệu nhập

| Trường | Hợp đồng đề xuất |
| --- | --- |
| name | Trim, bắt buộc 1–255 Unicode code points; không HTML |
| description | Plain text, tùy chọn; tối đa 5.000 code points và không vượt dung lượng TEXT UTF-8; rỗng chuẩn hóa null |
| quantity | JSON integer, 1..2.147.483.647 (giới hạn Integer Java), không nhận số dạng chuỗi/thập phân/coerce |
| estimatedPrice | Chuỗi số nguyên chuẩn 1..Long.MAX_VALUE hoặc null; rỗng UI chuyển null; nhãn “Giá ước tính (Coin) — chỉ Admin thấy” |
| image | Tùy chọn, một JPEG/PNG; thiếu ảnh dùng placeholder |

Giới hạn mô tả, ảnh và giá dương là lựa chọn cho form mới; không sửa dữ liệu legacy chỉ vì không đạt form mới. Từ chối trường lạ, trường hệ thống, JSON lỗi. ID/BIGINT response dùng chuỗi thập phân như module ví. Chỉ cập nhật các trường trong DTO cho phép.

## 4. API dự kiến

Tất cả metadata API yêu cầu ADMIN; mutation cần session + CSRF, lấy danh tính từ server.

| Method/route | Nội dung |
| --- | --- |
| GET /api/admin/products?q=&page=0&size=20 | Danh sách, tìm tên hoặc ID khớp chính xác; size tối đa 100 |
| GET /api/admin/products/{id} | Chi tiết, ETag, quyền sửa |
| POST /api/admin/products | Multipart: data JSON và image tùy chọn; trả 201 + Location + DTO |
| PUT /api/admin/products/{id} | Multipart thay thế metadata, image tùy chọn, If-Match bắt buộc; trả 200 + ETag mới |
| GET /api/product-images/{generatedName} | Chỉ nội dung ảnh đã chuẩn hóa, không metadata sản phẩm |

JSON create: name, description, quantity, estimatedPrice. JSON update thêm imageAction = KEEP/REPLACE/REMOVE; REPLACE bắt buộc file, KEEP/REMOVE không nhận file. Không cho client gửi đường dẫn file hoặc URL ảnh tùy ý. Response dùng imageUrl là đường dẫn tương đối do server sinh, frontend resolve với API base URL.

AdminProductResponse: id, name, description, quantity, estimatedPrice, imageUrl, editable, editBlockedReason. Danh sách trả items/page/size/totalElements/totalPages, order id DESC ổn định; không thêm sort tùy ý. Tổng số nên trả chuỗi nếu dùng Long. q tối đa 255 code points, trim; SQL có bind parameters và escape ký tự LIKE %, _, escape char để tìm literal. Không query một lần mỗi sản phẩm để biết editable: dùng projection EXISTS hoặc truy vấn batch IDs.

Chưa cần public product metadata endpoint. Nếu bổ sung sau, tạo DTO riêng không estimatedPrice và kiểm tra quyền truy cập phiên PRIVATE; không tái dùng AdminProductResponse.

Ảnh được coi là tài nguyên không bí mật, route chỉ đọc permitAll với tên ngẫu nhiên, không directory listing. Điều này không cấp quyền xem metadata/phòng PRIVATE. Nếu nhóm coi bản thân ảnh PRIVATE là bí mật, phải đổi thiết kế route ảnh có kiểm tra quyền phòng trước khi triển khai luồng PRIVATE.

Lỗi: 400 input/ID sai; 401 chưa đăng nhập; 403 USER/CSRF; 404 không tồn tại; 409 PRODUCT_IN_USE; 412 PRODUCT_CHANGED; 413 file/request quá lớn; 415 định dạng ảnh không hỗ trợ; 428 thiếu If-Match; 500 lỗi server an toàn. Body thống nhất code/message/fieldErrors khi phù hợp, không lộ SQL/đường dẫn đĩa.

## 5. Transaction và chỉnh sửa đồng thời

- Create/update metadata trong ProductService @Transactional, READ_COMMITTED.
- Update: khóa product bằng PESSIMISTIC_WRITE, kiểm tra auction tồn tại bằng current committed query, so sánh If-Match rồi mới ghi. Không chỉ dựa vào editable từ frontend.
- ETag không cần schema mới: SHA-256 của biểu diễn canonical các trường persisted và product ID, UTF-8, null rõ ràng; không hash chuỗi ghép mơ hồ. Đọc ETag chỉ phục vụ chống ghi đè form cũ, không phải authorization.
- Hai Admin mở cùng sản phẩm: người lưu sau với ETag cũ nhận 412 và được tải lại, không ghi đè im lặng. ABA (đổi rồi trả lại đúng giá trị) không được phát hiện; chấp nhận mốc này, muốn audit/version đơn điệu cần schema.
- Module tạo phiên sau này bắt buộc khóa cùng product trước khi gắn auction. Như vậy create-auction và update-product được tuần tự hóa: nếu phiên đã gắn trước thì update bị chặn. Viết contract test dùng transaction giả lập tạo phiên, chưa viết nghiệp vụ tạo phiên.
- Mốc này không khóa wallet, không phát socket. Khi tích hợp cấu hình phiên có cả product/auction locks, nhóm phải thống nhất thứ tự trên mọi đường cập nhật; không đưa product lock vào luồng bid hiện tại.

## 6. Upload và lưu ảnh

Dùng multipart ngay lúc lưu sản phẩm để không có endpoint upload nháp riêng. Chọn file bằng input native trong renderer; không mở quyền filesystem qua Electron preload.

- Chỉ JPEG/PNG, tối đa 5 MiB/file và tối đa 16 triệu pixel; kiểm tra dimensions trước decode, giới hạn request khoảng 6 MiB. Kiểm tra nội dung thực bằng decoder, không tin extension/MIME client.
- Decode rồi encode lại thành ảnh chuẩn để bỏ metadata; không nhận SVG/GIF/HTML, không tải URL người dùng cung cấp. Tên sinh UUID + extension do server quyết định, bỏ tên gốc.
- Lưu ngoài source/static classpath bằng PRODUCT_IMAGE_DIR. Docker mount named volume product_images; không ghi vào filesystem tạm của container. Local dev dùng thư mục runtime ignored bởi Git.
- Đường dẫn resolve/normalize nằm trong storage root; route chỉ nhận generatedName whitelist, chống traversal và symlink escape. Trả đúng Content-Type, nosniff; không phục vụ file tùy ý.
- Validate/encode file vào staging trước transaction để tránh giữ DB lock lâu. Sau khi lấy khóa và xác nhận điều kiện, move sang tên immutable cuối trước khi commit DB; thất bại file => rollback. Rollback bình thường => dọn file mới bằng transaction synchronization.
- DB và filesystem không có transaction chung. Crash có thể để file mồ côi; chấp nhận không mất ảnh đã commit. Không xóa ảnh cũ ngay sau đổi/remove; cơ chế đối soát chỉ đọc và cleanup có grace period triển khai sau, không quét xóa tự động ở mốc này.
- Test restart backend/container vẫn tải được ảnh; backup phải gồm database và image volume. Sửa ảnh không ghi đè cùng tên, tránh cache sai.
- CSP: thêm đúng origin của API và blob: vào img-src, giữ sandbox/webSecurity; không mở wildcard https: hoặc unsafe script.
- Preview bằng URL.createObjectURL và revoke khi thay ảnh/unmount. Với ảnh seed có URL ngoài storage: hiện placeholder nếu không nằm trong origin cho phép, không mở CSP toàn internet để hỗ trợ seed.

## 7. Giao diện

Giữ #F6F5F1/#145C53, Be Vietnam Pro, card 12px, input/button 8px. Tận dụng AppLayout/AuthProvider hiện có, thêm mục “Sản phẩm” cho ADMIN; không refactor toàn router/layout.

Routes: /admin/products, /admin/products/new, /admin/products/:id, /admin/products/:id/edit.

Danh sách: tiêu đề “Sản phẩm”, nút “Thêm sản phẩm”, tìm kiếm debounce ~300ms, bảng thumbnail 4:3/tên/mã/số lượng/giá ước tính/trạng thái sửa; phân trang phía server. Dùng AbortController hoặc request generation để kết quả tìm kiếm cũ không đè kết quả mới. Không có số liệu trang trí.

Form: hai cột thông tin và ảnh preview; tại cửa sổ 820px chuyển một cột hoặc bố cục không tràn ngang. Các trường có nhãn, lỗi ngay dưới field, focus lỗi đầu. Mô tả plain text, không dangerouslySetInnerHTML. Có loading, rỗng, lỗi tải và thử lại. Không tự retry POST khi mất mạng; thông báo kết quả chưa xác định và cho quay lại danh sách kiểm tra (schema chưa có create idempotency key).

Trang chi tiết sản phẩm đã dùng: thông báo “Sản phẩm đã được dùng trong phiên đấu giá nên không thể chỉnh sửa.” Server trả editBlockedReason; không hiển thị nút sửa khả dụng. Khi form đang mở rồi sản phẩm được gắn phiên, 409 phải được xử lý rõ.

Submit chặn double click, chỉ báo thành công sau response; lỗi giữ dữ liệu nhập. 412 hướng dẫn tải bản mới, không âm thầm bỏ bản người dùng đang nhập. 401/403 xóa dữ liệu Admin khỏi view, dùng auth flow hiện có. Cảnh báo rời form có thay đổi qua điều hướng trong app; không hứa bảo toàn draft khi đóng Electron/crash.

## 8. File dự kiến

```text
backend/.../product/
  controller/AdminProductController.java
  controller/ProductImageController.java
  controller/ProductExceptionHandler.java
  service/ProductService.java
  service/ProductImageStorage.java
  service/ProductVersion.java
  dto/CreateProductRequest.java
  dto/UpdateProductRequest.java
  dto/AdminProductResponse.java
  dto/ProductPageResponse.java
  entity/Product.java                       # bổ sung factory/update có kiểm soát
  repository/ProductRepository.java         # list/projection/locking
frontend/src/features/products/
  api/productApi.ts
  types.ts
  validation.ts
  pages/ProductListPage.tsx
  pages/ProductDetailPage.tsx
  pages/ProductFormPage.tsx
  components/ProductForm.tsx
  components/ProductImageInput.tsx
  products.css
```

Các file dùng chung cần thay đổi nhỏ: SecurityConfig, application.yml (storage/multipart), docker-compose.yml (volume), .env.example/.gitignore, AppLayout, router/index.tsx, vite.config.ts, README. Không chuyển toàn bộ cấu trúc thư mục hay tạo folder rỗng. Không tạo layer repository trùng lặp bằng JDBC khi JPA hiện tại đủ dùng.

## 9. Trình tự triển khai

1. Chốt contract DTO, policy khóa sửa, ảnh; viết API/validation tests RED trên DB kiểm thử riêng.
2. Backend list/detail/create/update, mapping DTO riêng, quyền/CSRF/error; chạy MySQL IT.
3. Thêm ETag và khóa product; test hai Admin và race với gắn phiên.
4. ImageStorage và multipart, rollback file, route đọc ảnh, volume/CSP; test ảnh độc hại, traversal, restart.
5. Giao diện list/detail/form/upload và đầy đủ trạng thái; giữ nguyên auth/wallet/realtime.
6. Electron E2E với API mock và một lượt live backend/MySQL/upload thật; regression toàn dự án.
7. Cập nhật docs/products.md và hợp đồng cho module tạo phiên, review diff, audit, commit theo mốc; không push khi chưa được yêu cầu.

## 10. Ma trận kiểm thử / tiêu chí hoàn thành

| Nhóm | Trường hợp bắt buộc |
| --- | --- |
| Quyền | Guest 401, USER 403 cho mọi Admin API; giả role/userId không vượt quyền; CSRF bắt buộc cả multipart |
| Input | Rỗng, Unicode/emoji giới hạn, quantity âm/0/thập phân/overflow, giá trên Long.MAX_VALUE, JSON trường lạ, ID sai |
| CRUD | Tạo/lấy lại/sửa đúng, tên trùng cho phép, null/empty chuẩn hóa, query literal %, pagination ổn định, không N+1 |
| Bảo vệ lịch sử | Bất kỳ UPCOMING/RUNNING/SOLD/UNSOLD => sửa metadata/ảnh bị chặn, DB và file không đổi |
| Đồng thời | ETag cũ 412; thiếu header 428; hai edit cùng lúc; update vs attach auction dùng barrier trên MySQL thật |
| Ảnh | JPEG/PNG hợp lệ, MIME giả/ảnh hỏng/SVG/traversal/file lớn/pixel lớn, storage unwritable, rollback DB/file, ảnh tồn tại sau restart |
| Rò rỉ | Admin DTO không dùng trong USER/realtime/replay; estimatedPrice không xuất hiện trên các response USER |
| Electron | ADMIN list/create/edit/upload/reload, search race, loading/empty/404/offline, 409/412, double click, focus, 820px, auth hết hạn |
| Regression | Đăng ký/login/logout, ví, socket, replay, build/typecheck, npm audit |

Hoàn thành khi Admin tạo sản phẩm kèm ảnh và sửa được trước khi sử dụng; dữ liệu/ảnh tồn tại sau restart; không sửa được sản phẩm đã gắn phiên; USER không truy cập metadata Admin; test concurrency thật pass; docs tạo phiên nêu rõ yêu cầu khóa product. Không tính UI mock hoặc test chỉ với H2 là bằng chứng hoàn thành.

## 11. Nguồn tham chiếu

Nguồn chính là code/schema/spec trong repository được khảo sát ngày 2026-10-01: SYSTEM_SPEC.md, docs/TEAM_CONVENTIONS.md, database/init.sql, Product.java, ProductRepository.java, AdminPage.tsx, frontend/vite.config.ts.

- Spring Data JPA: @Lock trên query/repository methods: https://docs.spring.io/spring-data/jpa/reference/4.0/jpa/locking.html . Chỉ tham khảo cơ chế, không nâng dự án khỏi Boot 3.3.5; khi implement xác minh API trên dependency hiện dùng.
- OWASP File Upload Cheat Sheet: allowlist định dạng, giới hạn kích thước, tên do server sinh, validate nội dung và lưu trữ tách biệt: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html . Các ngưỡng 5 MiB/16MP là đề xuất của plan, không phải yêu cầu OWASP.
