import {_electron as electron,expect,test,type ElectronApplication,type Page} from '@playwright/test';
import path from 'node:path';
let app:ElectronApplication,page:Page;
test.beforeEach(async({},info)=>{
 const env=Object.fromEntries(Object.entries(process.env).filter((e):e is [string,string]=>e[1]!==undefined));delete env.ELECTRON_RUN_AS_NODE;delete env.ELECTRON_DEV_URL;
 app=await electron.launch({args:[path.resolve('.'),`--user-data-dir=${info.outputPath('profile')}`],env});page=await app.firstWindow();
 await page.route('**/api/auth/me',r=>r.fulfill({json:{id:1,username:'admin',role:'ADMIN'}}));
 await page.route('**/api/admin/users?*',r=>r.fulfill({json:{items:[{id:'42',username:'alice',role:'USER'}],page:0,totalPages:1,totalElements:'1'}}));
 await page.route('**/api/admin/users/42',r=>r.fulfill({json:{id:'42',username:'alice',role:'USER',walletState:'AVAILABLE',wallet:{walletId:'8',availableBalance:'9007199254740993',lockedBalance:'100',updatedAt:'2026-10-01T00:00:00Z'}}}));
 await page.route('**/api/admin/users/42/transactions?*',r=>r.fulfill({json:{items:[{id:'4',auctionId:null,type:'DEPOSIT',availableDelta:'100',lockedDelta:'0',createdAt:'2026-10-01T00:00:00Z'}],nextCursor:null}}));
});
test.afterEach(async()=>{await app?.close();});
test('admin finds a user, sees exact Coin and returns to preserved filters',async()=>{
 await page.goto('app://auction/#/admin/users');await page.getByLabel('Tìm người dùng').fill('alice');await page.getByRole('combobox',{name:'Vai trò'}).selectOption('USER');
 await page.getByRole('link',{name:'Xem alice'}).click();await expect(page.getByRole('heading',{name:'alice',exact:true})).toBeVisible();await expect(page.getByLabel('Số dư người dùng')).toContainText('9.007.199.254.740.993');await expect(page.getByRole('cell',{name:'Nạp Coin',exact:true})).toBeVisible();
 await page.getByRole('combobox',{name:'Loại giao dịch'}).selectOption('LOCK');await page.getByRole('link',{name:'← Người dùng',exact:true}).click();await expect(page.getByLabel('Tìm người dùng')).toHaveValue('alice');await expect(page.getByRole('combobox',{name:'Vai trò'})).toHaveValue('USER');
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(820,650));expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('missing wallet is not zero and forbidden history hides all detail data',async()=>{
 await page.route('**/api/admin/users/43',r=>r.fulfill({json:{id:'43',username:'missing',role:'USER',walletState:'MISSING',wallet:null}}));
 await page.goto('app://auction/#/admin/users/43');await expect(page.getByText(/Tài khoản thiếu ví/)).toBeVisible();await expect(page.getByLabel('Số dư người dùng')).toHaveCount(0);
 await page.route('**/api/admin/users/42/transactions?*',r=>r.fulfill({status:403,json:{code:'FORBIDDEN'}}));await page.goto('app://auction/#/admin/users/42');await expect(page.getByRole('alert')).toContainText('không còn quyền');await expect(page.getByLabel('Số dư người dùng')).toHaveCount(0);await expect(page.getByRole('heading',{name:'alice',exact:true})).toHaveCount(0);
});
test('user cannot render admin information',async()=>{
 await page.route('**/api/auth/me',r=>r.fulfill({json:{id:2,username:'alice',role:'USER'}}));let calls=0;await page.route('**/api/admin/users?*',r=>{calls++;return r.abort();});await page.goto('app://auction/#/admin/users');await expect(page.getByRole('heading',{name:'Người dùng',exact:true})).toHaveCount(0);await expect(page.getByRole('link',{name:'Ví Coin'})).toBeVisible();expect(calls).toBe(0);
});
