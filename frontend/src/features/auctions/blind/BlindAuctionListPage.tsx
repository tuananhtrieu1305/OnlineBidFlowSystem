import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import client from '../../../api/axiosClient';
import { useAuth } from '../../auth/AuthProvider';
import ProductImage from '../../normal/ProductImage';
import '../../normal/normal.css';

const statuses = { ALL: 'Tất cả', RUNNING: 'Đang diễn ra', UPCOMING: 'Sắp bắt đầu', SOLD: 'Đã bán', UNSOLD: 'Chưa bán' };
type Status = keyof typeof statuses;
type Auction = {
  id: number;
  product: { name: string; description: string | null; quantity: number; imageUrl: string | null };
  access: 'PUBLIC' | 'PRIVATE';
  status: Exclude<Status, 'ALL'>;
  startsAt: string;
  endsAt: string;
  joined: boolean;
  participantCount: number;
};
const date = (value: string) => new Date(value).toLocaleString('vi-VN');
function countdown(end: string, now: number) {
  const seconds = Math.max(0, Math.ceil((Date.parse(end) - now) / 1000));
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(value => String(value).padStart(2, '0')).join(':');
}

export default function BlindAuctionListPage() {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [items, setItems] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<Status>('ALL');
  const [access, setAccess] = useState<'ALL' | Auction['access']>('ALL');
  const [search, setSearch] = useState('');
  const [now, setNow] = useState(Date.now);
  const [privateRoom, setPrivateRoom] = useState<Auction | null>(null);
  const [code, setCode] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (auth.user?.role !== 'USER') return;
    const controller = new AbortController();
    async function load() {
      try {
        const response = await client.get<Auction[]>('/api/blind/auctions', { signal: controller.signal });
        if (!controller.signal.aborted) { setItems(response.data); setError(''); }
      } catch {
        if (!controller.signal.aborted) setError('Chưa tải được danh sách phiên BLIND. Kiểm tra kết nối và thử lại.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [auth.user?.id, auth.user?.role]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { if (privateRoom) dialog.current?.showModal(); else dialog.current?.close(); }, [privateRoom]);

  function choose(item: Auction) {
    if (item.status === 'SOLD' || item.status === 'UNSOLD') {
      navigate(`/auctions/${item.id}/replay`);
    } else if (item.access === 'PRIVATE') {
      setCode(''); setPrivateRoom(item);
    } else {
      navigate(`/blind/${item.id}`);
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (privateRoom && code.trim()) navigate(`/blind/${privateRoom.id}`, { state: { roomCode: code.trim() } });
  }
  const filtered = items.filter(item => (status === 'ALL' || item.status === status) && (access === 'ALL' || item.access === access)
    && `${item.product.name} ${item.product.description ?? ''}`.toLocaleLowerCase('vi-VN').includes(search.trim().toLocaleLowerCase('vi-VN')));

  if (auth.loading) return <main id="main-content" className="guest-home"><p role="status">Đang kiểm tra phiên đăng nhập…</p></main>;
  if (!auth.user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (auth.user.role !== 'USER') return <Navigate to="/admin" replace />;
  return <main id="main-content" tabIndex={-1} className="normal-page normal-catalog blind-catalog">
    <header><p className="normal-eyebrow">BLIND AUCTION</p><h1>Đấu giá kín</h1><p>Chọn phiên để vào phòng đấu giá. Phòng riêng tư cần mã truy cập.</p></header>
    <div className="normal-status-tabs" role="group" aria-label="Trạng thái phiên">
      {(Object.keys(statuses) as Status[]).map(value => <button key={value} type="button" aria-pressed={status === value} onClick={() => setStatus(value)}>{statuses[value]}</button>)}
    </div>
    <div className="normal-catalog-tools">
      <div className="normal-access-filters" role="group" aria-label="Loại truy cập"><span>Loại truy cập</span>
        {(['ALL', 'PUBLIC', 'PRIVATE'] as const).map(value => <button key={value} type="button" aria-pressed={access === value} onClick={() => setAccess(value)}>{value === 'ALL' ? 'Tất cả' : value}</button>)}
      </div>
      <input type="search" aria-label="Tìm kiếm sản phẩm" placeholder="Tìm kiếm sản phẩm…" value={search} onChange={event => setSearch(event.target.value)} />
    </div>
    <div aria-live="polite">{error && <p className="normal-catalog-error" role="alert">{error}</p>}</div>
    {loading ? <p role="status">Đang tải phiên đấu giá kín…</p> : <>
      <p className="normal-results-count">{filtered.length} phiên đấu giá</p>
      {!filtered.length && <p className="normal-catalog-empty">Không có phiên phù hợp với bộ lọc hiện tại.</p>}
      <div className="normal-catalog-grid">{filtered.map(item => {
        const finished = item.status === 'SOLD' || item.status === 'UNSOLD';
        const full = item.participantCount >= 4 && !item.joined;
        const canOpen = finished ? item.joined : item.status === 'RUNNING' ? item.joined : !full;
        const action = finished ? item.joined ? 'Xem kết quả' : 'Chỉ người tham gia xem kết quả'
          : item.status === 'RUNNING' && !item.joined ? 'Phiên đã bắt đầu' : full ? 'Phòng đã đủ 4 người' : 'Vào phòng';
        return <article key={item.id} className="normal-auction-card" aria-label={`Phiên #${item.id} · ${item.product.name}`}>
          <div className="normal-card-badges"><span>BLIND</span><span className={item.access === 'PRIVATE' ? 'private' : 'public'}>{item.access === 'PRIVATE' ? '▣ ' : ''}{item.access}</span><small>#{item.id}</small></div>
          <ProductImage product={{ ...item.product, description: item.product.description ?? '' }} />
          <h2>{item.product.name}</h2><p className="normal-card-description">{item.product.description || 'Chưa có mô tả sản phẩm.'}</p>
          <div className={`normal-card-status ${item.status.toLowerCase()}`}><strong>{statuses[item.status]}</strong>{item.status === 'RUNNING' && <time aria-label="Thời gian còn lại">{countdown(item.endsAt, now)}</time>}</div>
          <dl className="normal-card-facts"><div><dt>{item.status === 'UPCOMING' ? 'Bắt đầu' : 'Kết thúc'}</dt><dd>{date(item.status === 'UPCOMING' ? item.startsAt : item.endsAt)}</dd></div><div><dt>Vị trí</dt><dd>{item.participantCount}/4</dd></div></dl>
          <button type="button" className="normal-enter-button" disabled={!canOpen} onClick={() => choose(item)}>{action}</button>
        </article>;
      })}</div>
    </>}
    <dialog ref={dialog} className="normal-code-dialog" aria-labelledby="blind-private-room-title" onCancel={() => setPrivateRoom(null)}>
      <form onSubmit={submit}><h2 id="blind-private-room-title">Vào phòng riêng tư #{privateRoom?.id}</h2><p>{privateRoom?.product.name}</p><label htmlFor="blind-catalog-room-code">Mã phòng</label><input id="blind-catalog-room-code" type="password" autoComplete="off" autoFocus required maxLength={50} value={code} onChange={event => setCode(event.target.value)} />
        <div className="normal-dialog-actions"><button type="button" onClick={() => setPrivateRoom(null)}>Hủy</button><button className="normal-enter-button" type="submit">Tham gia phiên</button></div>
      </form>
    </dialog>
  </main>;
}
