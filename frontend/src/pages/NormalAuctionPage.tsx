import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';
import { useNormalApi } from '../features/normal/useNormalApi';
import { useNormalRealtime } from '../features/normal/useNormalRealtime';
import { leadingBid } from '../features/normal/types';
import { rankBids, roomClock, roomCoin as coin, roomRhythm, rhythmNames, useRoomNotices } from '../features/normal/roomExperience';
import WinnerCelebration from '../features/normal/WinnerCelebration';
import ProductImage from '../features/normal/ProductImage';
import '../features/normal/normal.css';
import '../features/normal/normal-room.css';

export default function NormalAuctionPage() {
  const auth = useAuth();
  const location = useLocation();
  const { id } = useParams();
  const initialId = id && Number.isSafeInteger(Number(id)) && Number(id) > 0 ? Number(id) : undefined;
  const api = useNormalApi(initialId);
  const { auction, selected, selectedId } = api;
  const username = api.me?.username ?? auth.user?.username ?? '';
  const [roomCode, setRoomCode] = useState('');
  const [socketCode, setSocketCode] = useState('');
  const [chat, setChat] = useState('');
  const [amount, setAmount] = useState('');
  const [feedback, setFeedback] = useState('');
  const [winnerReplay, setWinnerReplay] = useState(0);
  const [board, setBoard] = useState<number | 'live'>('live');
  const [localNow, setLocalNow] = useState(Date.now);
  const chatList = useRef<HTMLDivElement>(null);
  const stickChat = useRef(true);
  const now = localNow + api.clockOffset;
  const finished = auction?.status === 'SOLD' || auction?.status === 'UNSOLD';
  const running = auction?.status === 'RUNNING';
  const upcoming = auction?.status === 'UPCOMING';
  const rhythm = auction ? roomRhythm(auction, now) : null;
  const timing = auction?.normalTiming ?? { closingWindowSeconds: 30, extensionSeconds: 30, leaderboardSeconds: 60 };
  const events = useRoomNotices(auction, username, rhythm?.index ?? 0);
  const realtime = useNormalRealtime(selectedId, Boolean(auction?.joined && api.me?.role === 'USER' && (running || upcoming)), socketCode, api.refresh);
  const leader = auction ? leadingBid(auction) : undefined;
  const current = leader?.amount ?? auction?.startingPrice ?? 0;
  const minimum = current + (auction?.increment ?? 0);
  const accepting = Boolean(running && auction?.joined && api.me?.role === 'USER' && now >= auction.startsAt && now < auction.endsAt && !api.stale && !api.busy);
  const rows = rankBids(auction?.bids ?? []);
  const mine = rows.find(bid => bid.username === username);
  const boardBids = board === 'live' || !rhythm ? auction?.bids ?? [] : (auction?.bids ?? []).filter(bid => Date.parse(bid.createdAt) < rhythm.boundaries[board]);
  const boardRows = rankBids(boardBids);
  const phaseRemaining = !auction || !rhythm ? 0 : upcoming ? auction.startsAt - now : rhythm.boundaries[rhythm.index] - now;
  const urgent = running && Boolean(auction && auction.endsAt - now <= timing.closingWindowSeconds * 1000);
  const closingBoard = running && Boolean(auction && auction.endsAt - now <= timing.leaderboardSeconds * 1000);
  const needsJoin = selected && !selected.joined && api.me?.role === 'USER' && ['RUNNING', 'UPCOMING'].includes(selected.status);

  useEffect(() => { const timer = window.setInterval(() => setLocalNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { setSocketCode(typeof location.state?.roomCode === 'string' ? location.state.roomCode : ''); setRoomCode(''); setChat(''); setAmount(''); setFeedback(''); setBoard('live'); }, [selectedId, location.state]);
  useEffect(() => { if (events.summary === null) return; setBoard(events.summary); const timer = window.setTimeout(() => { events.closeSummary(); setBoard('live'); }, 10000); return () => window.clearTimeout(timer); }, [events.summary]);
  useEffect(() => { if (finished) { events.closeSummary(); setBoard('live'); } }, [finished]);
  useEffect(() => { if (chatList.current && stickChat.current) chatList.current.scrollTop = chatList.current.scrollHeight; }, [realtime.messages]);

  async function submitBid(event: FormEvent) {
    event.preventDefault();
    const value = Number(amount);
    if (!Number.isSafeInteger(value) || value <= 0) { setFeedback('Nhập số Coin nguyên dương.'); return; }
    setFeedback('');
    const result = await api.bid(value);
    if (result) { setAmount(''); setFeedback(`Đã ghi nhận ${coin(value)}.`); }
  }
  async function join(event: FormEvent) {
    event.preventDefault();
    const result = await api.join(roomCode.trim());
    if (result) { setSocketCode(roomCode.trim()); setRoomCode(''); }
  }

  if (auth.loading) return <main className="normal-room room-loading"><p role="status">Đang mở phòng…</p><Link className="room-exit" to="/normal" aria-label="Thoát phòng">×</Link></main>;
  if (!auth.user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;

  return <main id="main-content" tabIndex={-1} className={`normal-page normal-room ${urgent ? 'room-is-urgent' : ''}`}>
    <header className="room-header">
      <div className="room-identity"><span className="room-logo" aria-hidden="true">N</span><div><small>NORMAL · #{selectedId ?? id} · {selected?.access ?? '…'}</small><h1>{selected?.product.name ?? 'Phòng đấu giá'}</h1></div></div>
      <div className="room-account"><span className="room-avatar" aria-hidden="true">{username.slice(0, 1).toUpperCase()}</span><strong>{username}</strong><span className="room-connection" title={realtime.state === 'connected' ? 'Realtime đã kết nối' : 'Đang đồng bộ'} data-connected={realtime.state === 'connected'} /></div>
      <div className="room-wallet"><div><small>Khả dụng</small><strong data-testid="normal-available">{api.me?.wallet ? coin(api.me.wallet.available) : api.me?.role === 'ADMIN' ? 'Chỉ xem' : '…'}</strong></div><div><small>Đang khóa</small><strong>{api.me?.wallet ? coin(api.me.wallet.locked) : '—'}</strong></div></div>
      <Link className="room-exit" to="/normal" aria-label="Thoát phòng" title="Thoát phòng">×</Link>
    </header>

    <section className="room-timing" aria-label="Tiến trình phiên">
      <div className="room-rhythm-clock"><small>{finished ? 'Đã kết thúc' : upcoming ? 'Nhịp 1/3 · Chờ bắt đầu' : `Nhịp ${(rhythm?.index ?? 0) + 1}/3 · ${rhythmNames[rhythm?.index ?? 0]}`}</small><strong role="timer" aria-label="Thời gian nhịp còn lại">{finished ? '00:00:00' : roomClock(phaseRemaining)}</strong></div>
      <ol className="room-rhythm-steps" aria-label="Ba nhịp đấu giá">{rhythmNames.map((name, index) => <li key={name} className={finished || (!upcoming && index < (rhythm?.index ?? 0)) ? 'done' : index === (rhythm?.index ?? 0) ? 'active' : ''} aria-current={!finished && index === (rhythm?.index ?? 0) ? 'step' : undefined}><span>{index + 1}</span><b>{name}</b></li>)}</ol>
      <div className={`room-session-clock ${urgent ? 'urgent' : ''}`}><small>{finished ? 'Kết quả chính thức' : upcoming ? 'Thời lượng phiên' : 'Còn lại toàn phiên'}</small><strong role="timer" aria-label="Thời gian phiên còn lại">{!auction ? '—' : finished ? '00:00:00' : roomClock(upcoming ? auction.endsAt - auction.startsAt : auction.endsAt - now)}</strong></div>
    </section>

    <div className="room-body">
      <section className="room-product-column" aria-label="Sản phẩm và diễn biến" data-testid="normal-product-panel">
        <div className="room-product-visual">{selected && <ProductImage product={selected.product} />}</div>
        <div className="room-product-details"><h2>{selected?.product.name ?? 'Đang tải sản phẩm…'}</h2><p title={selected?.product.description}>{selected?.product.description || 'Chưa có mô tả.'}</p><div className="room-product-chips"><span>SL {selected?.product.quantity ?? '—'}</span><span>Khởi điểm {auction ? coin(auction.startingPrice) : '—'}</span><span>Bước {auction ? coin(auction.increment) : '—'}</span></div></div>
        <section className="room-activity"><div className="room-section-heading"><h2>Diễn biến</h2><span>{auction?.bids.length ?? 0} lượt</span></div><div className="room-activity-scroll">{auction?.bids.length ? <table aria-label="Lịch sử trả giá"><thead><tr><th scope="col">Người chơi</th><th scope="col">Giá</th><th scope="col">Lúc</th></tr></thead><tbody>{[...auction.bids].reverse().map(bid => <tr key={bid.id} className={events.lastBid === bid.id ? 'room-row-new' : ''}><td>{bid.username === username ? 'Bạn' : bid.username}</td><td>{coin(bid.amount)}</td><td>{new Date(bid.createdAt).toLocaleTimeString('vi-VN')}</td></tr>)}</tbody></table> : <p className="room-empty">Chưa có lượt trả giá</p>}</div></section>
      </section>

      <div className="room-main-column" data-testid="normal-session-column">
        <section className="room-bidding" aria-label="Đặt giá">
          <div className="room-price-row"><div><small>{finished ? 'Giá kết thúc' : 'Giá hiện tại'}</small><strong data-testid="normal-current-price">{auction ? coin(auction.winningPrice ?? current) : '—'}</strong></div><div className="room-leader"><small>{finished ? 'Người thắng' : 'Dẫn đầu'}</small><b>{finished ? auction?.winner ?? 'Không có' : leader?.username === username ? 'Bạn' : leader?.username ?? 'Chưa có'}</b></div></div>
          {finished ? <div className={`room-result ${auction?.winner === username ? 'won' : ''}`} role="status"><strong>{auction?.status === 'UNSOLD' ? 'Phiên chưa bán được sản phẩm' : auction?.winner === username ? 'Bạn đã thắng phiên đấu giá!' : `${auction?.winner} thắng phiên đấu giá`}</strong><span>{auction?.status === 'SOLD' ? 'Đã thanh toán Coin.' : 'Không có bid hợp lệ.'}</span>{auction?.status === 'SOLD' && <button type="button" className="room-winner-replay" onClick={() => setWinnerReplay(value => value + 1)}>Xem người thắng</button>}</div> : <>
            <div className={`room-position ${leader?.username === username ? 'leading' : mine ? 'outbid' : ''}`}><strong>{leader?.username === username ? 'Bạn đang dẫn đầu' : mine ? 'Bạn đã bị vượt giá' : upcoming ? 'Sắp bắt đầu' : 'Sẵn sàng trả giá'}</strong><span>{mine ? `Giá của bạn ${coin(mine.amount)}` : selected?.access === 'PRIVATE' && !selected.joined ? 'Nhập mã để tham gia' : 'Không reset giá khi sang nhịp'}</span></div>
            {needsJoin ? <form onSubmit={join} className="room-join-form">{selected?.access === 'PRIVATE' && <label>Mã phòng<input type="password" required maxLength={50} value={roomCode} onChange={event => setRoomCode(event.target.value)} /></label>}<button className="room-primary" disabled={api.busy || api.stale}>Tham gia phiên</button></form> : <form onSubmit={submitBid} className="room-bid-form" noValidate>
              <label htmlFor="normal-bid-amount">Giá đặt (Coin)</label><div className="room-bid-entry"><input id="normal-bid-amount" type="number" inputMode="numeric" min={minimum} step="1" value={amount} placeholder={String(minimum)} onChange={event => { setAmount(event.target.value); setFeedback(''); }} disabled={!accepting} /><button className="room-primary" type="submit" disabled={!accepting}>{api.busy ? 'Đang gửi…' : 'Đặt giá'}</button></div>
              <div className="room-quick-bids">{[0, 1, 2].map(step => <button key={step} type="button" disabled={!accepting || !Number.isSafeInteger(minimum + step * (auction?.increment ?? 0))} onClick={() => { setAmount(String(minimum + step * (auction?.increment ?? 0))); setFeedback(''); }}><span>{['Giá tối thiểu', '+1 bước', '+2 bước'][step]}</span><b>{coin(minimum + step * (auction?.increment ?? 0))}</b></button>)}</div>
              <p className="room-bid-hint">{api.me?.role === 'ADMIN' ? 'Quản trị viên chỉ xem phiên' : api.stale ? 'Đang đồng bộ dữ liệu…' : upcoming ? 'Chờ giờ bắt đầu' : running && auction && now >= auction.endsAt ? 'Chờ server chốt kết quả' : `Tối thiểu ${coin(minimum)}`}</p>
            </form>}
          </>}
          <div className="room-feedback" aria-live="polite" aria-atomic="true">{(api.error || feedback) && <p className={api.error ? 'error' : ''}>{api.error || feedback}{api.error && <button type="button" disabled={api.busy} onClick={() => void api.refresh()}>Tải lại</button>}</p>}</div>
          <details className="room-rules"><summary>Luật phiên</summary><p>Ba nhịp theo tỷ lệ 3:2:1. Ai đã tham gia cũng được trả giá xuyên suốt. Bid hợp lệ trong {timing.closingWindowSeconds}s cuối bảo đảm còn {timing.extensionSeconds}s phản hồi. Vào phòng cần tối thiểu 50% giá khởi điểm; giá được chấp nhận sẽ khóa Coin.</p></details>
        </section>

        <section className={`room-board ${closingBoard ? 'room-board-closing' : ''} ${events.summary !== null ? 'room-board-summary' : ''}`} aria-labelledby="room-board-title">
          <div className="room-section-heading"><h2 id="room-board-title">{finished ? 'BXH kết quả' : board === 'live' ? closingBoard ? 'BXH · Chốt giá' : 'BXH live' : `Kết nhịp ${board + 1}`}</h2><span>{boardRows.length} người</span></div>
          <div className="room-board-tabs" role="group" aria-label="Chọn bảng xếp hạng"><button type="button" aria-pressed={board === 'live'} onClick={() => { setBoard('live'); events.closeSummary(); }}>Live</button>{rhythmNames.map((name, index) => <button key={name} type="button" disabled={!finished && (!rhythm || now < rhythm.boundaries[index])} aria-pressed={board === index} onClick={() => { events.closeSummary(); setBoard(index); }}>Nhịp {index + 1}</button>)}</div>
          <div className="room-boundary-note" role="status" data-active={events.summary !== null}>{events.summary !== null && <>Kết nhịp {events.summary + 1} · Đang ở nhịp {events.summary + 2}<button type="button" onClick={() => { events.closeSummary(); setBoard('live'); }}>Về live</button></>}</div>
          <div className="room-board-scroll">{boardRows.length ? <table aria-label="Bảng xếp hạng trả giá"><thead><tr><th scope="col">#</th><th scope="col">Người chơi</th><th scope="col">Giá cao nhất</th></tr></thead><tbody>{boardRows.map((bid, index) => <tr key={bid.username} className={`${index === 0 ? 'first' : ''} ${board === 'live' && bid.id === events.lastBid ? 'room-row-new' : ''}`}><td>{index + 1}</td><td>{bid.username}{bid.username === username && <small> · bạn</small>}{index === 0 && <span className="room-rank-label">{finished && board === 'live' ? auction?.status === 'SOLD' && bid.username === auction.winner ? 'Thắng' : 'Kết thúc' : board === 'live' ? 'Dẫn đầu' : 'Dẫn nhịp'}</span>}</td><td>{coin(bid.amount)}</td></tr>)}</tbody></table> : <p className="room-empty">Chưa có lượt trả giá</p>}</div>
        </section>
      </div>

      <aside className="room-chat" aria-labelledby="normal-chat-title"><div className="room-section-heading"><h2 id="normal-chat-title">Chat phòng</h2><span className={realtime.state === 'connected' ? 'connected' : ''}>{finished ? 'Đã đóng' : realtime.state === 'connected' ? 'Trực tuyến' : 'Đang kết nối'}</span></div>
        <div className="room-chat-scroll" ref={chatList} role="log" aria-label="Tin nhắn trong phòng" aria-live="polite" onScroll={event => { const element = event.currentTarget; stickChat.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80; }}>{realtime.messages.length ? realtime.messages.map(message => <div key={message.messageId} className={`room-chat-message ${message.username === username ? 'mine' : ''}`}><div><strong>{message.username === username ? 'Bạn' : message.username}</strong><time>{new Date(message.sentAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</time></div><p>{message.content}</p></div>) : <p className="room-empty">{finished ? 'Phiên đã kết thúc' : 'Chưa có tin nhắn'}</p>}</div>
        {realtime.state === 'room-code-required' && <form className="room-chat-reconnect" onSubmit={event => { event.preventDefault(); setSocketCode(roomCode.trim()); setRoomCode(''); }}><input aria-label="Mã phòng realtime" type="password" required maxLength={50} placeholder="Mã phòng để kết nối lại" value={roomCode} onChange={event => setRoomCode(event.target.value)} /><button className="room-primary">Kết nối</button></form>}
        {realtime.error && <p className="room-chat-error" role="alert">{realtime.error}</p>}
        <form className="room-chat-compose" onSubmit={event => { event.preventDefault(); if (realtime.sendChat(chat)) { setChat(''); stickChat.current = true; } }}><input aria-label="Tin nhắn" maxLength={500} value={chat} onChange={event => setChat(event.target.value)} placeholder="Nhắn trong phòng…" disabled={realtime.state !== 'connected' || realtime.sending} /><button className="room-primary" disabled={realtime.state !== 'connected' || realtime.sending || !chat.trim()} aria-label="Gửi tin nhắn">Gửi</button></form>
      </aside>
    </div>
    {auction?.status === 'SOLD' && auction.winner && auction.winningPrice !== undefined && <WinnerCelebration key={`${auction.id}-${username}`} winner={auction.winner} price={auction.winningPrice} product={auction.product.name} username={username} openSignal={winnerReplay} />}
    <aside className="room-toasts" aria-live="polite" aria-label="Thông báo đấu giá">{events.notices.map(notice => <div key={notice.id} className={notice.warning ? 'warning' : ''}><span>{notice.text}</span><button type="button" aria-label="Đóng thông báo" onClick={() => events.dismiss(notice.id)}>×</button></div>)}</aside>
  </main>;
}
