import {_electron as electron,expect,test} from '@playwright/test';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
test('real admin reads SYSTEM balance and ledger, filters and reloads',async({request},info)=>{
 if(process.env.REGISTRATION_TEST_DATABASE!=='true'||process.env.DB_PORT!=='33308')throw Error('Isolated database required');
 const username='system_admin_'+Date.now();expect((await request.post('http://localhost:18080/api/auth/register',{data:{username,password:'test-password-123'}})).status()).toBe(201);
 const sql=(q:string)=>execFileSync('docker',['exec','-e',`MYSQL_PWD=${process.env.DB_PASSWORD}`,'onlinebidflow-registration-test','mysql','-uroot','auction_db','-N','-B','-e',q],{encoding:'utf8'}).trim();
 sql(`UPDATE users SET role='ADMIN' WHERE username='${username}'`);
 const expected=sql("SELECT available_balance FROM wallets WHERE wallet_type='SYSTEM'");
 const env=Object.fromEntries(Object.entries(process.env).filter((e):e is [string,string]=>e[1]!==undefined));delete env.ELECTRON_RUN_AS_NODE;delete env.ELECTRON_DEV_URL;
 const app=await electron.launch({args:[path.resolve('.'),`--user-data-dir=${info.outputPath('profile')}`],env});
 try{
  const page=await app.firstWindow();await page.goto('app://auction/#/login');await page.getByLabel('Tên đăng nhập').fill(username);await page.getByLabel('Mật khẩu',{exact:true}).fill('test-password-123');await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();await page.getByRole('link',{name:'Ví hệ thống',exact:true}).click();
  await expect(page.getByLabel('Số liệu ví hệ thống')).toContainText(new Intl.NumberFormat('vi-VN').format(BigInt(expected)));
  await expect(page.getByRole('cell',{name:'Thanh toán',exact:true}).first()).toBeVisible();await page.reload();await expect(page.getByRole('heading',{name:'Ví hệ thống',exact:true})).toBeVisible();
  await page.getByLabel('Mã phiên',{exact:true}).fill('9223372036854775807');await page.getByRole('button',{name:'Áp dụng',exact:true}).click();await expect(page.getByText('Chưa có giao dịch phù hợp.',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Xóa bộ lọc',exact:true}).click();await expect(page.getByRole('cell',{name:'Thanh toán',exact:true}).first()).toBeVisible();await page.screenshot({path:info.outputPath('system-wallet.png'),fullPage:true});
 }finally{await app.close();sql(`DELETE FROM wallets WHERE user_id=(SELECT id FROM users WHERE username='${username}'); DELETE FROM users WHERE username='${username}';`);}
});
