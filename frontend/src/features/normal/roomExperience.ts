import { useEffect, useRef, useState } from 'react';
import { leadingBid, type NormalAuction, type NormalBid } from './types';

export const roomCoin = (value: number | string) => `${(typeof value === 'string' ? BigInt(value) : value).toLocaleString('vi-VN')} Coin`;
export function roomClock(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(value => String(value).padStart(2, '0')).join(':');
}
export function rankBids(bids: NormalBid[]) {
  const best = new Map<string, NormalBid>();
  for (const bid of bids) {
    const old = best.get(bid.username);
    if (!old || bid.amount > old.amount || (bid.amount === old.amount && bid.id < old.id)) best.set(bid.username, bid);
  }
  return [...best.values()].sort((a, b) => b.amount - a.amount || a.createdAt.localeCompare(b.createdAt) || a.id - b.id);
}
export const rhythmNames = ['Mở giá', 'Cạnh tranh', 'Chốt giá'];
export function roomRhythm(auction: NormalAuction, now: number) {
  const scheduledEnd = auction.scheduledEndsAt ?? auction.endsAt;
  const duration = Math.max(3, scheduledEnd - auction.startsAt);
  const boundaries = [auction.startsAt + duration / 2, auction.startsAt + duration * 5 / 6, auction.endsAt];
  const index = now < boundaries[0] ? 0 : now < boundaries[1] ? 1 : 2;
  return { index, boundaries, scheduledEnd };
}
type Notice = { id: string; text: string; warning?: boolean };
export function useRoomNotices(auction: NormalAuction | null, username: string, rhythm: number) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [summary, setSummary] = useState<number | null>(null);
  const [lastBid, setLastBid] = useState<number | null>(null);
  const previous = useRef<{ id: number; bid: number; leader?: string; end: number; rhythm: number } | null>(null);
  useEffect(() => {
    if (!auction) return;
    const leader = leadingBid(auction);
    const before = previous.current;
    previous.current = { id: auction.id, bid: auction.bids.reduce((highest, bid) => Math.max(highest, bid.id), 0), leader: leader?.username, end: auction.endsAt, rhythm };
    if (!before || before.id !== auction.id) { setNotices([]); setSummary(null); return; }
    const fresh = auction.bids.filter(bid => bid.id > before.bid).sort((a, b) => a.id - b.id);
    const additions: Notice[] = fresh.slice(-2).map(bid => ({ id: `bid-${bid.id}`, text: `${bid.username === username ? 'Bạn' : bid.username} vừa trả ${roomCoin(bid.amount)}` }));
    if (fresh.length && before.leader === username && leader?.username !== username) {
      const notice = additions[additions.length - 1]; notice.text += ' — vượt giá của bạn'; notice.warning = true;
    }
    if (auction.endsAt > before.end) additions.push({ id: `end-${auction.endsAt}`, text: 'Đã gia hạn thời gian chốt giá' });
    if (rhythm > before.rhythm && auction.status === 'RUNNING') setSummary(rhythm - 1);
    if (fresh.length) setLastBid(fresh[fresh.length - 1].id);
    if (additions.length) setNotices(items => [...items, ...additions].slice(-2));
  }, [auction, username, rhythm]);
  useEffect(() => { if (!notices.length) return; const timer = window.setTimeout(() => setNotices([]), 6500); return () => window.clearTimeout(timer); }, [notices]);
  useEffect(() => { if (lastBid === null) return; const timer = window.setTimeout(() => setLastBid(null), 2000); return () => window.clearTimeout(timer); }, [lastBid]);
  return { notices, summary, lastBid, closeSummary: () => setSummary(null), dismiss: (id: string) => setNotices(items => items.filter(item => item.id !== id)) };
}
