export type AuctionFields={auctionType:'NORMAL'|'BLIND';accessType:'PUBLIC'|'PRIVATE';startingPrice:string;minBidIncrement:string;maxParticipants:string;startTime:string;endTime:string;closingWindowSeconds?:string;extensionSeconds?:string;leaderboardSeconds?:string;blindClues:string[];systemClues?:string[];tradeSeconds:string;bidSeconds:string};
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
 if(f.auctionType==='NORMAL'){
  for(const key of ['closingWindowSeconds','extensionSeconds','leaderboardSeconds'] as const){const value=f[key]??(key==='leaderboardSeconds'?'60':'10');if(!/^[1-9][0-9]{0,3}$/.test(value)||Number(value)>3600)e[key]='Nhập số giây nguyên từ 1 đến 3600.';}
  if(!e.extensionSeconds&&!e.closingWindowSeconds&&Number(f.extensionSeconds??10)<Number(f.closingWindowSeconds??10))e.extensionSeconds='Thời gian phản hồi phải ít nhất bằng ngưỡng gia hạn.';
 }
 if(f.auctionType==='BLIND'&&(!/^[1-9][0-9]*$/.test(f.maxParticipants)||Number(f.maxParticipants)<3||Number(f.maxParticipants)>30))e.maxParticipants='Chọn từ 3 đến 30 người.';
 if(f.auctionType==='BLIND'){
  const count=Number(f.maxParticipants);
  const playerClues=f.blindClues.map(c=>c.trim()),systemClues=(f.systemClues??[]).map(c=>c.trim());
  if(playerClues.length<count||playerClues.length>100||playerClues.some(c=>!c||c.length>500)||new Set(playerClues).size!==playerClues.length)
   e.blindClues='Cần ít nhất một Clue cho mỗi chỗ, tối đa 100 Clue khác nhau.';
  if(systemClues.length>10||systemClues.some(c=>!c||c.length>500||playerClues.includes(c))||new Set(systemClues).size!==systemClues.length)
   e.systemClues='Nhập tối đa 10 Clue hệ thống, mỗi Clue khác nhau và không trùng pool người chơi.';
  for(const key of ['tradeSeconds','bidSeconds'] as const){const value=f[key];if(!/^[1-9][0-9]{0,3}$/.test(value)||Number(value)>3600)e[key]='Nhập số giây nguyên từ 1 đến 3600.';}
 }
 if(f.auctionType==='NORMAL'&&f.accessType==='PRIVATE'&&f.maxParticipants&&(!/^[1-9][0-9]{0,9}$/.test(f.maxParticipants)||BigInt(f.maxParticipants)>2147483647n))e.maxParticipants='Giới hạn người phải là số nguyên dương, hoặc để trống.';
 const start=utcTime(f.startTime),end=utcTime(f.endTime);
 if(!start||Date.parse(start)<=now)e.startTime=f.auctionType==='BLIND'?'Giờ mở phòng theo lịch phải ở tương lai.':'Thời gian bắt đầu phải hợp lệ và ở tương lai.';
 if(f.auctionType==='NORMAL'&&(!end||(start&&Date.parse(end)<=Date.parse(start))))e.endTime='Thời gian kết thúc phải sau thời gian bắt đầu.';
 return e;
}
