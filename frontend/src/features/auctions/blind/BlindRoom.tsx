import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { serverConfig } from '../../../api/axiosClient';
import { useAuth } from '../../auth/AuthProvider';
import { imageSource } from '../../products/productApi';
import { getWallet, type Wallet } from '../../wallet/walletApi';
import { buyClue, cancelClue, getBlindState, listClue, submitBlindBid, type BlindState, type Clue, type Listing } from './blindApi';
import '../../normal/normal-room.css';
import '../../normal/normal.css';
import './blind.css';

type Chat = { messageId: number; userId: number; username: string; content: string; sentAt: string };
type Event = { type: string; payload: any };
type DataView = 'clues' | 'market' | 'history';
const coin = (value: string | number | null | undefined) => value == null ? '—' : new Intl.NumberFormat('vi-VN').format(BigInt(value)) + ' Coin';
const clock = (seconds: number) => [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(value => String(value).padStart(2, '0')).join(':');
const reason = (error: unknown) => axios.isAxiosError(error) ? error.response?.data?.code ?? 'NETWORK_ERROR' : 'NETWORK_ERROR';
const descriptions: Record<string, string> = {
 NOT_IN_ROOM: 'Bạn cần tham gia phòng trước.', ROOM_CODE_REQUIRED: 'Nhập mã phòng riêng.', ROOM_CODE_INVALID: 'Mã phòng không đúng.',
 ROOM_FULL: 'Phòng đã đủ 4 người.', AUCTION_NOT_JOINABLE: 'Phiên đã đóng.', CLUE_MARKET_CLOSED: 'Thời gian mua bán Clue đã kết thúc.',
 LISTING_CHANGED: 'Giá hoặc trạng thái Clue đã thay đổi. Hãy xem lại trước khi mua.', CLUE_ALREADY_KNOWN: 'Bạn đã biết Clue này.',
 INSUFFICIENT_COIN: 'Coin khả dụng không đủ.', BID_WINDOW_CLOSED: 'Thời gian tạo và sửa bid đã kết thúc.',
 NETWORK_ERROR: 'Chưa xác định kết quả. Hãy kiểm tra Clue, bid và ví trước khi gửi lại.'
};
const explain = (code: string) => descriptions[code] ?? 'Thao tác chưa thành công (' + code + '). Hãy kiểm tra trạng thái mới nhất.';

export function PrivateBlindEntry() {
 const [id, setId] = useState(''); const navigate = useNavigate(); const { user } = useAuth();
 return <main className="guest-home normal-catalog blind-entry" id="main-content" tabIndex={-1}>
  <header><p className="normal-eyebrow">ĐẤU GIÁ KÍN</p><h1>Vào phòng BLIND</h1><p>Nhập mã phiên được chia sẻ để mở phòng. Mã phòng riêng sẽ nhập ở bước tiếp theo.</p></header>
  <section className="blind-entry-card"><span className="blind-entry-step">01 / THAM GIA</span><h2>Tìm phiên đấu giá</h2>
   <form onSubmit={event => { event.preventDefault(); if (/^[1-9][0-9]{0,18}$/.test(id)) navigate('/blind/' + id); }}>
    <label htmlFor="blind-auction-id">Mã phiên</label><div><input id="blind-auction-id" inputMode="numeric" pattern="[1-9][0-9]*" required value={id} onChange={event => setId(event.target.value)} placeholder="Ví dụ: 12"/><button className="normal-enter-button">Tiếp tục</button></div>
   </form>
   {!user && <p><Link to="/login">Đăng nhập</Link> để tham gia phiên.</p>}
  </section>
 </main>;
}

export default function BlindRoom() {
 const { id } = useParams(); const { user, loading } = useAuth();
 const [roomCode, setRoomCode] = useState(''), [attempt, setAttempt] = useState(0);
 const [joined, setJoined] = useState(false), [connected, setConnected] = useState(false), [state, setState] = useState<BlindState | null>(null);
 const [chat, setChat] = useState<Chat[]>([]), [chatText, setChatText] = useState(''), [chatOpen, setChatOpen] = useState(false), [unread, setUnread] = useState(0);
 const [dataView, setDataView] = useState<DataView>('clues'), [error, setError] = useState(''), [notice, setNotice] = useState('');
 const [busy, setBusy] = useState(false), [bid, setBid] = useState(''), [seconds, setSeconds] = useState(Date.now()), [clockOffset, setClockOffset] = useState(0);
 const [wallet, setWallet] = useState<Wallet | null>(null), [revealReady, setRevealReady] = useState(false);
 const socket = useRef<WebSocket | null>(null), seenReveal = useRef(false), seenChat = useRef(new Set<number>()), chatOpenRef = useRef(false);
 const chatToggle = useRef<HTMLButtonElement>(null), chatClose = useRef<HTMLButtonElement>(null), chatList = useRef<HTMLDivElement>(null);
 const validId = !!id && /^[1-9][0-9]{0,18}$/.test(id) && Number.isSafeInteger(Number(id));
 const refresh = useCallback(async () => { if (!id) return; try { const next = await getBlindState(id); setClockOffset(Date.parse(next.serverNow) - Date.now()); setState(next); void getWallet().then(setWallet).catch(() => {}); } catch (err) { setError(explain(reason(err))); } }, [id]);

 useEffect(() => { chatOpenRef.current = chatOpen; if (chatOpen) setUnread(0); }, [chatOpen]);
 useEffect(() => { if (chatOpen) chatClose.current?.focus(); }, [chatOpen]);
 useEffect(() => { if (chatOpen && chatList.current) chatList.current.scrollTop = chatList.current.scrollHeight; }, [chatOpen, chat]);
 useEffect(() => {
  if (!validId || !user || user.role !== 'USER') return;
  let disposed = false, retry: ReturnType<typeof setTimeout> | null = null;
  const connect = () => {
   if (disposed) return;
   const url = new URL(serverConfig.apiUrl);
   const ws = new WebSocket((url.protocol === 'https:' ? 'wss://' : 'ws://') + url.host + '/ws/auction'); socket.current = ws;
   ws.onopen = () => { if (disposed) return; setConnected(true); ws.send(JSON.stringify({ type: 'JOIN_ROOM', requestId: crypto.randomUUID(), payload: { auctionId: Number(id), roomCode: roomCode.trim() || null } })); };
   ws.onmessage = message => {
    if (disposed) return; let event: Event; try { event = JSON.parse(message.data) as Event; } catch { return; }
    if (event.type === 'AUCTION_STATE') {
     const history = (event.payload?.chatHistory ?? []) as Chat[];
     seenChat.current = new Set(history.map(item => item.messageId)); setChat(history); setJoined(true); setError(''); void refresh();
    } else if (event.type === 'CHAT_MESSAGE') {
     const item = event.payload as Chat; if (seenChat.current.has(item.messageId)) return;
     seenChat.current.add(item.messageId); setChat(old => [...old, item].slice(-100));
     if (!chatOpenRef.current && item.username !== user.username) setUnread(value => value + 1);
    } else if (event.type === 'ERROR') setError(explain(event.payload?.code ?? 'INVALID_MESSAGE'));
    else if (['AUCTION_FINISHED', 'BLIND_BID_ACCEPTED', 'USER_JOINED', 'USER_LEFT'].includes(event.type)) void refresh();
   };
   ws.onclose = () => { if (disposed) return; setConnected(false); setJoined(false); retry = setTimeout(connect, 3000); };
   ws.onerror = () => setConnected(false);
  };
  connect(); return () => { disposed = true; if (retry) clearTimeout(retry); socket.current?.close(); socket.current = null; setConnected(false); setJoined(false); };
 }, [validId, id, user?.id, user?.role, attempt, refresh]);
 useEffect(() => { if (!joined) return; const timer = setInterval(() => void refresh(), 2000); return () => clearInterval(timer); }, [joined, refresh]);
 useEffect(() => { const timer = setInterval(() => setSeconds(Date.now()), 250); return () => clearInterval(timer); }, []);
 useEffect(() => { if (state?.ownBid?.amount) setBid(state.ownBid.amount); }, [state?.ownBid?.amount]);
 useEffect(() => { if (!state) return; if (state.phase !== 'REVEAL' || seenReveal.current) { setRevealReady(true); return; }
  setRevealReady(false); const timer = setTimeout(() => { seenReveal.current = true; setRevealReady(true); }, 3000); return () => clearTimeout(timer); }, [state?.phase]);

 if (loading) return <main className="normal-room blind-room room-loading"><p role="status">Đang kiểm tra phiên…</p></main>;
 if (!user) return <Navigate to="/login" replace/>;
 if (user.role !== 'USER') return <Navigate to="/admin" replace/>;
 if (!validId) return <main className="normal-room blind-room room-loading"><p role="alert">Mã phiên không hợp lệ. <Link to="/blind">Nhập lại mã phiên</Link></p></main>;

 const untilScheduled = state?.phase === 'WAITING' && state.scheduledStartAt && Date.parse(state.scheduledStartAt) > seconds + clockOffset;
 const target = state?.phase === 'WAITING' ? (untilScheduled ? state.scheduledStartAt : state.lobbyClosesAt) : state?.phase === 'REVEAL' ? state.revealEndsAt : state?.phase === 'TRADE' ? state.tradeEndsAt : state?.phase === 'DISCUSS' ? state.bidStartsAt : state?.phase === 'BID' ? state.bidLocksAt : state?.endsAt;
 const remaining = target ? Math.max(0, Math.ceil((Date.parse(target) - seconds - clockOffset) / 1000)) : 0;
 const trade = state?.phase === 'TRADE', canBid = state?.phase === 'BID', finished = state?.phase === 'FINISHED';
 const phaseLabel: Record<BlindState['phase'], string> = { WAITING: state?.participantCount === 4 ? 'Chờ bắt đầu' : 'Chờ đủ 4 người', REVEAL: 'Mở Clue', TRADE: 'Mua bán Clue', DISCUSS: 'Thảo luận', BID: 'Đặt bid kín', LOCKED: 'Khóa bid', SETTLING: 'Chốt kết quả', FINISHED: 'Đã kết thúc' };
 const phase = state ? phaseLabel[state.phase] : 'Đang kết nối';
 const owned = new Set(state?.ownedClues.map(clue => clue.id) ?? []);
 const productPhoto = state ? imageSource(state.product.image_url) : null;
 const availableListings = state?.listings.filter(listing => listing.sellerId !== String(user.id) && !owned.has(listing.clueId)) ?? [];

 async function act(work: () => Promise<unknown>, success: string) {
  if (busy) return; setBusy(true); setError(''); setNotice('');
  try { await work(); setNotice(success); await refresh(); } catch (err) { setError(explain(reason(err))); await refresh(); } finally { setBusy(false); }
 }
 function sendChat(event: FormEvent) {
  event.preventDefault(); const content = chatText.trim(); if (!content || !joined || socket.current?.readyState !== WebSocket.OPEN) return;
  socket.current.send(JSON.stringify({ type: 'SEND_CHAT_MESSAGE', requestId: crypto.randomUUID(), payload: { auctionId: Number(id), content } })); setChatText('');
 }
 function collapseChat() { setChatOpen(false); chatToggle.current?.focus(); }

 return <main className="normal-room blind-room" id="main-content" tabIndex={-1}>
  <header className="room-header" data-finished={finished}>
   <div className="room-identity"><small>Phiên #{id} · Đấu giá kín · {phase}</small><h1>{state?.product.name ?? 'Phòng đấu giá BLIND'}</h1></div>
   <section className="room-header-timing" aria-label="Tiến trình phiên"><div className="room-rhythm-clock"><small>{state?.phase === 'WAITING' ? untilScheduled ? 'Đến giờ theo lịch' : 'Hạn chờ bắt đầu' : state ? phase : 'Đang tải phòng'}</small><strong role={finished ? undefined : 'timer'} aria-label="Thời gian giai đoạn còn lại">{finished ? 'ĐÃ KẾT THÚC' : clock(remaining)}</strong></div></section>
   <div className="room-header-account"><div className="room-account"><span className="room-avatar" aria-hidden="true">{user.username.slice(0, 1).toUpperCase()}</span><strong title={user.username}>{user.username}</strong></div><div className="room-wallet"><div><small>Khả dụng</small><strong title={coin(wallet?.availableBalance)}>{coin(wallet?.availableBalance)}</strong></div><div><small>Đang khóa</small><strong title={coin(wallet?.lockedBalance)}>{coin(wallet?.lockedBalance)}</strong></div></div></div>
   <button type="button" ref={chatToggle} className="room-chat-toggle" aria-controls="blind-room-chat" aria-expanded={chatOpen} aria-label={chatOpen ? 'Thu gọn chat' : unread ? `Mở chat, ${unread} tin nhắn mới` : 'Mở chat'} disabled={!joined} onClick={() => chatOpen ? collapseChat() : setChatOpen(true)}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M20 11.5a8 8 0 0 1-8 8H5l-3 3v-11a9 9 0 0 1 18 0Z"/><path d="M7 10h8M7 14h5"/></svg><span>Chat</span>{unread > 0 && <b className="room-chat-unread" aria-hidden="true">{Math.min(unread, 99)}</b>}</button>
   <Link className="room-exit" to="/blind" aria-label="Thoát phòng" title="Thoát phòng"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></Link>
  </header>

  {!joined ? <div className="blind-room-entry"><section className="blind-entry-card"><span className="blind-entry-step">PHIÊN #{id} · ĐẤU GIÁ KÍN</span><h2>Tham gia phòng</h2><p>Phòng có 4 vị trí. Clue được phân khi phiên bắt đầu.</p><form onSubmit={event => { event.preventDefault(); setAttempt(value => value + 1); }}><label htmlFor="blind-room-code">Mã phòng riêng <small>(để trống nếu công khai)</small></label><div><input id="blind-room-code" type="password" maxLength={50} value={roomCode} onChange={event => setRoomCode(event.target.value)}/><button className="room-primary">Tham gia</button></div></form></section></div>
   : !state ? <div className="blind-room-entry"><p role="status">Đang tải dữ liệu phòng…</p></div>
   : <div className="room-body">
    <section className="room-product-column" aria-label="Ảnh và thông tin sản phẩm"><div className="room-product-visual">{productPhoto ? <img className="normal-product-image" src={productPhoto} alt={state.product.name}/> : <div className="normal-placeholder" aria-label="Chưa có ảnh sản phẩm">◇<span>Chưa có ảnh sản phẩm</span></div>}</div><div className="room-product-details"><h2>Thông tin sản phẩm</h2><p title={state.product.description ?? ''}>{state.product.description || 'Chưa có mô tả sản phẩm.'}</p><div className="room-product-chips"><span>{state.onlineCount}/4 đang kết nối</span><span>{state.participantCount}/4 vị trí đã giữ</span><span>Giá sàn được giữ kín</span></div></div></section>
    <div className="room-main-column">
     <section className="room-bidding blind-bidding" aria-label="Đặt giá kín" tabIndex={0}>
      <div className="room-price-row"><div><small>Bid đã xác nhận của bạn</small><strong>{state.ownBid ? coin(state.ownBid.amount) : 'Chưa đặt bid'}</strong></div><div className="room-leader"><small>Coin đang khóa</small><b>{coin(wallet?.lockedBalance)}</b></div></div>
      <div className="room-position"><strong>{phase}</strong><span>{state.ownBid ? `Xác nhận lúc ${new Date(state.ownBid.at).toLocaleTimeString('vi-VN')}` : 'Bid của người khác không hiển thị'}</span></div>
      {canBid ? <form className="room-bid-form" onSubmit={event => { event.preventDefault(); if (!/^[1-9][0-9]{0,18}$/.test(bid)) return; const message = state.ownBid ? 'Sửa bid sẽ cập nhật thời điểm phá hòa. Xác nhận?' : 'Bid bí mật chỉ bạn nhìn thấy. Xác nhận?'; if (window.confirm(message)) void act(() => submitBlindBid(id!, bid), 'Server đã xác nhận bid của bạn.'); }}><label htmlFor="blind-bid-amount">Giá đặt (Coin)</label><div className="room-bid-entry"><input id="blind-bid-amount" value={bid} onChange={event => setBid(event.target.value)} inputMode="numeric" placeholder="Nhập số Coin"/><button className="room-primary" disabled={busy || !/^[1-9][0-9]{0,18}$/.test(bid)}>{busy ? 'Đang gửi…' : state.ownBid ? 'Sửa bid' : 'Đặt bid kín'}</button></div><p className="room-bid-hint">Có thể sửa đến trước 20 giây khóa bid cuối phiên.</p></form>
       : finished ? <div className="room-result" role="status"><strong>{state.result?.status === 'SOLD' ? state.result.winnerUserId === String(user.id) ? 'Bạn đã thắng phiên đấu giá!' : 'Phiên đã bán thành công' : 'Phiên chưa bán được sản phẩm'}</strong><span>{state.result?.status === 'SOLD' ? `Giá thắng: ${coin(state.result.winningPrice)}` : 'Không có bid đạt giá sàn.'}</span><Link className="blind-replay-link" to={'/auctions/' + id + '/replay'}>Xem diễn biến phiên →</Link></div>
       : <p className="room-bid-hint blind-phase-hint">{state.phase === 'LOCKED' ? '20 giây cuối: bid đã khóa, không thể tạo hoặc sửa.' : state.phase === 'SETTLING' ? 'Đang chờ server xác định kết quả.' : state.phase === 'WAITING' ? 'Phòng đang chờ đủ điều kiện bắt đầu.' : 'Khu vực đặt giá mở sau giai đoạn thảo luận.'}</p>}
      <details className="room-rules"><summary>Luật phiên</summary><p>Mỗi người nhận một Clue riêng. Clue có thể được mua bán trong giai đoạn trao đổi. Bid kín chỉ bạn nhìn thấy và có thể sửa trong giai đoạn đặt giá. Bid cuối được xác nhận của mỗi người dùng để xếp hạng; 20 giây cuối không nhận bid.</p></details>
     </section>

     <section className="room-data-panel blind-data-panel" aria-label="Thông tin đấu giá"><div className="room-data-tabs" role="group" aria-label="Chọn dữ liệu"><button type="button" aria-pressed={dataView === 'clues'} aria-controls="blind-clues-panel" onClick={() => setDataView('clues')}>Manh mối <span>{state.ownedClues.length}</span></button><button type="button" aria-pressed={dataView === 'market'} aria-controls="blind-market-panel" onClick={() => setDataView('market')}>Chợ Clue <span>{trade ? availableListings.length : 0}</span></button><button type="button" aria-pressed={dataView === 'history'} aria-controls="blind-history-panel" onClick={() => setDataView('history')}>Giá lịch sử</button></div>
      <div className="blind-data-content" id="blind-clues-panel" hidden={dataView !== 'clues'} tabIndex={0} role="region" aria-label="Manh mối của bạn"><div className="room-section-heading"><h2>Thông tin riêng</h2><span>{state.ownedClues.length} Clue đã biết</span></div>{state.phase === 'REVEAL' && !revealReady ? <div className="blind-clue-wait" role="status"><p>Đang mở Clue của bạn…</p><div className="blind-reel" aria-hidden="true"><span>?</span><span>?</span><span>◆</span><span>?</span><span>?</span></div></div> : !state.ownedClues.length ? <p className="room-empty">Clue sẽ xuất hiện khi phiên bắt đầu.</p> : <div className="blind-clues">{state.ownedClues.map((clue: Clue) => <article className={state.phase === 'REVEAL' ? 'blind-clue blind-reveal' : 'blind-clue'} key={clue.id}><small>CLUE #{clue.slot} <span>✓ ĐÃ XÁC THỰC</span></small><p>{clue.content}</p>{trade && <ClueSeller id={id!} clue={clue} busy={busy} listing={state.listings.find(listing => listing.clueId === clue.id && listing.sellerId === String(user.id))} act={act}/>}</article>)}</div>}</div>
      <div className="blind-data-content" id="blind-market-panel" hidden={dataView !== 'market'} tabIndex={0} role="region" aria-label="Chợ Clue"><div className="room-section-heading"><h2>Thị trường Clue</h2><span>{trade ? `${availableListings.length} tin bán` : 'Đã đóng'}</span></div><p className="blind-data-help">{trade ? 'Mua quyền xem Clue từ người khác. Người bán vẫn giữ Clue; giao dịch không hoàn Coin.' : state.phase === 'WAITING' || state.phase === 'REVEAL' ? 'Mở sau khi kết thúc quay Clue.' : state.phase === 'DISCUSS' ? 'Đã đóng. Còn thời gian thảo luận trước khi bid.' : 'Giao dịch Clue đã đóng.'}</p>{trade && (availableListings.length ? <div className="blind-listings">{availableListings.map((listing: Listing) => <article key={listing.id}><div><strong>Clue #{listing.slot}</strong><span>Người bán: {listing.seller}</span></div><b>{coin(listing.price)}</b><button type="button" disabled={busy} onClick={() => { if (window.confirm(`Mua Clue #${listing.slot} của ${listing.seller} với ${coin(listing.price)}? Giao dịch không hoàn tiền.`)) void act(() => buyClue(id!, listing.id, listing.version), 'Đã mua Clue. Nội dung đã được mở.'); }}>Mua Clue</button></article>)}</div> : <p className="room-empty">Chưa có Clue mới để mua.</p>)}</div>
      <div className="blind-data-content" id="blind-history-panel" hidden={dataView !== 'history'} tabIndex={0} role="region" aria-label="Giá lịch sử sản phẩm"><div className="room-section-heading"><h2>Giá lịch sử sản phẩm</h2><span>{state.historicalStats.soldCount} phiên đã bán</span></div>{Number(state.historicalStats.soldCount) > 0 ? <dl className="blind-stats"><div><dt>Phiên đã bán</dt><dd>{state.historicalStats.soldCount}</dd></div><div><dt>Giá trung bình</dt><dd>{coin(state.historicalStats.averagePrice)}</dd></div><div><dt>Thấp nhất</dt><dd>{coin(state.historicalStats.minimumPrice)}</dd></div><div><dt>Cao nhất</dt><dd>{coin(state.historicalStats.maximumPrice)}</dd></div></dl> : <p className="room-empty">Sản phẩm chưa có phiên bán thành công trước đây.</p>}</div>
     </section>
    </div>

    <aside className="room-chat" id="blind-room-chat" hidden={!chatOpen} aria-labelledby="blind-chat-title" onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); collapseChat(); } }}><div className="room-section-heading"><h2 id="blind-chat-title">Chat phòng</h2><span className={connected && joined ? 'connected' : ''}>{finished ? 'Đã đóng' : connected && joined ? 'Trực tuyến' : 'Đang kết nối'}</span><button type="button" className="room-chat-collapse" ref={chatClose} aria-label="Thu gọn chat" title="Thu gọn chat" onClick={collapseChat}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M5 12h14"/></svg></button></div><div className="room-chat-scroll" ref={chatList} role="log" aria-label="Tin nhắn trong phòng" aria-live="polite">{chat.length ? chat.map(message => <div className={`room-chat-message ${message.username === user.username ? 'mine' : ''}`} key={message.messageId}><div><strong>{message.username === user.username ? 'Bạn' : message.username}</strong><time>{new Date(message.sentAt).toLocaleTimeString('vi-VN')}</time></div><p>{message.content}</p></div>) : <p className="room-empty">{finished ? 'Phiên đã kết thúc' : 'Chưa có tin nhắn'}</p>}</div><form className="room-chat-compose" onSubmit={sendChat}><input aria-label="Tin nhắn trong phòng" value={chatText} onChange={event => setChatText(event.target.value)} maxLength={500} placeholder="Nhắn trong phòng…" disabled={!connected || !joined || finished}/><button className="room-primary" type="submit" disabled={!connected || !joined || finished || !chatText.trim()}>Gửi</button></form></aside>
   </div>}

  {(error || notice) && <aside className="room-toasts blind-toasts" aria-live="polite" aria-label="Thông báo phòng BLIND">{error && <div className="warning" role="alert"><span>{error}</span><button type="button" aria-label="Đóng lỗi" onClick={() => setError('')}>×</button></div>}{notice && <div role="status"><span>{notice}</span><button type="button" aria-label="Đóng thông báo" onClick={() => setNotice('')}>×</button></div>}</aside>}
 </main>;
}

function ClueSeller({ id, clue, busy, listing, act }: { id: string; clue: Clue; busy: boolean; listing: Listing | undefined; act: (work: () => Promise<unknown>, success: string) => Promise<void> }) {
 const [price, setPrice] = useState(listing?.price ?? '');
 useEffect(() => setPrice(listing?.price ?? ''), [listing?.price]);
 return <div className="blind-sell"><label>Giá bán Clue (Coin)<input inputMode="numeric" value={price} onChange={event => setPrice(event.target.value)} placeholder="Ví dụ: 50"/></label><button type="button" disabled={busy || !/^[1-9][0-9]{0,18}$/.test(price)} onClick={() => void act(() => listClue(id, clue.id, price), listing ? 'Đã cập nhật giá.' : 'Đã đăng bán Clue.')}>{listing ? 'Đổi giá' : 'Đăng bán'}</button>{listing && <button type="button" disabled={busy} onClick={() => void act(() => cancelClue(id, clue.id), 'Đã hủy niêm yết.')}>Hủy bán</button>}</div>;
}
