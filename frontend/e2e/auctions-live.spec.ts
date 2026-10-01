import { _electron as electron, expect, test } from '@playwright/test';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
test('real admin creates four combinations, edits and joins a blind room',async({request},info)=>{
 if(process.env.REGISTRATION_TEST_DATABASE!=='true'||process.env.DB_PORT!=='33308')throw new Error('Isolated database required');
 const username='auction_admin_'+Date.now(),name='Auction fixture '+Date.now();
 expect((await request.post('http://localhost:18080/api/auth/register',{data:{username,password:'test-password-123'}})).status()).toBe(201);
 const sql=(statement:string)=>execFileSync('docker',['exec','-e',`MYSQL_PWD=${process.env.DB_PASSWORD}`,'onlinebidflow-registration-test','mysql','-uroot','auction_db','-e',statement]);
 sql(`UPDATE users SET role='ADMIN' WHERE username='${username}'`);
 const env=Object.fromEntries(Object.entries(process.env).filter((e):e is [string,string]=>e[1]!==undefined));delete env.ELECTRON_RUN_AS_NODE;delete env.ELECTRON_DEV_URL;
 const app=await electron.launch({args:[path.resolve('.'),`--user-data-dir=${info.outputPath('profile')}`],env});
 try{
  const page=await app.firstWindow();await page.goto('app://auction/#/login');
  await page.getByLabel('Tên đăng nhập').fill(username);await page.getByLabel('Mật khẩu',{exact:true}).fill('test-password-123');await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();
  await expect(page.getByRole('heading',{name:`Chào mừng, ${username}.`,exact:true})).toBeVisible();
  await page.getByRole('link',{name:'Sản phẩm',exact:true}).click();await page.getByRole('link',{name:'＋ Thêm sản phẩm'}).click();await page.getByLabel('Tên sản phẩm').fill(name);await page.getByLabel('Giá ước tính (Coin) — chỉ Admin thấy').fill('5000');await page.getByRole('button',{name:'Lưu sản phẩm'}).click();await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();
  let id='',code='';
  for(const type of ['NORMAL','BLIND'])for(const access of ['PUBLIC','PRIVATE']){
   await page.goto('app://auction/#/admin/auctions/new');await page.getByLabel('Tìm sản phẩm').fill(name);await page.getByRole('button',{name:new RegExp(name)}).click();
   await page.getByRole('combobox',{name:'Loại đấu giá',exact:true}).selectOption(type);await page.getByRole('combobox',{name:'Quyền vào phòng',exact:true}).selectOption(access);
   await page.getByLabel('Giá khởi điểm (Coin)').fill('100');if(type==='NORMAL')await page.getByLabel('Bước giá tối thiểu (Coin)').fill('10');
   await page.getByLabel('Thời gian bắt đầu',{exact:true}).fill('2030-01-02T10:00');await page.getByLabel('Thời gian kết thúc',{exact:true}).fill('2030-01-02T11:00');
   await page.getByRole('button',{name:'Xem lại cấu hình'}).click();const saved=page.waitForResponse(r=>r.url().endsWith('/api/admin/auctions')&&r.request().method()==='POST');await page.getByRole('button',{name:'Xác nhận tạo phiên'}).click();const response=await saved;expect(response.status(),await response.text()).toBe(201);const a=await response.json();id=a.id;code=a.roomCode;expect(a.auctionType).toBe(type);expect(a.accessType).toBe(access);expect(a.startTime).toBe('2030-01-02T03:00:00Z');await expect(page.getByRole('heading',{name:'Phiên #'+id,exact:true})).toBeVisible();
  }
  await page.getByRole('link',{name:'Sửa cấu hình',exact:true}).click();await page.getByLabel('Giá khởi điểm (Coin)').fill('120');await page.getByRole('button',{name:'Xem lại cấu hình'}).click();await page.getByRole('button',{name:'Lưu thay đổi',exact:true}).click();await expect(page.getByRole('heading',{name:'Phiên #'+id,exact:true})).toBeVisible();await page.reload();await expect(page.getByText('120 Coin',{exact:true})).toBeVisible();
  const state=await page.evaluate(({id,code})=>new Promise<string>((resolve,reject)=>{const ws=new WebSocket('ws://localhost:18080/ws/auction');const timer=setTimeout(()=>{ws.close();reject(new Error('join timeout'));},5000);ws.onopen=()=>ws.send(JSON.stringify({type:'JOIN_ROOM',requestId:'live-join',payload:{auctionId:Number(id),roomCode:code}}));ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.type==='AUCTION_STATE'||m.type==='ERROR'){clearTimeout(timer);ws.close();resolve(e.data);}};ws.onerror=()=>{clearTimeout(timer);reject(new Error('socket error'));};}),{id,code});
  expect(JSON.parse(state).type).toBe('AUCTION_STATE');expect(state).not.toContain('startingPrice');expect(state).not.toContain('roomCode');
  await page.reload();await expect(page.getByRole('link',{name:'Sửa cấu hình',exact:true})).toHaveCount(0);await expect(page.getByText(/Phiên đã có hoạt động/)).toBeVisible();await page.screenshot({path:info.outputPath('auction.png'),fullPage:true});
 }finally{await app.close();sql(`DELETE ap FROM auction_participants ap JOIN auctions a ON a.id=ap.auction_id JOIN users u ON u.id=a.created_by WHERE u.username='${username}'; DELETE a FROM auctions a JOIN users u ON u.id=a.created_by WHERE u.username='${username}'; DELETE FROM products WHERE name='${name}'; DELETE FROM wallets WHERE user_id=(SELECT id FROM users WHERE username='${username}'); DELETE FROM users WHERE username='${username}';`);}
});
