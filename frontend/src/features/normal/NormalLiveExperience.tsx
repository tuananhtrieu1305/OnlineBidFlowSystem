import { useEffect, useMemo, useRef, useState } from 'react';
import { leadingBid, type NormalAuction, type NormalBid } from './types';

const coin = (value: number) => `${value.toLocaleString('vi-VN')} Coin`;
const clock = (seconds: number) => [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(value => String(value).padStart(2, '0')).join(':');
type Notice = { id: string; text: string; warning?: boolean };

export default function NormalLiveExperience({ auction, now, username, stale }: { auction: NormalAuction; now: number; username: string; stale: boolean }) {
  const timing = auction.normalTiming ?? { closingWindowSeconds: 30, extensionSeconds: 30, leaderboardSeconds: 60 };
  const running = auction.status === 'RUNNING';
  const finished = ['SOLD', 'UNSOLD'].includes(auction.status);
  const seconds = Math.max(0, Math.ceil((auction.endsAt - now) / 1000));
  const leader = leadingBid(auction);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [boardOpened, setBoardOpened] = useState(false);
  const [recentBid, setRecentBid] = useState<number | null>(null);
  const previous = useRef<{ bidId: number; leader?: string; end: number } | null>(null);
  const rows = useMemo(() => {
    const best = new Map<string, NormalBid>();
    for (const bid of auction.bids) {
      const old = best.get(bid.username);
      if (!old || bid.amount > old.amount || (bid.amount === old.amount && (bid.createdAt < old.createdAt || (bid.createdAt === old.createdAt && bid.id < old.id)))) best.set(bid.username, bid);
    }
    return [...best.values()].sort((a, b) => b.amount - a.amount || a.createdAt.localeCompare(b.createdAt) || a.id - b.id);
  }, [auction.bids]);
  const mine = rows.find(bid => bid.username === username);
  const leading = leader?.username === username;
  useEffect(() => {
    if (running && seconds <= timing.leaderboardSeconds) setBoardOpened(true);
  }, [running, seconds, timing.leaderboardSeconds]);
  useEffect(() => {
    const lastId = auction.bids.reduce((highest, bid) => Math.max(highest, bid.id), 0);
    const before = previous.current;
    previous.current = { bidId: lastId, leader: leader?.username, end: auction.endsAt };
    if (!before) return; // Initial load/reconnect history is not a new-bid announcement.
    const fresh = auction.bids.filter(bid => bid.id > before.bidId).sort((a, b) => a.id - b.id);
    const additions: Notice[] = fresh.slice(-2).map(bid => ({ id: `bid-${bid.id}`, text: `${bid.username === username ? 'Bạn' : bid.username} vừa trả ${coin(bid.amount)}.` }));
    if (before.leader === username && leader && leader.username !== username && fresh.length) {
      const last = additions[additions.length - 1];
      if (last) { last.text += ' Bạn đã mất vị trí dẫn đầu.'; last.warning = true; }
    }
    if (auction.endsAt > before.end && running) additions.push({ id: `extension-${auction.endsAt}`, text: `Có giá mới — đã gia hạn thời gian trả giá. Còn thời gian phản hồi theo luật ${timing.extensionSeconds} giây.` });
    if (fresh.length) setRecentBid(fresh[fresh.length - 1].id);
    if (additions.length) setNotices(items => [...items, ...additions].slice(-3));
  }, [auction.bids, auction.endsAt, running, leader?.username, username, timing.extensionSeconds]);
  useEffect(() => { if (!notices.length) return; const timer = window.setTimeout(() => setNotices([]), 8000); return () => window.clearTimeout(timer); }, [notices]);
  useEffect(() => { if (recentBid === null) return; const timer = window.setTimeout(() => setRecentBid(null), 2500); return () => window.clearTimeout(timer); }, [recentBid]);

  return <>
    <aside className="normal-live-notices" aria-live="polite" aria-atomic="false" aria-label="Thông báo đấu giá">
      {notices.map(notice => <div key={notice.id} className={`normal-live-notice ${notice.warning ? 'warning' : ''}`}><span>{notice.text}</span><button type="button" aria-label="Đóng thông báo" onClick={() => setNotices(items => items.filter(item => item.id !== notice.id))}>×</button></div>)}
    </aside>
    {running && <section className={`normal-live-clock ${seconds <= timing.closingWindowSeconds ? 'urgent' : boardOpened ? 'closing' : ''}`} aria-label="Đồng hồ chốt phiên">
      <div><span className="normal-live-kicker">{seconds === 0 ? 'Đang chờ server chốt kết quả' : boardOpened ? 'Giai đoạn chốt giá' : 'Phiên đang diễn ra'}</span><strong role="timer" aria-label="Thời gian đấu giá còn lại">{clock(seconds)}</strong></div>
      <div><p>Có bid hợp lệ trong <b>{timing.closingWindowSeconds}s cuối</b> → bảo đảm còn <b>{timing.extensionSeconds}s</b> phản hồi.</p><small>{stale ? 'Đang đồng bộ với server. Chưa thể gửi giá mới.' : seconds === 0 ? 'Không nhận thêm giá cho đến khi server xác nhận thời hạn và kết quả.' : 'Đồng hồ theo thời gian server. Người dẫn đầu chưa phải người thắng chính thức.'}</small></div>
    </section>}
    {!finished && auction.joined && <div className={`normal-my-position ${leading ? 'leading' : mine ? 'outbid' : ''}`}>
      <strong>{leading ? 'Bạn đang dẫn đầu' : mine ? 'Bạn đã bị vượt giá' : 'Bạn chưa đặt giá'}</strong>
      <span>{leading ? `Mức giá của bạn: ${coin(leader?.amount ?? 0)}` : mine ? `Giá cao nhất của bạn: ${coin(mine.amount)} · Giành lại vị trí từ ${coin((leader?.amount ?? auction.startingPrice) + auction.increment)}` : auction.status === 'UPCOMING' ? 'Chờ giờ bắt đầu để tham gia trả giá.' : `Mức giá tối thiểu: ${coin((leader?.amount ?? auction.startingPrice) + auction.increment)}`}</span>
    </div>}
    {finished && <section className={`normal-auction-result ${auction.winner === username ? 'won' : ''}`} aria-label="Kết quả đấu giá">
      <p className="normal-live-kicker">Kết quả chính thức</p><h2>{auction.status === 'UNSOLD' ? 'Phiên kết thúc — sản phẩm chưa bán' : auction.winner === username ? 'Bạn đã thắng phiên đấu giá!' : `${auction.winner} thắng phiên đấu giá`}</h2>
      <p>{auction.status === 'SOLD' ? `Giá thắng: ${coin(auction.winningPrice!)} · ${auction.bids.length} lượt trả giá · ${rows.length} người trả giá.` : 'Không có lượt trả giá hợp lệ để chốt bán.'}</p>
      {auction.status === 'SOLD' && <small>{auction.winner === username ? 'Đã thanh toán Coin khi server chốt phiên. Xem giao dịch trong Ví Coin.' : 'Server đã chốt thanh toán cho người thắng. Các khoản giữ Coin của phiên đã được xử lý.'}</small>}
    </section>}
    {(boardOpened || finished) && <section className="normal-live-board" aria-labelledby="normal-live-board-title">
      <div className="normal-live-board-heading"><div><span className="normal-live-kicker">{finished ? 'Kết quả xếp hạng' : 'LIVE · Chặng cuối'}</span><h2 id="normal-live-board-title">Bảng xếp hạng trả giá</h2></div><span>{rows.length} người trả giá</span></div>
      <p className="normal-live-board-help">Mỗi người một dòng theo giá cao nhất đã trả. {finished ? 'Kết quả đã được server chốt.' : 'Thứ hạng có thể đổi đến khi server chốt phiên.'}</p>
      {rows.length ? <div className="normal-live-table-scroll"><table><thead><tr><th>Hạng</th><th>Người chơi</th><th>Giá cao nhất</th><th>Trạng thái</th></tr></thead><tbody>{rows.map((bid, index) => <tr key={bid.username} className={`${index === 0 ? 'first' : ''} ${bid.id === recentBid ? 'changed' : ''}`}><td>{index === 0 ? '♛ 1' : index + 1}</td><td>{bid.username}{bid.username === username && <small> (bạn)</small>}</td><td>{coin(bid.amount)}</td><td>{finished ? auction.status === 'SOLD' && bid.username === auction.winner ? 'Người thắng' : 'Đã kết thúc' : index === 0 ? 'Đang dẫn đầu' : 'Đã bị vượt'}</td></tr>)}</tbody></table></div> : <p className="normal-board-empty">Chưa có lượt trả giá. Người chơi có thể bắt đầu từ mức giá tối thiểu.</p>}
    </section>}
  </>;
}
