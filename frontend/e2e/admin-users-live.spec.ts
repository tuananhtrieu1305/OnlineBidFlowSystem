import {_electron as electron,expect,test} from '@playwright/test';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
test('real admin reads a registered user wallet and history in Electron',async({request},info)=>{
 if(process.env.REGISTRATION_TEST_DATABASE!=='true'||process.env.DB_PORT!=='33308')throw new Error('Isolated database required');
 const suffix=Date.now(),admin='users_admin_'+suffix,user='users_target_'+suffix;
 const sql=(query:string)=>execFileSync('docker',['exec','-e',`MYSQL_PWD=${process.env.DB_PASSWORD}`,'onlinebidflow-registration-test','mysql','-uroot','auction_db','-e',query]);
 for(const username of [admin,user])expect((await request.post('http://localhost:18080/api/auth/register',{data:{username,password:'test-password-123'}})).status()).toBe(201);
 sql(`UPDATE users SET role='ADMIN' WHERE username='${admin}'`);
 const env=Object.fromEntries(Object.entries(process.env).filter((e):e is [string,string]=>e[1]!==undefined));delete env.ELECTRON_RUN_AS_NODE;delete env.ELECTRON_DEV_URL;
 const app=await electron.launch({args:[path.resolve('.'),`--user-data-dir=${info.outputPath('profile')}`],env});
 try{
  const page=await app.firstWindow();await page.goto('app://auction/#/login');
  async function login(username:string){await page.getByLabel('Tên đăng nhập').fill(username);await page.getByLabel('Mật khẩu',{exact:true}).fill('test-password-123');await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();await expect(page.getByRole('complementary').getByRole('heading',{name:username})).toBeVisible();}
  await login(user);await page.getByRole('link',{name:'Ví Coin'}).click();await page.getByRole('button',{name:'＋ Nạp Coin'}).click();await page.getByLabel('Số Coin muốn nạp').fill('1250');await page.getByRole('button',{name:'Xác nhận nạp'}).click();await expect(page.getByLabel('Số dư ví')).toContainText('1.250');await page.getByRole('button',{name:'Đăng xuất',exact:true}).click();await expect(page.getByRole('heading',{name:'Chào mừng bạn trở lại.'})).toBeVisible();
  await login(admin);await page.getByRole('link',{name:'Người dùng',exact:true}).click();await page.getByLabel('Tìm người dùng').fill(user);await page.getByRole('link',{name:'Xem '+user,exact:true}).click();await expect(page.getByLabel('Số dư người dùng')).toContainText('1.250');await expect(page.getByRole('cell',{name:'Nạp Coin',exact:true})).toBeVisible();await page.reload();await expect(page.getByLabel('Số dư người dùng')).toContainText('1.250');await page.screenshot({path:info.outputPath('admin-user.png'),fullPage:true});
 }finally{await app.close();sql(`DELETE t FROM coin_transactions t JOIN wallets w ON w.id=t.wallet_id JOIN users u ON u.id=w.user_id WHERE u.username IN ('${admin}','${user}'); DELETE w FROM wallets w JOIN users u ON u.id=w.user_id WHERE u.username IN ('${admin}','${user}'); DELETE FROM users WHERE username IN ('${admin}','${user}');`);}
});
