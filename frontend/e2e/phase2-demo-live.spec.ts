import {_electron as electron,expect,test} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import path from 'node:path';
test('repeatable clean demo fixture and packaged admin queries',async({},info)=>{
 if(!process.env.DEMO_PASSWORD)throw Error('DEMO_PASSWORD is required');
 const output=execFileSync(process.execPath,['scripts/create-phase2-demo.mjs'],{encoding:'utf8',env:process.env});
 const file=output.match(/Demo ready: (.+)/)?.[1]?.trim();expect(file).toBeTruthy();
 const fixture=JSON.parse(readFileSync(file!,'utf8'));expect(fixture.state).toBe('ready');expect(fixture.accounts).toHaveLength(3);expect(fixture.auctions).toHaveLength(2);
 const sql=(q:string)=>execFileSync('docker',['exec','-e',`MYSQL_PWD=${process.env.DB_PASSWORD}`,'onlinebidflow-registration-test','mysql','-uroot','auction_db','-N','-B','-e',q],{encoding:'utf8'}).trim();
 expect(sql(`SELECT COUNT(*) FROM users u JOIN wallets w ON w.user_id=u.id WHERE u.username LIKE '${fixture.prefix}%' AND w.available_balance=10000 AND w.locked_balance=0`)).toBe('2');
 expect(sql(`SELECT COUNT(*) FROM coin_transactions t JOIN wallets w ON w.id=t.wallet_id JOIN users u ON u.id=w.user_id WHERE u.username LIKE '${fixture.prefix}%' AND t.transaction_type='DEPOSIT' AND t.available_delta=10000`)).toBe('2');
 const env=Object.fromEntries(Object.entries(process.env).filter((e):e is [string,string]=>e[1]!==undefined));delete env.ELECTRON_RUN_AS_NODE;delete env.ELECTRON_DEV_URL;
 const executablePath=process.env.E2E_EXECUTABLE;const app=await electron.launch({...(executablePath?{executablePath}:{}),args:[...(executablePath?[]:[path.resolve('.')]),`--user-data-dir=${info.outputPath('profile')}`],env});
 try{
  const page=await app.firstWindow();await page.goto('app://auction/#/login');await page.getByLabel('Tên đăng nhập').fill(fixture.accounts[0].username);await page.getByLabel('Mật khẩu',{exact:true}).fill(process.env.DEMO_PASSWORD);await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();
  await page.getByRole('link',{name:'Người dùng',exact:true}).click();await page.getByLabel('Tìm người dùng').fill(fixture.accounts[1].username);await page.getByRole('link',{name:'Xem '+fixture.accounts[1].username}).click();await expect(page.getByLabel('Số dư người dùng')).toContainText('10.000');
  await page.getByRole('link',{name:'Phiên đấu giá',exact:true}).click();await page.getByLabel('Tìm phiên').fill(fixture.prefix);await expect(page.getByRole('link',{name:new RegExp(fixture.prefix)})).toHaveCount(2);
  await page.getByRole('link',{name:'Ví hệ thống',exact:true}).click();await expect(page.getByLabel('Số liệu ví hệ thống')).toBeVisible();
  console.log('Clean demo manifest: '+file);
 }finally{await app.close();}
});
