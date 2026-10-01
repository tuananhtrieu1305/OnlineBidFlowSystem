import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import path from 'node:path';
let app:ElectronApplication,page:Page;
const product={id:'25',name:'Máy ảnh Canon AE-1',description:'Máy ảnh phim đã kiểm tra.',quantity:1,estimatedPrice:'2500',imageUrl:null,editable:true,editBlockedReason:null,version:'"v1"'};
test.beforeEach(async({},info)=>{
 const env=Object.fromEntries(Object.entries(process.env).filter((e):e is [string,string]=>e[1]!==undefined));delete env.ELECTRON_RUN_AS_NODE;delete env.ELECTRON_DEV_URL;
 app=await electron.launch({args:[path.resolve('.'),`--user-data-dir=${info.outputPath('profile')}`],env});page=await app.firstWindow();
 await page.route('**/api/auth/me',r=>r.fulfill({json:{id:1,username:'admin',role:'ADMIN'}}));
 await page.route('**/api/auth/csrf',r=>r.fulfill({json:{token:'csrf-product'}}));
 await page.route('**/api/admin/products?*',r=>r.fulfill({json:{items:[product],page:0,size:20,totalElements:'1',totalPages:1}}));
 await page.route('**/api/admin/products/25',r=>r.fulfill({json:product}));
 await page.goto('app://auction/#/admin/products');
});
test.afterEach(async()=>{await app?.close();});
test('admin creates product using multipart and warns before leaving dirty form',async()=>{
 await expect(page.getByRole('link',{name:/Máy ảnh Canon/})).toBeVisible();
 await page.getByRole('link',{name:'＋ Thêm sản phẩm'}).click();
 await page.getByRole('button',{name:'Lưu sản phẩm'}).click();
 await expect(page.getByLabel('Tên sản phẩm')).toBeFocused();
 await page.getByLabel('Tên sản phẩm').fill(product.name);
 await page.getByLabel('Mô tả',{exact:true}).fill(product.description);
 await page.getByLabel('Giá ước tính (Coin) — chỉ Admin thấy').fill('2500');
 await page.route('**/api/admin/products',async r=>{
  expect(r.request().headers()['content-type']).toContain('multipart/form-data; boundary=');
  expect(r.request().headers()['x-csrf-token']).toBe('csrf-product');
  expect(r.request().postData()).toContain('"quantity":1');
  await r.fulfill({status:201,json:product});
 });
 await page.getByRole('button',{name:'Lưu sản phẩm'}).click();
 await expect(page.getByRole('heading',{name:product.name,exact:true})).toBeVisible();
 await page.getByRole('link',{name:'Chỉnh sửa',exact:true}).click();
 await page.getByLabel('Tên sản phẩm').fill('Chỉnh sửa chưa lưu');
 await page.getByRole('link',{name:'Hủy',exact:true}).click();
 await expect(page.getByText('Bạn có thay đổi chưa lưu. Rời trang?')).toBeVisible();
 await page.getByRole('button',{name:'Tiếp tục chỉnh sửa'}).click();
 await expect(page.getByLabel('Tên sản phẩm')).toHaveValue('Chỉnh sửa chưa lưu');
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(820,650));
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('stale update cannot overwrite and used product is read only',async()=>{
 await page.goto('app://auction/#/admin/products/25/edit');
 await page.getByLabel('Tên sản phẩm').fill('Tên mới');
 await page.route('**/api/admin/products/25',r=>{expect(r.request().headers()['if-match']).toBe('"v1"');return r.fulfill({status:412,json:{code:'PRODUCT_CHANGED'}});});
 await page.getByRole('button',{name:'Lưu sản phẩm'}).click();
 await expect(page.getByRole('alert')).toContainText('người khác cập nhật');
 await expect(page.getByRole('button',{name:'Lưu sản phẩm'})).toBeDisabled();
 await page.route('**/api/admin/products/25',r=>r.fulfill({json:{...product,editable:false,editBlockedReason:'PRODUCT_IN_USE'}}));
 await page.reload();
 await expect(page.getByText('Sản phẩm đã được dùng trong phiên đấu giá nên không thể chỉnh sửa.')).toBeVisible();
 await expect(page.getByRole('link',{name:'Chỉnh sửa',exact:true})).toHaveCount(0);
});
test('user cannot render admin product data',async()=>{
 await page.route('**/api/auth/me',r=>r.fulfill({json:{id:2,username:'user',role:'USER'}}));await page.reload();
 await expect(page.getByRole('link',{name:'Ví Coin'})).toBeVisible();
 await expect(page.getByRole('link',{name:'＋ Thêm sản phẩm'})).toHaveCount(0);
});
