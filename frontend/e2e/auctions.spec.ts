import { _electron as electron,expect,test,type ElectronApplication,type Page } from '@playwright/test';
import path from 'node:path';
let app:ElectronApplication,page:Page;
const product={id:'25',name:'Máy ảnh kiểm thử',description:null,quantity:1,estimatedPrice:'5000',imageUrl:null,editable:false,version:'"p1"'};
const baseline={id:'33',productId:'25',product,auctionType:'NORMAL',accessType:'PUBLIC',status:'UPCOMING',startingPrice:'100',minBidIncrement:'10',maxParticipants:null,roomCode:null,startTime:'2030-01-02T03:00:00Z',endTime:'2030-01-02T04:00:00Z',participantCount:'0',editable:true,editBlockedReason:null,version:'"a1"',serverNow:'2026-10-01T00:00:00Z'};
let current=baseline;
test.beforeEach(async({},info)=>{
 current={...baseline};const env=Object.fromEntries(Object.entries(process.env).filter((e):e is [string,string]=>e[1]!==undefined));delete env.ELECTRON_RUN_AS_NODE;delete env.ELECTRON_DEV_URL;
 app=await electron.launch({args:[path.resolve('.'),`--user-data-dir=${info.outputPath('profile')}`],env});page=await app.firstWindow();
 await page.route('**/api/auth/me',r=>r.fulfill({json:{id:1,username:'admin',role:'ADMIN'}}));await page.route('**/api/auth/csrf',r=>r.fulfill({json:{token:'auction-csrf'}}));
 await page.route('**/api/admin/products?*',r=>r.fulfill({json:{items:[product],page:0,totalPages:1,totalElements:'1'}}));
 await page.route('**/api/admin/auctions?*',r=>r.fulfill({json:{items:[current],page:0,totalPages:1,totalElements:'1',serverNow:baseline.serverNow}}));
 await page.route('**/api/admin/auctions/33',r=>r.fulfill({json:current}));
});
test.afterEach(async()=>{await app?.close();});
test('creates all four type/access combinations with confirmation and hidden private code',async()=>{
 for(const type of ['NORMAL','BLIND'])for(const access of ['PUBLIC','PRIVATE']){
  await page.goto('app://auction/#/admin/auctions/new');
  await page.getByRole('button',{name:/Máy ảnh kiểm thử/}).click();
  await page.getByRole('combobox',{name:'Loại đấu giá',exact:true}).selectOption(type);await page.getByRole('combobox',{name:'Quyền vào phòng',exact:true}).selectOption(access);
  await page.getByLabel('Giá khởi điểm (Coin)').fill('100');
  if(type==='NORMAL')await page.getByLabel('Bước giá tối thiểu (Coin)').fill('10');else await expect(page.getByLabel('Bước giá tối thiểu (Coin)')).toHaveCount(0);
  if(access==='PRIVATE')await page.getByLabel('Số người tối đa (để trống nếu không giới hạn)').fill('2');
  await page.getByLabel('Thời gian bắt đầu',{exact:true}).fill('2030-01-02T10:00');await page.getByLabel('Thời gian kết thúc',{exact:true}).fill('2030-01-02T11:00');
  await page.route('**/api/admin/auctions',r=>{
   const body=r.request().postDataJSON();expect(body.productVersion).toBe('"p1"');expect(body.minBidIncrement).toBe(type==='NORMAL'?'10':null);expect(body.maxParticipants).toBe(access==='PRIVATE'?2:null);expect(body.startTime).toMatch(/Z$/);expect(body).not.toHaveProperty('roomCode');
   current={...baseline,...body,roomCode:access==='PRIVATE'?'ABCDEF234567':null};return r.fulfill({status:201,json:current});
  });
  await page.getByRole('button',{name:'Xem lại cấu hình'}).click();await expect(page.getByRole('status')).toContainText('Xác nhận cấu hình');
  await page.getByRole('button',{name:'Xác nhận tạo phiên'}).click();await expect(page.getByRole('heading',{name:'Phiên #33',exact:true})).toBeVisible();
  if(access==='PRIVATE'){await expect(page.getByText('ABCDEF234567',{exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Hiện mã',exact:true}).click();await expect(page.getByText('ABCDEF234567',{exact:true})).toBeVisible();}
  await page.unroute('**/api/admin/auctions');
 }
});
test('handles edit conflict and protects dirty configuration',async()=>{
 await page.goto('app://auction/#/admin/auctions/33/edit');await page.getByLabel('Giá khởi điểm (Coin)').fill('200');
 await page.getByRole('link',{name:'Hủy',exact:true}).click();await expect(page.getByText('Bạn có cấu hình chưa lưu.')).toBeVisible();await page.getByRole('button',{name:'Tiếp tục chỉnh sửa'}).click();
 await page.route('**/api/admin/auctions/33',r=>{expect(r.request().headers()['if-match']).toBe('"a1"');return r.fulfill({status:409,json:{code:'AUCTION_HAS_ACTIVITY'}});});
 await page.getByRole('button',{name:'Xem lại cấu hình'}).click();await page.getByRole('button',{name:'Lưu thay đổi'}).click();await expect(page.getByRole('alert')).toContainText('không thể sửa');
 await expect(page.getByRole('button',{name:'Xem lại cấu hình'})).toBeDisabled();
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(820,650));expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
