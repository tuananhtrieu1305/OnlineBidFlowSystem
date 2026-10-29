import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test';
import path from 'node:path';

let app:ElectronApplication;
test.afterEach(async()=>{await app?.close();});

test('shows only owned Clues, buys one, then confirms a private bid',async({},info)=>{
 const env=Object.fromEntries(Object.entries(process.env).filter((e):e is [string,string]=>e[1]!==undefined));delete env.ELECTRON_RUN_AS_NODE;delete env.ELECTRON_DEV_URL;
 app=await electron.launch({args:[path.resolve('.'),`--user-data-dir=${info.outputPath('profile')}`],env});const page=await app.firstWindow();
 let bought=false,amount:string|null=null,phase:'TRADE'|'BID'='TRADE';
 const future=(seconds:number)=>new Date(Date.now()+seconds*1000).toISOString();
 await page.route('**/api/auth/me',r=>r.fulfill({json:{id:3,username:'bob',role:'USER'}}));
 await page.route('**/api/auth/csrf',r=>r.fulfill({json:{token:'test-csrf'}}));
 await page.route('**/api/wallet',r=>r.fulfill({json:{availableBalance:bought?'2950':'3000',lockedBalance:amount??'0',walletId:'3',updatedAt:new Date().toISOString()}}));
 await page.route('**/api/blind/auctions/33',r=>r.fulfill({json:{auctionId:'33',phase,status:'RUNNING',serverNow:new Date().toISOString(),participantCount:4,onlineCount:4,lobbyClosesAt:null,
  product:{name:'Máy ảnh sưu tầm',description:'Máy ảnh cổ điển.',image_url:null},
  ownedClues:[{id:'12',slot:2,content:'Được sản xuất năm 1980',verified:true,acquiredAt:new Date().toISOString()},...(bought?[{id:'11',slot:1,content:'Chỉ có 500 chiếc',verified:true,acquiredAt:new Date().toISOString()}]:[])],
  listings:bought?[]:[{id:'9',clueId:'11',sellerId:'2',seller:'alice',price:'50',version:'1',slot:1}],
  ownBid:amount?{id:'91',amount,at:new Date().toISOString()}:null,historicalStats:{soldCount:0,averagePrice:null,minimumPrice:null,maximumPrice:null},
  revealEndsAt:future(-300),tradeEndsAt:future(300),bidStartsAt:future(360),bidLocksAt:future(460),endsAt:future(480)}}));
 await page.route('**/api/blind/auctions/33/listings/9/buy',r=>{expect(r.request().postDataJSON()).toEqual({version:'1'});bought=true;phase='BID';return r.fulfill({json:{status:'PURCHASED',price:'50'}});});
 await page.route('**/api/blind/auctions/33/bids',r=>{amount=r.request().postDataJSON().amount;return r.fulfill({json:{id:'91',amount,at:new Date().toISOString()}});});
 await page.evaluate(()=>{
  class FakeSocket{
   static OPEN=1;readyState=1;onopen:((event:Event)=>void)|null=null;onclose:((event:Event)=>void)|null=null;onmessage:((event:MessageEvent)=>void)|null=null;
   constructor(_url:string){setTimeout(()=>this.onopen?.(new Event('open')),0);}
   send(raw:string){if(JSON.parse(raw).type==='JOIN_ROOM')setTimeout(()=>this.onmessage?.(new MessageEvent('message',{data:JSON.stringify({type:'AUCTION_STATE',payload:{chatHistory:[]}})})),0);}
   close(){this.onclose?.(new Event('close'));}
  }
  Object.defineProperty(window,'WebSocket',{value:FakeSocket});
 });
 page.on('dialog',dialog=>void dialog.accept());
 await page.goto('app://auction/#/blind/33');
 await expect(page.getByText('Được sản xuất năm 1980')).toBeVisible();
 await expect(page.getByText('Chỉ có 500 chiếc')).toHaveCount(0);
 await page.getByRole('button',{name:/Chợ Clue/}).click();
 await page.getByRole('button',{name:'Mua Clue'}).click();
 await page.getByRole('button',{name:/Manh mối/}).click();
 await expect(page.getByText('Chỉ có 500 chiếc')).toBeVisible();
 await page.getByLabel('Giá đặt (Coin)').fill('650');
 await page.getByRole('button',{name:'Đặt bid kín'}).click();
 await expect(page.getByText('Bid đã xác nhận của bạn')).toBeVisible();
 await expect(page.locator('.room-price-row').getByText('650 Coin',{exact:true})).toBeVisible();
});

test('admin configures the BLIND room and starts it when four players are online',async({},info)=>{
 const env=Object.fromEntries(Object.entries(process.env).filter((e):e is [string,string]=>e[1]!==undefined));delete env.ELECTRON_RUN_AS_NODE;delete env.ELECTRON_DEV_URL;
 app=await electron.launch({args:[path.resolve('.'),`--user-data-dir=${info.outputPath('profile')}`],env});const page=await app.firstWindow();
 let status='UPCOMING',tradeSeconds=300,bidSeconds=100;
 const settings=()=>({tradeSeconds,bidSeconds,status,participantCount:4,onlineCount:4,scheduledStartAt:new Date(Date.now()+300000).toISOString(),lobbyClosesAt:new Date(Date.now()+3600000).toISOString(),canStartNow:status==='UPCOMING'});
 await page.route('**/api/auth/me',route=>route.fulfill({json:{id:1,username:'admin',role:'ADMIN'}}));
 await page.route('**/api/auth/csrf',route=>route.fulfill({json:{token:'test-csrf'}}));
 await page.route('**/api/admin/blind/auctions/33/clues',route=>route.fulfill({json:{clues:['A','B','C','D']}}));
 await page.route('**/api/admin/blind/auctions/33/settings',route=>{
  if(route.request().method()==='PUT'){const input=route.request().postDataJSON();tradeSeconds=input.tradeSeconds;bidSeconds=input.bidSeconds;}
  return route.fulfill({json:settings()});
 });
 await page.route('**/api/admin/blind/auctions/33/start',route=>{status='RUNNING';return route.fulfill({json:settings()});});
 await page.goto('app://auction/#/admin/auctions/33/clues');
 await expect(page.getByRole('heading',{name:'Thiết lập phòng BLIND'})).toBeVisible();
 await page.getByLabel('Thời gian mua bán Clue (giây)').fill('240');
 await page.getByLabel('Thời gian đặt và sửa bid (giây)').fill('90');
 await page.getByRole('button',{name:'Lưu thời lượng'}).click();
 await expect(page.getByText('Đã lưu thời lượng cho phiên.')).toBeVisible();
 await page.getByRole('button',{name:/Start now/}).click();
 await expect(page.getByText('Phiên đã bắt đầu.')).toBeVisible();
});

test('replay uses the same room frame after a BLIND auction',async({},info)=>{
 const env=Object.fromEntries(Object.entries(process.env).filter((e):e is [string,string]=>e[1]!==undefined));delete env.ELECTRON_RUN_AS_NODE;delete env.ELECTRON_DEV_URL;
 app=await electron.launch({args:[path.resolve('.'),`--user-data-dir=${info.outputPath('profile')}`],env});const page=await app.firstWindow();
 await page.route('**/api/auth/me',route=>route.fulfill({json:{id:3,username:'bob',role:'USER'}}));
 await page.route('**/api/auctions/33/replay',route=>route.fulfill({json:{auctionId:33,auctionType:'BLIND',status:'SOLD',product:{name:'Máy ảnh sưu tầm'},result:{status:'SOLD',winningPrice:650},events:[{type:'AUCTION_STARTED',at:new Date().toISOString(),payload:{}},{type:'BID_PLACED',at:new Date().toISOString(),payload:{amount:650,ownBid:true}},{type:'AUCTION_FINISHED',at:new Date().toISOString(),payload:{status:'SOLD',winningPrice:650}}]}}));
 await page.goto('app://auction/#/auctions/33/replay');
 await expect(page.getByRole('heading',{name:'Diễn biến phiên'})).toBeVisible();
 await expect(page.getByText('Đã bán thành công')).toBeVisible();
 await expect(page.getByText('Bid 650 Coin của bạn')).toBeVisible();
});
