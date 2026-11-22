import { _electron as electron, test, expect, type ElectronApplication, type Page } from '@playwright/test';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
// Explicit opt-in. This suite uses only the isolated mystery test container and API.
test.skip(process.env.LIVESTREAM_MYSTERY_E2E !== 'true', 'Requires isolated backend, MySQL and build with matching API origin');
test.setTimeout(120000);
const base = process.env.LIVESTREAM_API_URL ?? 'http://localhost:18082';
let host: ElectronApplication, viewer: ElectronApplication, other: ElectronApplication;
async function launch(info: any, name: string) {
  const env = Object.fromEntries(Object.entries(process.env).filter((v): v is [string,string] => v[1] !== undefined));
  delete env.ELECTRON_RUN_AS_NODE; delete env.ELECTRON_DEV_URL;
  const app = await electron.launch({ args: [path.resolve('.'), `--user-data-dir=${info.outputPath(name)}`], env });
  return { app, page: await app.firstWindow() };
}
async function login(page: Page, username: string) {
  await page.goto('app://auction/#/login');
  await page.getByLabel('Tên đăng nhập', { exact: true }).fill(username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill('Password@123');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Đăng xuất', exact: true })).toBeVisible();
}
async function api(page: Page, url: string, body?: object) {
  return page.evaluate(async ({ base, url, body }) => {
    const csrf = await fetch(base+'/api/auth/csrf', { credentials:'include' }).then(r=>r.json());
    const r = await fetch(base+url, { method:body?'POST':'GET', credentials:'include', headers:{ 'Content-Type':'application/json', 'X-CSRF-TOKEN':csrf.token }, body:body?JSON.stringify(body):undefined });
    const data=await r.json(); return { status:r.status, data };
  }, { base, url, body });
}
async function camera(page: Page) {
  await page.evaluate(() => { Object.defineProperty(navigator.mediaDevices,'getUserMedia',{ configurable:true, value:async()=> {
    const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;
    const ctx=canvas.getContext('2d')!;const timer=setInterval(()=>{ctx.fillStyle='#286049';ctx.fillRect(0,0,640,360);},100);
    const stream=canvas.captureStream(10);stream.getVideoTracks()[0].addEventListener('ended',()=>clearInterval(timer));return stream;
  }}); });
}
test.afterEach(async()=>{ await Promise.allSettled([host?.close(),viewer?.close(),other?.close()]); });
test('real Admin creation, two private viewers, paid ticket, reveal and ticket-only final settlement', async ({ request }, info) => {
  const prefix='mysterye2e_'+Date.now();
  const database=process.env.LIVESTREAM_TEST_DATABASE ?? 'auction_mystery_e2e';
  if(!/^auction_mystery_e2e(?:_[a-zA-Z0-9_]+)?$/.test(database))throw new Error('Dedicated mystery E2E database required');
  execFileSync('docker',['exec','-e','MYSQL_PWD=mystery_local_test','onlinebidflow-mystery-test','mysql','-uroot',database,'-e',
    `INSERT INTO users(username,password_hash,role) SELECT '${prefix}a',password_hash,'USER' FROM users WHERE username='admin'; INSERT INTO users(username,password_hash,role) SELECT '${prefix}b',password_hash,'USER' FROM users WHERE username='admin'; INSERT INTO wallets(user_id,wallet_type,available_balance,locked_balance,updated_at) SELECT id,'USER',0,0,UTC_TIMESTAMP(6) FROM users WHERE username IN ('${prefix}a','${prefix}b');`]);
  const h=await launch(info,'host');host=h.app;const v=await launch(info,'viewer');viewer=v.app;const o=await launch(info,'other');other=o.app;
  await login(h.page,'admin');await login(v.page,prefix+'a');await login(o.page,prefix+'b');
  expect((await api(v.page,'/api/wallet/deposits',{ amount:'2000' })).status).toBe(201);
  expect((await api(o.page,'/api/wallet/deposits',{ amount:'2000' })).status).toBe(201);
  const products=[];
  for(let i=0;i<3;i++)products.push(await h.page.evaluate(async({base,name})=>{
    const csrf=await fetch(base+'/api/auth/csrf',{credentials:'include'}).then(r=>r.json());
    const form=new FormData();form.append('data',new Blob([JSON.stringify({name,description:'Real mystery integration item',quantity:1,estimatedPrice:'100'})],{type:'application/json'}));
    const r=await fetch(base+'/api/admin/products',{method:'POST',credentials:'include',headers:{'X-CSRF-TOKEN':csrf.token},body:form});
    if(!r.ok)throw new Error(await r.text());return r.json();
  },{base,name:prefix+'_'+i}));
  const lots=products.map(p=>({productId:p.id,productVersion:p.version,startingPrice:'100'}));
  const created=await api(h.page,'/api/admin/livestreams',{requestId:crypto.randomUUID(),title:prefix,description:'Real mystery game',startsAt:Date.now()+60000,lots:lots.slice(0,2),mystery:{secretLot:lots[2],missions:[{title:'Buy both regular items',groupA:[products[0].id],groupB:[products[1].id]}]}});
  expect(created.status).toBe(200);const id=created.data.id;
  const publicBefore=await request.get(base+'/api/livestreams/'+id);const secretBefore=(await publicBefore.json()).lots[2];
  expect(secretBefore.hidden).toBe(true);expect(secretBefore.productId).toBeUndefined();expect(secretBefore.startingPrice).toBeUndefined();
  await h.page.goto('app://auction/#/admin/livestream/'+id);await camera(h.page);
  await h.page.getByRole('button',{name:'Bật camera',exact:true}).click();
  await v.page.goto('app://auction/#/livestream/'+id+'/room');await o.page.goto('app://auction/#/livestream/'+id+'/room');
  await expect(v.page.getByText('Buy both regular items',{exact:true})).toBeVisible();
  await expect(o.page.getByText('Buy both regular items',{exact:true})).toBeVisible();
  await expect.poll(async()=> (await api(h.page,'/api/livestreams/'+id+'/snapshot')).data.session.publisherReady).toBe(true);
  await h.page.getByRole('button',{name:'Bắt đầu live',exact:true}).click();
  for(let i=0;i<2;i++) {
    if(i) { await h.page.getByLabel('Chọn sản phẩm đưa lên lần này').selectOption({label:products[i].name});await h.page.getByRole('button',{name:'Đưa lên',exact:true}).click(); }
    await h.page.getByRole('button',{name:'Mở đấu giá sản phẩm',exact:true}).click();
    await v.page.getByLabel('Giá của bạn (Coin)').fill('100');await v.page.getByRole('button',{name:'Đặt 100 Coin',exact:true}).click();
    await expect.poll(async()=> (await api(v.page,'/api/livestreams/'+id+'/snapshot')).data.session.lots[i].status,{timeout:15000}).toBe('SOLD');
  }
  await expect(v.page.getByText('Bạn đã nhận một vé vào vòng cuối',{exact:true})).toBeVisible();
  const revealed=(await api(v.page,'/api/livestreams/'+id+'/snapshot')).data;
  expect(revealed.session.finalState).toBe('REVEALED');expect(revealed.session.lots[2].name).toBe(products[2].name);expect(revealed.mission.ticket).toBe(true);
  expect((await api(o.page,'/api/livestreams/'+id+'/snapshot')).data.mission.ticket).toBe(false);
  await h.page.getByRole('button',{name:'Đưa món bí mật lên',exact:true}).click();
  await h.page.getByRole('button',{name:'Mở đấu giá sản phẩm',exact:true}).click();
  const denied=await api(o.page,'/api/livestreams/'+id+'/lots/'+revealed.session.lots[2].id+'/bids',{requestId:crypto.randomUUID(),amount:'100'});
  expect(denied.status).toBe(403);expect(denied.data.code).toBe('TICKET_REQUIRED');
  await expect(o.page.getByText('Bạn không có vé của phiên này. Bạn vẫn được xem và chat.',{exact:true})).toBeVisible();
  expect((await api(o.page,'/api/livestreams/'+id+'/chat',{requestId:crypto.randomUUID(),text:'Good luck in the final!'})).status).toBe(200);
  await v.page.getByLabel('Giá của bạn (Coin)').fill('100');await v.page.getByRole('button',{name:'Đặt 100 Coin',exact:true}).click();
  await expect.poll(async()=> (await api(v.page,'/api/livestreams/'+id+'/snapshot')).data.session.finalState,{timeout:15000}).toBe('SOLD');
  const final=(await api(v.page,'/api/livestreams/'+id+'/snapshot')).data;
  expect(final.orders.filter((order:any)=>order.sessionId===id)).toHaveLength(3);expect(final.wallet.availableBalance).toBe('1700');expect(final.wallet.lockedBalance).toBe('0');
  await v.page.screenshot({path:info.outputPath('real-mystery-final.png'),fullPage:true});
  expect((await api(h.page,'/api/admin/livestreams/'+id+'/end',{requestId:crypto.randomUUID(),lotId:revealed.session.lots[2].id})).status).toBe(200);
});
