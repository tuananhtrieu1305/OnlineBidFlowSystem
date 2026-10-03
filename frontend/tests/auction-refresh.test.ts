import {afterEach,expect,it,vi} from 'vitest';
import {watchAuctionUpdates} from '../src/features/auctions/watchAuctionUpdates';
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
it('refreshes on focus, visible timer and return, then removes listeners',()=>{
 vi.useFakeTimers();
 const win=Object.assign(new EventTarget(),{setInterval,clearInterval});
 const doc=Object.assign(new EventTarget(),{visibilityState:'visible'});
 vi.stubGlobal('window',win);vi.stubGlobal('document',doc);
 const refresh=vi.fn(),stop=watchAuctionUpdates(refresh);
 win.dispatchEvent(new Event('focus'));expect(refresh).toHaveBeenCalledTimes(1);
 vi.advanceTimersByTime(10_000);expect(refresh).toHaveBeenCalledTimes(2);
 doc.visibilityState='hidden';vi.advanceTimersByTime(10_000);expect(refresh).toHaveBeenCalledTimes(2);
 doc.visibilityState='visible';doc.dispatchEvent(new Event('visibilitychange'));expect(refresh).toHaveBeenCalledTimes(3);
 stop();win.dispatchEvent(new Event('focus'));doc.dispatchEvent(new Event('visibilitychange'));
 vi.advanceTimersByTime(10_000);expect(refresh).toHaveBeenCalledTimes(3);
});
