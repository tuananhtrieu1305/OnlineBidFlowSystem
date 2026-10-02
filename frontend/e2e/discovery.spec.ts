import {_electron as electron,expect,test} from '@playwright/test';
import path from 'node:path';
test('guest discovers real-shaped auctions, filters, opens blind detail and retries errors',async({},info)=>{
 const env=Object.fromEntries(Object.entries(process.env).filter((e):e is [string,string]=>e[1]!==undefined));delete env.ELECTRON_RUN_AS_NODE;delete env.ELECTRON_DEV_URL;
 const app=await electron.launch({args:[path.resolve('.'),`--user-data-dir=${info.outputPath('profile')}`],env});
 try{
  const page=await app.firstWindow();await page.route('**/api/auth/me',r=>r.fulfill({status:401,json:{}}));
  const auction={id:'222',auctionType:'BLIND',status:'UPCOMING',startTime:'2027-01-01T10:00:00Z',endTime:'2027-01-01T11:00:00Z',product:{id:'1',name:'Máy ảnh sưu tầm',description:'Máy ảnh còn nguyên hộp',quantity:1,imageUrl:null}};
  let fail=false;
  await page.route('**/api/discovery/auctions**',r=>fail?r.fulfill({status:500,json:{}}):r.fulfill({json:r.request().url().includes('/222')?auction:{items:[auction],page:0,totalPages:1,totalElements:'1'}}));
  await page.goto('app://auction/#/');
  await expect(page.getByRole('link',{name:'Xem phiên Máy ảnh sưu tầm'})).toBeVisible();
  await page.getByLabel('Loại đấu giá').selectOption('BLIND');
  await page.getByRole('link',{name:'Xem phiên Máy ảnh sưu tầm'}).click();
  await expect(page.getByRole('heading',{name:'Máy ảnh sưu tầm'})).toBeVisible();
  await expect(page.getByText('Giá trả được giữ kín.')).toBeVisible();
  await expect(page.getByText('Máy ảnh còn nguyên hộp')).toBeVisible();
  await expect(page.getByText('Giá khởi điểm',{exact:true})).toHaveCount(0);
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(820,650));
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  fail=true;await page.getByRole('link',{name:'Quay lại khám phá'}).click();
  await expect(page.getByRole('alert')).toContainText('Chưa tải được');fail=false;
  await page.getByRole('button',{name:'Thử lại'}).click();await expect(page.getByRole('link',{name:'Xem phiên Máy ảnh sưu tầm'})).toBeVisible();
 }finally{await app.close();}
});
