// Creates fresh demo records ONLY against the isolated local test backend/database.
import {execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
if(process.env.REGISTRATION_TEST_DATABASE!=='true'||process.env.DB_PORT!=='33308')throw Error('Requires isolated test DB port33308');
const password=process.env.DEMO_PASSWORD;
if(!password||password.length<12||Buffer.byteLength(password)>72)throw Error('Set DEMO_PASSWORD to a12–72byte password');
const prefix='demo2_'+randomBytes(4).toString('hex');
const manifest={prefix,accounts:[],products:[],auctions:[],state:'creating'};
const output=path.resolve('../.cache',prefix+'.json');mkdirSync(path.dirname(output),{recursive:true});
function save(){writeFileSync(output,JSON.stringify(manifest,null,2));}
save();
const sql=q=>execFileSync('docker',['exec','-e',`MYSQL_PWD=${process.env.DB_PASSWORD}`,'onlinebidflow-registration-test','mysql','-uroot','auction_db','-N','-B','-e',q],{encoding:'utf8'}).trim();
function session(){
 let cookie='';
 return async function call(route,method='GET',body,csrf=false){
  let headers={};if(csrf){const t=await call('/api/auth/csrf');headers['X-CSRF-TOKEN']=t.token;}
  if(cookie)headers.Cookie=cookie;
  if(body!==undefined&&!(body instanceof FormData)){headers['Content-Type']='application/json';body=JSON.stringify(body);}
  const r=await fetch('http://localhost:18080'+route,{method,headers,body,signal:AbortSignal.timeout(15000)});
  for(const c of r.headers.getSetCookie()){if(c.startsWith('OBFSESSION='))cookie=c.split(';')[0];}
  if(!r.ok)throw Error(`${method} ${route}: ${r.status}; inspect manifest before rerunning (no automatic retry)`);
  return r.status===204?null:r.json();
 };
}
try{
 const clients={};
 for(const role of ['admin','alice','bob']){
  const username=prefix+'_'+role;const client=session();const account=await client('/api/auth/register','POST',{username,password});
  if(!/^[1-9]\d*$/.test(String(account.id)))throw Error('Registration returned an invalid account ID');
  manifest.accounts.push({id:String(account.id),username});save();
  // Check that this HTTP backend is using the expected isolated database before granting a fixture role.
  if(sql(`SELECT id FROM users WHERE username='${username}'`)!==String(account.id))throw Error('Backend and isolated database do not match');
  if(role==='admin')sql(`START TRANSACTION; DELETE FROM wallets WHERE user_id=${account.id} AND available_balance=0 AND locked_balance=0; UPDATE users SET role='ADMIN' WHERE id=${account.id} AND username='${username}'; COMMIT;`);
  await client('/api/auth/login','POST',{username,password},true);
  if(role!=='admin')await client('/api/wallet/deposits','POST',{amount:'10000'},true);
  clients[role]=client;
 }
 const data=new FormData();data.set('data',new Blob([JSON.stringify({name:prefix+' Máy ảnh demo',description:'Dữ liệu demo riêng, không dùng ví seed cũ.',quantity:1,estimatedPrice:'2500'})],{type:'application/json'}));
 const product=await clients.admin('/api/admin/products','POST',data,true);manifest.products.push({id:product.id,name:product.name});save();
 for(const [auctionType,accessType] of [['NORMAL','PUBLIC'],['BLIND','PRIVATE']]){
  const a=await clients.admin('/api/admin/auctions','POST',{productId:product.id,productVersion:product.version,auctionType,accessType,startingPrice:'1000',minBidIncrement:auctionType==='NORMAL'?'100':null,maxParticipants:accessType==='PRIVATE'?5:null,startTime:new Date(Date.now()+86400000).toISOString(),endTime:new Date(Date.now()+90000000).toISOString()},true);
  manifest.auctions.push({id:a.id,type:auctionType,access:accessType});save();
 }
 manifest.state='ready';save();console.log(`Demo ready: ${output}\nAccounts: ${manifest.accounts.map(a=>a.username).join(', ')}\nUse DEMO_PASSWORD. No password or room code stored in manifest. Auctions are UPCOMING; no scheduler is simulated.`);
}catch(e){manifest.state='incomplete';save();throw e;}
