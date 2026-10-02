import {describe,it,expect} from 'vitest';
import {queryFilters} from '../src/features/admin/system-wallet/filters';
describe('system wallet filters',()=>{
 it('uses a calendar day across DST',()=>{const old=process.env.TZ;process.env.TZ='America/New_York';try{const f=queryFilters({auctionId:'',type:'',from:'2030-03-10',to:'2030-03-10'});expect(Date.parse(f.to!)-Date.parse(f.from!)).toBe(23*60*60*1000);}finally{if(old===undefined)delete process.env.TZ;else process.env.TZ=old;}});
 it('covers a full local day using next calendar midnight',()=>{const f=queryFilters({auctionId:'12',type:'PAYMENT',from:'2030-01-02',to:'2030-01-02'});expect(f.from).toBe(new Date(2030,0,2).toISOString());expect(f.to).toBe(new Date(2030,0,3).toISOString());});
 it('rejects invalid dates ids and ranges',()=>{for(const fields of [{from:'2030-02-30'},{auctionId:'9223372036854775808'},{type:'BAD'},{from:'2030-01-02',to:'2030-01-01'},{from:'xxx'}])expect(()=>queryFilters({auctionId:'',type:'',from:'',to:'',...fields})).toThrow();expect(queryFilters({auctionId:'',type:'',from:'',to:''}).from).toBeUndefined();});
});
