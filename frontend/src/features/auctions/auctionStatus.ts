type TimedAuction={status:string;startTime:string;endTime:string;serverNow?:string};
export const auctionStatuses:Record<string,string>={UPCOMING:'Sắp diễn ra',RUNNING:'Đang diễn ra',SOLD:'Đã bán',UNSOLD:'Chưa bán được'};
export function auctionStatusLabel(auction:TimedAuction):string{
 const now=Date.parse(auction.serverNow??'');
 if(auction.status==='UPCOMING'||auction.status==='RUNNING'){
  if(now>=Date.parse(auction.endTime))return 'Đã hết giờ · Chờ kết quả';
  if(auction.status==='UPCOMING'&&now>=Date.parse(auction.startTime))return 'Đã đến giờ · Chờ mở phiên';
 }
 return auctionStatuses[auction.status]??auction.status;
}
