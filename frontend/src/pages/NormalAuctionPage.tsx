import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';
import { useNormalApi } from '../features/normal/useNormalApi';
import { useNormalRealtime } from '../features/normal/useNormalRealtime';
import { leadingBid } from '../features/normal/types';
import { rankBids, roomClock, roomCoin as coin, roomRhythm, rhythmNames, useRoomNotices } from '../features/normal/roomExperience';
import WinnerCelebration from '../features/normal/WinnerCelebration';
import PriceTimelineChart from '../features/normal/PriceTimelineChart';
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
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [dataView, setDataView] = useState<'chart' | 'ranking' | 'history'>('chart');
  const [chartFullscreenSignal, setChartFullscreenSignal] = useState(0);
  const [showFinalRhythmReveal, setShowFinalRhythmReveal] = useState(false);
  const chatToggle = useRef<HTMLButtonElement>(null);
  const chatClose = useRef<HTMLButtonElement>(null);
  const previousRhythm = useRef<{ auctionId: number; index: number } | null>(null);
  const knownMessages = useRef<{ ready: boolean; ids: Set<number> }>({ ready: false, ids: new Set() });
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
  useEffect(() => { setSocketCode(typeof location.state?.roomCode === 'string' ? location.state.roomCode : ''); setRoomCode(''); setChat(''); setAmount(''); setFeedback(''); setBoard('live'); setDataView('chart'); setChatOpen(false); setUnread(0); setShowFinalRhythmReveal(false); knownMessages.current = { ready: false, ids: new Set() }; }, [selectedId, location.state]);
  useEffect(() => {
    if (!auction || !rhythm) return;
    const before = previousRhythm.current;
    previousRhythm.current = { auctionId: auction.id, index: rhythm.index };
    if (auction.status === 'RUNNING' && before?.auctionId === auction.id && before.index === 0 && rhythm.index === 1) setShowFinalRhythmReveal(true);
  }, [auction?.id, auction?.status, rhythm?.index]);
  useEffect(() => { if (!showFinalRhythmReveal) return; const timer = window.setTimeout(() => setShowFinalRhythmReveal(false), 2800); return () => window.clearTimeout(timer); }, [showFinalRhythmReveal]);
  useEffect(() => { if (events.summary === null) return; setBoard(events.summary); setDataView('ranking'); const timer = window.setTimeout(() => { events.closeSummary(); setBoard('live'); }, 10000); return () => window.clearTimeout(timer); }, [events.summary]);
  useEffect(() => { if (finished) { events.closeSummary(); setBoard('live'); setDataView('chart'); } }, [finished]);
  useEffect(() => { if (chatList.current && stickChat.current) chatList.current.scrollTop = chatList.current.scrollHeight; }, [realtime.messages, chatOpen]);

  useEffect(() => {
    const known = knownMessages.current;
    const fresh = realtime.messages.filter(message => !known.ids.has(message.messageId));
    for (const message of realtime.messages) known.ids.add(message.messageId);
    if (chatOpen) setUnread(0);
    else if (known.ready) { const count = fresh.filter(message => message.username !== username).length; if (count) setUnread(value => value + count); }
    if (realtime.state === 'connected' || realtime.messages.length) known.ready = true;
  }, [realtime.messages, realtime.state, chatOpen, username]);
  useEffect(() => { if (chatOpen) chatClose.current?.focus(); }, [chatOpen]);
  function collapseChat() { setChatOpen(false); chatToggle.current?.focus(); }

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
    <header className="room-header" data-finished={finished}>
      <div className="room-identity"><div><small>Phiên #{selectedId ?? id} · {selected?.access === 'PRIVATE' ? 'Riêng tư' : 'Công khai'}</small><h1>{selected?.product.name ?? 'Phòng đấu giá'}</h1></div></div>
      <section className="room-header-timing" aria-label="Tiến trình phiên">
        <div className="room-rhythm-clock"><small>{finished ? 'Nhịp' : upcoming ? 'Nhịp 1/2 · Chờ mở' : `Nhịp ${(rhythm?.index ?? 0) + 1}/2 · ${rhythmNames[rhythm?.index ?? 0]}`}</small><strong role={finished ? undefined : 'timer'} aria-label="Thời gian nhịp còn lại">{finished ? '2/2' : roomClock(phaseRemaining)}</strong></div>
      </section>
      <div className="room-header-account"><div className="room-account"><span className="room-avatar" aria-hidden="true">{username.slice(0, 1).toUpperCase()}</span><strong title={username}>{username}</strong></div><div className="room-wallet"><div><small>Khả dụng</small><strong data-testid="normal-available" title={api.me?.wallet ? coin(api.me.wallet.available) : ''}>{api.me?.wallet ? coin(api.me.wallet.available) : api.me?.role === 'ADMIN' ? 'Chỉ xem' : '…'}</strong></div><div><small>Đang khóa</small><strong title={api.me?.wallet ? coin(api.me.wallet.locked) : ''}>{api.me?.wallet ? coin(api.me.wallet.locked) : '—'}</strong></div></div></div>
      <button type="button" ref={chatToggle} className="room-chat-toggle" aria-controls="normal-room-chat" aria-expanded={chatOpen} aria-label={chatOpen ? 'Thu gọn chat' : unread ? `Mở chat, ${unread} tin nhắn mới` : 'Mở chat'} onClick={() => chatOpen ? collapseChat() : setChatOpen(true)}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M20 11.5a8 8 0 0 1-8 8H5l-3 3v-11a9 9 0 0 1 18 0Z"/><path d="M7 10h8M7 14h5"/></svg><span>Chat</span>{unread > 0 && <b className="room-chat-unread" aria-hidden="true">{Math.min(unread, 99)}</b>}</button>
      <Link className="room-exit" to="/normal" aria-label="Thoát phòng" title="Thoát phòng"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></Link>
    </header>

    <div className="room-body">
      <section className="room-product-column" aria-label="Ảnh và thông tin sản phẩm" data-testid="normal-product-panel">
        <div className="room-product-visual">{selected && <ProductImage product={selected.product} />}</div>
        <div className="room-product-details"><h2>Thông tin sản phẩm</h2><p title={selected?.product.description}>{selected?.product.description || 'Chưa có mô tả.'}</p></div>

      </section>

      <div className="room-main-column" data-testid="normal-session-column">
        <section className="room-bidding" aria-label="Đặt giá" tabIndex={0}>
          <div className="room-price-row"><div><small>{finished ? 'Giá kết thúc' : 'Giá hiện tại'}</small><strong data-testid="normal-current-price">{auction ? coin(auction.winningPrice ?? current) : '—'}</strong></div><div className="room-leader"><small>{finished ? 'Người thắng' : 'Dẫn đầu'}</small><b>{finished ? auction?.winner ?? 'Không có' : leader?.username === username ? 'Bạn' : leader?.username ?? 'Chưa có'}</b></div></div>
          {finished ? <div className={`room-result ${auction?.winner === username ? 'won' : ''}`} role="status"><strong>{auction?.status === 'UNSOLD' ? 'Phiên chưa bán được sản phẩm' : auction?.winner === username ? 'Bạn đã thắng phiên đấu giá!' : `${auction?.winner} thắng phiên đấu giá`}</strong><span>{auction?.status === 'SOLD' ? 'Đã thanh toán Coin.' : 'Không có bid hợp lệ.'}</span>{auction?.status === 'SOLD' && <button type="button" className="room-winner-replay" onClick={() => setWinnerReplay(value => value + 1)}>Xem người thắng</button>}<button type="button" className="room-winner-replay" onClick={() => { setDataView('chart'); setChartFullscreenSignal(value => value + 1); }}>Xem lại biểu đồ toàn màn hình</button></div> : <>
            <div className={`room-position ${leader?.username === username ? 'leading' : mine ? 'outbid' : ''}`}><strong>{leader?.username === username ? 'Bạn đang dẫn đầu' : mine ? 'Bạn đã bị vượt giá' : upcoming ? 'Sắp bắt đầu' : 'Chưa đặt giá'}</strong></div>
            {needsJoin ? <form onSubmit={join} className="room-join-form">{selected?.access === 'PRIVATE' && <label>Mã phòng<input type="password" required maxLength={50} value={roomCode} onChange={event => setRoomCode(event.target.value)} /></label>}<button className="room-primary" disabled={api.busy || api.stale}>Tham gia phiên</button></form> : <form onSubmit={submitBid} className="room-bid-form" noValidate>
              <label htmlFor="normal-bid-amount">Giá đặt (Coin)</label><div className="room-bid-entry"><input id="normal-bid-amount" type="number" inputMode="numeric" min={minimum} step="1" value={amount} placeholder={String(minimum)} onChange={event => { setAmount(event.target.value); setFeedback(''); }} disabled={!accepting} /><button className="room-primary" type="submit" disabled={!accepting}>{api.busy ? 'Đang gửi…' : 'Đặt giá'}</button></div>
              <div className="room-quick-bids">{[0, 1, 2].map(step => <button key={step} type="button" disabled={!accepting || !Number.isSafeInteger(minimum + step * (auction?.increment ?? 0))} onClick={() => { setAmount(String(minimum + step * (auction?.increment ?? 0))); setFeedback(''); }}><span>{['Giá tối thiểu', '+1 bước', '+2 bước'][step]}</span><b>{coin(minimum + step * (auction?.increment ?? 0))}</b></button>)}</div>
              {(api.me?.role === 'ADMIN' || api.stale || upcoming || running && auction && now >= auction.endsAt) && <p className="room-bid-hint">{api.me?.role === 'ADMIN' ? 'Quản trị viên chỉ xem phiên' : api.stale ? 'Đang đồng bộ dữ liệu…' : upcoming ? 'Chờ giờ bắt đầu' : 'Chờ server chốt kết quả'}</p>}
            </form>}
          </>}
          <div className="room-feedback" aria-live="polite" aria-atomic="true">{(api.error || feedback) && <p className={api.error ? 'error' : ''}>{api.error || feedback}{api.error && <button type="button" disabled={api.busy} onClick={() => void api.refresh()}>Tải lại</button>}</p>}</div>
          <details className="room-rules"><summary>Luật phiên</summary><p>Phiên chia làm nhịp đầu và nhịp cuối. Giá và quyền trả được giữ nguyên khi chuyển nhịp. Ở nhịp cuối, bid trong {timing.closingWindowSeconds}s cuối sẽ gia hạn để còn {timing.extensionSeconds}s trả giá. Vào phòng cần tối thiểu 50% giá khởi điểm; giá được chấp nhận sẽ khóa Coin.</p></details>
        </section>

        <section className="room-data-panel" aria-label="Diễn biến đấu giá">
          <div className="room-data-tabs" role="group" aria-label="Chọn dữ liệu"><button type="button" aria-pressed={dataView === 'chart'} aria-controls="room-chart-panel" onClick={() => setDataView('chart')}>Biểu đồ giá</button><button type="button" aria-pressed={dataView === 'ranking'} aria-controls="room-ranking-panel" onClick={() => setDataView('ranking')}>Xếp hạng</button><button type="button" aria-pressed={dataView === 'history'} aria-controls="room-history-panel" onClick={() => setDataView('history')}>Lượt trả <span>{auction?.bids.length ?? 0}</span></button></div>
        <div className="room-chart-panel" id="room-chart-panel" hidden={dataView !== 'chart'}>{auction ? <PriceTimelineChart key={auction.id} auction={auction} serverTime={finished ? auction.endsAt : now} username={username} stale={api.stale} connected={realtime.state === 'connected'} visible={dataView === 'chart'} fullscreenSignal={chartFullscreenSignal} /> : <p className="room-empty">{needsJoin ? 'Tham gia phòng để xem biểu đồ' : 'Đang tải giá…'}</p>}</div>
        <section className={`room-board ${closingBoard ? 'room-board-closing' : ''} ${events.summary !== null ? 'room-board-summary' : ''}`} id="room-ranking-panel" hidden={dataView !== 'ranking'} aria-labelledby="room-board-title">
          <div className="room-section-heading"><h2 id="room-board-title">{finished ? 'Kết quả' : board === 'live' ? closingBoard ? 'Chốt giá' : 'Đang diễn ra' : `Kết nhịp ${board + 1}`}</h2><span>{boardRows.length} người</span></div>
          <div className="room-board-tabs" role="group" aria-label="Chọn bảng xếp hạng"><button type="button" aria-pressed={board === 'live'} onClick={() => { setBoard('live'); events.closeSummary(); }}>Live</button>{rhythmNames.map((name, index) => <button key={name} type="button" disabled={!finished && (!rhythm || now < rhythm.boundaries[index])} aria-pressed={board === index} onClick={() => { events.closeSummary(); setBoard(index); }}>Nhịp {index + 1}</button>)}</div>
          <div className="room-boundary-note" role="status" data-active={events.summary !== null}>{events.summary !== null && <>Kết nhịp {events.summary + 1} · Đang ở nhịp {events.summary + 2}<button type="button" onClick={() => { events.closeSummary(); setBoard('live'); }}>Về live</button></>}</div>
          <div className="room-board-scroll" tabIndex={0} role="region" aria-label="Cuộn bảng xếp hạng">{boardRows.length ? <table aria-label="Bảng xếp hạng trả giá"><thead><tr><th scope="col">#</th><th scope="col">Người chơi</th><th scope="col">Giá cao nhất</th></tr></thead><tbody>{boardRows.map((bid, index) => <tr key={bid.username} className={`${index === 0 ? 'first' : ''} ${board === 'live' && bid.id === events.lastBid ? 'room-row-new' : ''}`}><td>{index + 1}</td><td>{bid.username}{bid.username === username && <small> · bạn</small>}{index === 0 && <span className="room-rank-label">{finished && board === 'live' ? auction?.status === 'SOLD' && bid.username === auction.winner ? 'Thắng' : 'Kết thúc' : board === 'live' ? 'Dẫn đầu' : 'Dẫn nhịp'}</span>}</td><td>{coin(bid.amount)}</td></tr>)}</tbody></table> : <p className="room-empty">Chưa có lượt trả giá</p>}</div>
        </section>
        <section className="room-activity" id="room-history-panel" hidden={dataView !== 'history'} aria-label="Lịch sử trả giá"><div className="room-activity-scroll" tabIndex={0} role="region" aria-label="Cuộn lịch sử trả giá">{auction?.bids.length ? <table aria-label="Lịch sử trả giá"><thead><tr><th scope="col">Người chơi</th><th scope="col">Giá</th><th scope="col">Lúc</th></tr></thead><tbody>{[...auction.bids].reverse().map(bid => <tr key={bid.id} className={events.lastBid === bid.id ? 'room-row-new' : ''}><td>{bid.username === username ? 'Bạn' : bid.username}</td><td>{coin(bid.amount)}</td><td>{new Date(bid.createdAt).toLocaleTimeString('vi-VN')}</td></tr>)}</tbody></table> : <p className="room-empty">Chưa có lượt trả giá</p>}</div></section>
        </section>
      </div>

      <aside className="room-chat" id="normal-room-chat" hidden={!chatOpen} aria-labelledby="normal-chat-title" onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); collapseChat(); } }}><div className="room-section-heading"><h2 id="normal-chat-title">Chat phòng</h2><span className={realtime.state === 'connected' ? 'connected' : ''}>{finished ? 'Đã đóng' : realtime.state === 'connected' ? 'Trực tuyến' : 'Đang kết nối'}</span><button type="button" className="room-chat-collapse" ref={chatClose} aria-label="Thu gọn chat" title="Thu gọn chat" onClick={collapseChat}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M5 12h14"/></svg></button></div>
        <div className="room-chat-scroll" ref={chatList} role="log" aria-label="Tin nhắn trong phòng" aria-live="polite" onScroll={event => { const element = event.currentTarget; stickChat.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80; }}>{realtime.messages.length ? realtime.messages.map(message => <div key={message.messageId} className={`room-chat-message ${message.username === username ? 'mine' : ''}`}><div><strong>{message.username === username ? 'Bạn' : message.username}</strong><time>{new Date(message.sentAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</time></div><p>{message.content}</p></div>) : <p className="room-empty">{finished ? 'Phiên đã kết thúc' : 'Chưa có tin nhắn'}</p>}</div>
        {realtime.state === 'room-code-required' && <form className="room-chat-reconnect" onSubmit={event => { event.preventDefault(); setSocketCode(roomCode.trim()); setRoomCode(''); }}><input aria-label="Mã phòng realtime" type="password" required maxLength={50} placeholder="Mã phòng để kết nối lại" value={roomCode} onChange={event => setRoomCode(event.target.value)} /><button className="room-primary">Kết nối</button></form>}
        {realtime.error && <p className="room-chat-error" role="alert">{realtime.error}</p>}
        <form className="room-chat-compose" onSubmit={event => { event.preventDefault(); if (realtime.sendChat(chat)) { setChat(''); stickChat.current = true; } }}><input aria-label="Tin nhắn" maxLength={500} value={chat} onChange={event => setChat(event.target.value)} placeholder="Nhắn trong phòng…" disabled={realtime.state !== 'connected' || realtime.sending} /><button className="room-primary" disabled={realtime.state !== 'connected' || realtime.sending || !chat.trim()} aria-label="Gửi tin nhắn">Gửi</button></form>
      </aside>
    </div>
    {showFinalRhythmReveal && <div className="room-rhythm-transition" role="status" aria-live="assertive"><div className="room-rhythm-transition-icon" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none"><path d="M12 40V8m1 2c9-6 15 6 24 0v18c-9 6-15-6-24 0" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M20 19h9m-3-3 3 3-3 3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg></div><small>ĐÃ VÀO</small><strong>NHỊP CUỐI</strong><span>Giá tiếp tục tăng đến khi hết giờ</span></div>}
    {auction?.status === 'SOLD' && auction.winner && auction.winningPrice !== undefined && <WinnerCelebration key={`${auction.id}-${username}`} winner={auction.winner} price={auction.winningPrice} product={auction.product.name} username={username} openSignal={winnerReplay} onViewResult={() => { setDataView('chart'); setChartFullscreenSignal(value => value + 1); }} />}
    <aside className="room-toasts" aria-live="polite" aria-label="Thông báo đấu giá">{events.notices.map(notice => <div key={notice.id} className={notice.warning ? 'warning' : ''}><span>{notice.text}</span><button type="button" aria-label="Đóng thông báo" onClick={() => events.dismiss(notice.id)}>×</button></div>)}</aside>
  </main>;
}
