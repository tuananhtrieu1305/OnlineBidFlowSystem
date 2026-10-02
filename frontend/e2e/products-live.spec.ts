import { _electron as electron, expect, test } from '@playwright/test';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
test('admin uploads and edits a product against real backend',async({request},info)=>{
 if(process.env.REGISTRATION_TEST_DATABASE!=='true'||process.env.DB_PORT!=='33308')throw new Error('Isolated test database on port 33308 required');
 const username='product_admin_'+Date.now();
 const created=await request.post('http://localhost:18080/api/auth/register',{data:{username,password:'test-password-123'}});
 expect(created.status()).toBe(201);
 const sql=(statement:string)=>execFileSync('docker',['exec','-e',`MYSQL_PWD=${process.env.DB_PASSWORD}`,'onlinebidflow-registration-test','mysql','-uroot','auction_db','-e',statement]);
 sql(`UPDATE users SET role='ADMIN' WHERE username='${username}'`);
 const env=Object.fromEntries(Object.entries(process.env).filter((e):e is [string,string]=>e[1]!==undefined));delete env.ELECTRON_RUN_AS_NODE;delete env.ELECTRON_DEV_URL;
 const executablePath=process.env.E2E_EXECUTABLE;
 const app=await electron.launch({...(executablePath?{executablePath}:{}),args:[...(executablePath?[]:[path.resolve('.')]),`--user-data-dir=${info.outputPath('profile')}`],env});
 try{
  const page=await app.firstWindow();page.on('pageerror',error=>console.log('Renderer error:',error.message));await page.goto('app://auction/#/login');
  await page.getByLabel('Tên đăng nhập').fill(username);await page.getByLabel('Mật khẩu',{exact:true}).fill('test-password-123');
  const login=page.waitForResponse(r=>r.url().endsWith('/api/auth/login'));
  await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();
  const response=await login;expect(response.status(),await response.text()).toBe(200);
  await expect(page.getByRole('heading',{name:`Chào mừng, ${username}.`,exact:true})).toBeVisible();
  await page.getByRole('link',{name:'Sản phẩm',exact:true}).click();await page.getByRole('link',{name:'＋ Thêm sản phẩm'}).click();
  const name='Máy ảnh kiểm thử '+Date.now();await page.getByLabel('Tên sản phẩm').fill(name);
  await page.getByLabel('Mô tả',{exact:true}).fill('Ảnh và thông tin được lưu trên server trung tâm.');
  await page.getByLabel('Giá ước tính (Coin) — chỉ Admin thấy').fill('3500');
  const png=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;const c=canvas.getContext('2d')!;c.fillStyle='#e6e5dc';c.fillRect(0,0,640,480);c.fillStyle='#145c53';c.fillRect(120,140,400,220);c.fillStyle='#202824';c.beginPath();c.arc(320,250,85,0,Math.PI*2);c.fill();return canvas.toDataURL('image/png').split(',')[1];});
  await page.getByLabel('Chọn ảnh JPEG/PNG').setInputFiles({name:'camera.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  await page.getByRole('button',{name:'Lưu sản phẩm'}).click();
  await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();
  await expect(page.getByRole('img',{name,exact:true})).toBeVisible();
  await expect.poll(()=>page.getByRole('img',{name,exact:true}).evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBe(640);
  await page.reload();await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();
  await page.getByRole('link',{name:'Chỉnh sửa',exact:true}).click();await page.getByLabel('Tên sản phẩm').fill(name+' cập nhật');
  await page.getByRole('button',{name:'Lưu sản phẩm'}).click();
  await expect(page.getByRole('heading',{name:name+' cập nhật',exact:true})).toBeVisible();
  await page.screenshot({path:info.outputPath('product.png'),fullPage:true});
 }finally{await app.close();sql(`DELETE FROM wallets WHERE user_id=(SELECT id FROM users WHERE username='${username}'); DELETE FROM users WHERE username='${username}';`);}
});
