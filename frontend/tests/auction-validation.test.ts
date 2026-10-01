import {describe,it,expect} from 'vitest';
import {localTime,utcTime,validateAuction,type AuctionFields} from '../src/features/auctions/configuration/validation';
const fields:AuctionFields={auctionType:'NORMAL',accessType:'PRIVATE',startingPrice:'100',minBidIncrement:'10',maxParticipants:'2',startTime:'2030-01-02T10:00:00',endTime:'2030-01-02T11:00:00'};
describe('auction time and validation',()=>{
 it('round trips local datetime and rejects normalized invalid dates',()=>{
  expect(localTime(utcTime(fields.startTime)!)).toBe(fields.startTime);
  expect(utcTime('2030-02-30T10:00')).toBeNull();expect(utcTime('invalid')).toBeNull();expect(localTime('invalid')).toBe('');
  expect(utcTime('2030-01-02T10:00')).not.toBeNull();
 });
 it('validates future time, price overflow and private capacity',()=>{
  const now=new Date('2029-01-01').getTime();expect(validateAuction(fields,now)).toEqual({});
  expect(validateAuction({...fields,startingPrice:'9223372036854775807'},now)).toHaveProperty('minBidIncrement');
  expect(Object.keys(validateAuction({...fields,startingPrice:'0',minBidIncrement:'1.5',maxParticipants:'2147483648',startTime:'',endTime:''},now))).toHaveLength(5);
  expect(validateAuction({...fields,auctionType:'BLIND',accessType:'PUBLIC',minBidIncrement:'',maxParticipants:''},now)).toEqual({});
  expect(validateAuction({...fields,endTime:fields.startTime},now)).toHaveProperty('endTime');
  expect(validateAuction(fields,new Date('2031-01-01').getTime())).toHaveProperty('startTime');
 });
});
