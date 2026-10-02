import {_electron as electron,expect,test,type ElectronApplication,type Page} from '@playwright/test';
import path from 'node:path';
let app:ElectronApplication,page:Page;
test.beforeEach(async({},info)=>{
 const env=Object.fromEntries(Object.entries(process.env).filter((e):e is [string,string]=>e[1]!==undefined));delete env.ELECTRON_RUN_AS_NODE;delete env.ELECTRON_DEV_URL;
 app=await electron.launch({args:[path.resolve('.'),`--user-data-dir=${info.outputPath('profile')}`],env});page=await app.firstWindow();
 await page.route('**/api/auth/me',r=>r.fulfill({json:{id:1,username:'admin',role:'ADMIN'}}));
 await page.route('**/api/admin/system-wallet',r=>r.fulfill({json:{walletId:'15',availableBalance:'100',lockedBalance:'0',totalReceivedCoin:'18446744073709551614',updatedAt:'2030-01-01T00:00:00Z',readAt:'2030-01-01T00:00:00Z'}}));
 await page.route('**/api/admin/system-wallet/transactions?*',r=>r.fulfill({json:{items:[{id:'5',auctionId:'12',type:'PAYMENT',availableDelta:'100',lockedDelta:'0',createdAt:'2030-01-01T00:00:00Z'}],nextCursor:null}}));
});
test.afterEach(async()=>{await app?.close();});
test('summary precision filters refresh and pagination',async()=>{
 await page.goto('app://auction/#/admin/system-wallet');await expect(page.getByLabel('Số liệu ví hệ thống')).toContainText('18.446.744.073.709.551.614');
 await page.getByLabel('Mã phiên',{exact:true}).fill('12');await page.getByLabel('Từ ngày',{exact:true}).fill('2030-01-01');await page.getByLabel('Đến ngày',{exact:true}).fill('2030-01-02');
 const request=page.waitForRequest(r=>r.url().includes('/transactions?')&&r.url().includes('auctionId=12'));await page.getByRole('button',{name:'Áp dụng',exact:true}).click();const url=new URL((await request).url());expect(url.searchParams.get('from')).toMatch(/Z$/);expect(url.searchParams.get('to')).toMatch(/Z$/);
 await page.route('**/api/admin/system-wallet/transactions?*',r=>{const next=new URL(r.request().url()).searchParams.has('cursor');return r.fulfill({json:{items:[{id:next?'4':'5',auctionId:null,type:'PAYMENT',availableDelta:'50',lockedDelta:'0',createdAt:'2030-01-01T00:00:00Z'}],nextCursor:next?null:'next'}});});
 await page.getByRole('button',{name:'Làm mới',exact:true}).click();await page.getByRole('button',{name:'Tải thêm',exact:true}).click();await expect(page.getByRole('cell',{name:'Thanh toán',exact:true})).toHaveCount(2);
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(820,650));expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('invalid configuration and forbidden response never render a zero wallet',async()=>{
 await page.route('**/api/admin/system-wallet',r=>r.fulfill({status:409,json:{code:'SYSTEM_WALLET_INVALID'}}));await page.goto('app://auction/#/admin/system-wallet');await expect(page.getByRole('alert')).toContainText('thiếu hoặc trùng');await expect(page.getByLabel('Số liệu ví hệ thống')).toHaveCount(0);
 await page.route('**/api/admin/system-wallet',r=>r.fulfill({status:403,json:{code:'FORBIDDEN'}}));await page.getByRole('button',{name:'Làm mới',exact:true}).click();await expect(page.getByRole('alert')).toContainText('không có quyền');await expect(page.getByRole('table')).toHaveCount(0);
});
