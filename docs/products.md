# Admin quản lý sản phẩm

## Chạy và sử dụng

Từ thư mục gốc: `docker compose up -d --build backend`. Frontend: `cd frontend` rồi `npm run dev` (hoặc `npm run build` + `npm start`). Đăng nhập tài khoản ADMIN → **Sản phẩm**.

Có danh sách/tìm kiếm tên hoặc mã/phân trang, thêm sản phẩm kèm ảnh, xem chi tiết và sửa. Giá ước tính chỉ Admin thấy. Sản phẩm đã được gắn vào bất kỳ phiên nào đều chỉ đọc để giữ thông tin lịch sử nhất quán; không có xóa sản phẩm trong mốc này. Không tự trừ quantity như tồn kho.

## API

| Route | Nội dung |
| --- | --- |
| GET /api/admin/products?q=&page=0&size=20 | Danh sách, tối đa 100 dòng/trang, id giảm dần |
| GET /api/admin/products/{id} | Chi tiết, version và ETag |
| POST /api/admin/products | Multipart data + image tùy chọn, trả 201 |
| PUT /api/admin/products/{id} | Multipart data + image tùy chọn; If-Match bắt buộc |
| GET /api/product-images/{generatedName} | Ảnh chuẩn hóa, đọc công khai, không chứa metadata Admin |

JSON part `data` (Content-Type application/json): name, description (null được), quantity integer, estimatedPrice chuỗi số nguyên dương hoặc null. Update thêm imageAction KEEP/REMOVE/REPLACE. REPLACE phải có part image; KEEP/REMOVE không được kèm file. Không nhận đường dẫn/URL ảnh hoặc ID/role do client cấp trong data.

name tối đa 255 Unicode code points; description plain text tối đa 5.000; quantity 1..Integer.MAX_VALUE; estimatedPrice 1..Long.MAX_VALUE. Response id/estimatedPrice/totalElements dạng string. Không serialize Product entity trực tiếp ra API USER. Response admin có editable/editBlockedReason và version. ETag cũng được expose qua CORS; request If-Match được allowlist.

Mutation cần session ADMIN và X-CSRF-TOKEN, gồm cả multipart. 400 sai input; 401 hết phiên; 403 quyền/CSRF; 404 không có; 409 PRODUCT_IN_USE; 412 PRODUCT_CHANGED; 428 thiếu If-Match; 413 quá lớn; 415 ảnh không đọc được. Không tự retry create khi mất mạng vì chưa có idempotency key. Kiểm tra danh sách trước khi thử lại.

## Ảnh và vận hành

- JPEG/PNG tối đa 5 MiB, tối đa 16 triệu pixel, kiểm tra kích thước trước decode. Request multipart tối đa 6 MiB.
- Server decode và encode lại, bỏ filename client, sinh UUID. Không fetch URL tùy ý, không nhận SVG/HTML. Có placeholder khi ảnh seed bên ngoài origin không được phép tải.
- PRODUCT_IMAGE_DIR là thư mục lưu ngoài source; default local `.runtime/product-images` tính theo working directory của backend. Docker dùng `/data/product-images` và named volume `product_images`.
- CSP chỉ thêm origin backend và blob preview, không tắt webSecurity. Ảnh đọc công khai theo tên ngẫu nhiên; nếu cần bảo mật ảnh PRIVATE phải thiết kế authorization riêng, không coi tên UUID là cơ chế cấp quyền.
- File mới immutable; move vào storage trước commit, rollback thông thường xóa file mới. File cũ giữ lại khi đổi/bỏ ảnh để tránh race và phục vụ đối soát. Crash có thể để orphan; chưa có tác vụ tự xóa orphan. Backup gồm DB và image volume.
- Không chạy `docker compose down -v` khi cần giữ dữ liệu/ảnh.

## Hợp đồng cho module tạo phiên

ProductService.update dùng READ_COMMITTED và khóa PESSIMISTIC_WRITE product, kiểm tra tồn tại auction rồi kiểm tra ETag. ETag là hash nội dung persisted, không phải version lịch sử/audit; thay đổi rồi trả lại đúng dữ liệu cũ có cùng ETag.

Module tạo phiên phải khóa **cùng bản ghi product** trước khi gắn auction và giữ khóa đến commit:

```java
@Transactional(isolation = Isolation.READ_COMMITTED)
public void createAuction(CreateAuctionRequest request) {
    Product product = products.findForUpdate(request.productId()).orElseThrow(...);
    // validate cấu hình phiên, quyền Admin và dữ liệu hiện tại
    // save auction tham chiếu product trong transaction này
}
```

Không dùng kiểm tra frontend để thay thế khóa server. Các đường sửa phiên đổi product phải phối hợp thứ tự khóa với nhóm; không đảo thứ tự product/auction hoặc đưa thêm khóa product vào bid runtime mà không kiểm tra deadlock. Bộ ProductIT có test hai Admin sửa đồng thời và mô phỏng transaction gắn phiên để xác minh hợp đồng này. Chưa triển khai create-auction trong module sản phẩm.

## Kiểm thử

- `mvn test`: unit/security/realtime regression và ProductInputTest/ProductImageStorageTest.
- MySQL riêng: dùng profile `registration-it`; ProductIT kiểm tra API/quyền/CSRF/ảnh/ETag/rollback/concurrency. REGISTRATION_TEST_DATABASE=true là bắt buộc. Không chạy trên DB demo.
- Profile `product-coverage` đo package product và kiểm tra tối thiểu 80% line coverage. Dùng với `registration-it`, chạy `mvn clean verify -Pregistration-it,product-coverage` trên DB riêng để có báo cáo mới. Báo cáo ở backend/target/site/jacoco.
- Frontend: `npm run test:coverage`, `npm run test:e2e`. products.spec.ts kiểm tra multipart, validate, dirty form, stale edit, read-only và quyền USER.
- Live: build VITE_API_BASE_URL=http://localhost:18080, đặt env DB riêng cổng33308, JAVA_HOME Java21, PRODUCT_IMAGE_DIR thư mục test rồi chạy `npx playwright test --config playwright.products-live.config.ts`. Test đăng ký tài khoản riêng và promote chỉ trong container `onlinebidflow-registration-test`, xóa tài khoản khi kết thúc. Sản phẩm/ảnh live fixture lưu trong DB/storage kiểm thử; không dùng dữ liệu live để demo.
- Sau live test, bỏ VITE_API_BASE_URL thử nghiệm và build lại frontend về server bình thường.

Khác bố cục plan: gom pages list/detail/form và component ảnh vào ProductsPage.tsx để giữ phạm vi module nhỏ; ProductInput thực hiện strict JsonNode validation thay vì cho Jackson tự coerce DTO. Không đổi schema hoặc hợp đồng realtime.

## Kết quả xác minh (2026-10-01)

- 65 backend tests + 26 MySQL integration tests pass.
- Product coverage: 122/127 dòng (96,1%), ngưỡng 80% được kiểm tra bằng JaCoCo.
- 32 frontend unit tests và 17 Electron regression tests pass; coverage frontend 100% chỉ áp dụng các helper được cấu hình đo.
- Live Electron: đăng nhập Admin riêng, tạo/upload/sửa/reload sản phẩm qua backend/MySQL thật pass.
- Khởi động một tiến trình backend mới với cùng thư mục ảnh: ảnh đã upload trả HTTP 200 image/png.
- npm audit: 0 vulnerabilities.
