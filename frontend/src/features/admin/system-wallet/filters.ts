export type Filters={auctionId:string;type:string;from:string;to:string};
function day(value:string,next:boolean){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('Ngày không hợp lệ.');
 const [y,m,d]=value.split('-').map(Number);const date=new Date(y,m-1,d);
 if(y<1000||y>9999||date.getFullYear()!==y||date.getMonth()!==m-1||date.getDate()!==d)throw Error('Ngày không hợp lệ.');
 if(next)date.setDate(date.getDate()+1);return date.toISOString();
}
export function queryFilters(f:Filters){
 if(f.auctionId&&(!/^[1-9][0-9]{0,18}$/.test(f.auctionId)||BigInt(f.auctionId)>9223372036854775807n))throw Error('Mã phiên phải là số nguyên dương hợp lệ.');
 if(!['','DEPOSIT','LOCK','UNLOCK','PAYMENT'].includes(f.type))throw Error('Loại giao dịch không hợp lệ.');
 if(f.from&&f.to&&f.from>f.to)throw Error('Ngày kết thúc phải từ ngày bắt đầu trở đi.');
 return {auctionId:f.auctionId||undefined,type:f.type||undefined,from:f.from?day(f.from,false):undefined,to:f.to?day(f.to,true):undefined};
}
