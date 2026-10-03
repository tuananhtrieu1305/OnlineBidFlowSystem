import {describe,it,expect} from 'vitest';
import {auctionStatusLabel} from '../src/features/auctions/auctionStatus';
describe('auction status reflects server time without inventing settlement',()=>{
 const base={status:'UPCOMING',startTime:'2030-01-01T01:00:00Z',endTime:'2030-01-01T02:00:00Z',serverNow:'2030-01-01T00:00:00Z'};
 it('shows upcoming only before the start',()=>{
  expect(auctionStatusLabel(base)).toBe('Sắp diễn ra');
  expect(auctionStatusLabel({...base,serverNow:base.startTime})).toBe('Đã đến giờ · Chờ mở phiên');
  expect(auctionStatusLabel({...base,status:'RUNNING',serverNow:base.startTime})).toBe('Đang diễn ra');
 });
 it('does not call an expired auction upcoming or running, or infer a winner',()=>{
  for(const status of ['UPCOMING','RUNNING'])expect(auctionStatusLabel({...base,status,serverNow:base.endTime})).toBe('Đã hết giờ · Chờ kết quả');
  expect(auctionStatusLabel({...base,status:'SOLD',serverNow:base.endTime})).toBe('Đã bán');
  expect(auctionStatusLabel({...base,status:'UNSOLD',serverNow:base.endTime})).toBe('Chưa bán được');
 });
 it('supports older responses without server time',()=>{
  expect(auctionStatusLabel({...base,serverNow:undefined})).toBe('Sắp diễn ra');
  expect(auctionStatusLabel({...base,status:'UNKNOWN'})).toBe('UNKNOWN');
 });
});
