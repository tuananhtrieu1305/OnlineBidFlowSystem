export type AuctionFields={auctionType:'NORMAL'|'BLIND';accessType:'PUBLIC'|'PRIVATE';startingPrice:string;minBidIncrement:string;maxParticipants:string;startTime:string;endTime:string};
export function localTime(iso:string){const d=new Date(iso);if(!Number.isFinite(d.getTime()))return '';return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,19);}
export function utcTime(local:string){if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(local))return null;const date=new Date(local);if(!Number.isFinite(date.getTime())||localTime(date.toISOString()).slice(0,local.length)!==local)return null;return date.toISOString();}
function coin(value:string){return /^[1-9][0-9]{0,18}$/.test(value)&&BigInt(value)<=9223372036854775807n;}
export function validateAuction(f:AuctionFields,now:number){
 const e:Partial<Record<keyof AuctionFields,string>>={};
 if(!coin(f.startingPrice))e.startingPrice='Nhập giá khởi điểm là số Coin nguyên dương hợp lệ.';
 if(f.auctionType==='NORMAL'){
  if(!coin(f.minBidIncrement))e.minBidIncrement='Nhập bước giá là số Coin nguyên dương hợp lệ.';
  else if(!e.startingPrice&&BigInt(f.startingPrice)+BigInt(f.minBidIncrement)>9223372036854775807n)e.minBidIncrement='Giá khởi điểm cộng bước giá vượt giới hạn Coin.';
 }
 if(f.accessType==='PRIVATE'&&f.maxParticipants&&(!/^[1-9][0-9]{0,9}$/.test(f.maxParticipants)||BigInt(f.maxParticipants)>2147483647n))e.maxParticipants='Giới hạn người phải là số nguyên dương, hoặc để trống.';
 const start=utcTime(f.startTime),end=utcTime(f.endTime);
 if(!start||Date.parse(start)<=now)e.startTime='Thời gian bắt đầu phải hợp lệ và ở tương lai.';
 if(!end||(start&&Date.parse(end)<=Date.parse(start)))e.endTime='Thời gian kết thúc phải sau thời gian bắt đầu.';
 return e;
}
