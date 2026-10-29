import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';
import { apiError, normalApi, type Summary } from '../features/normal/api';
import ProductImage from '../features/normal/ProductImage';
import '../features/normal/normal.css';

const statuses = { ALL: 'Tất cả', RUNNING: 'Đang diễn ra', UPCOMING: 'Sắp bắt đầu', SOLD: 'Đã bán', UNSOLD: 'Chưa bán' };
type Status = keyof typeof statuses;
const date = (time: number) => new Date(time).toLocaleString('vi-VN');
function countdown(end: number, now: number) {
  const seconds = Math.max(0, Math.ceil((end - now) / 1000));
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(value => String(value).padStart(2, '0')).join(':');
}

export default function NormalAuctionListPage() {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [items, setItems] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<Status>('ALL');
  const [access, setAccess] = useState('ALL');
  const [search, setSearch] = useState('');
  const [now, setNow] = useState(Date.now);
  const [privateRoom, setPrivateRoom] = useState<Summary | null>(null);
  const [code, setCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [busy, setBusy] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const action = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!auth.user) return;
    const controller = new AbortController();
    async function load() {
      try { const data = await normalApi.list(controller.signal); if (!controller.signal.aborted) { setItems(data); setError(''); } }
      catch (failure) { if (!controller.signal.aborted) setError(apiError(failure)); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [auth.user?.id]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { if (privateRoom) dialog.current?.showModal(); else dialog.current?.close(); }, [privateRoom]);

  async function enter(item: Summary, roomCode = '') {
    if (action.current) return;
    action.current = true; setBusy(item.id); setJoinError('');
    try {
      if (auth.user?.role === 'USER' && ['RUNNING', 'UPCOMING'].includes(item.status)) await normalApi.join(item.id, roomCode);
      if (mounted.current) navigate(`/normal/${item.id}`, { state: { roomCode } });
    } catch (failure) { if (mounted.current) setJoinError(apiError(failure)); }
    finally { action.current = false; if (mounted.current) setBusy(null); }
  }
  function choose(item: Summary) {
    setJoinError('');
    if (item.access === 'PRIVATE' && auth.user?.role === 'USER' && ['RUNNING', 'UPCOMING'].includes(item.status)) {
      setCode(''); setPrivateRoom(item);
    } else void enter(item);
  }
  function submit(event: FormEvent) { event.preventDefault(); if (privateRoom && code.trim()) void enter(privateRoom, code.trim()); }
  const filtered = items.filter(item => (status === 'ALL' || item.status === status) && (access === 'ALL' || item.access === access)
    && `${item.product.name} ${item.product.description}`.toLocaleLowerCase('vi-VN').includes(search.trim().toLocaleLowerCase('vi-VN')));
  if (auth.loading) return <main id="main-content" className="guest-home"><p role="status">Đang kiểm tra phiên đăng nhập…</p></main>;
  if (!auth.user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return <main id="main-content" tabIndex={-1} className="normal-page normal-catalog">
    <header><p className="normal-eyebrow">NORMAL AUCTION</p><h1>Đấu giá thường</h1><p>Chọn sản phẩm để vào phòng đấu giá. Phòng riêng tư cần mã truy cập.</p></header>
    <div className="normal-status-tabs" role="group" aria-label="Trạng thái phiên">
      {(Object.keys(statuses) as Status[]).map(value => <button key={value} type="button" aria-pressed={status === value} onClick={() => setStatus(value)}>{statuses[value]}</button>)}
    </div>
    <div className="normal-catalog-tools">
      <div className="normal-access-filters" role="group" aria-label="Loại truy cập"><span>Loại truy cập</span>
        {(['ALL', 'PUBLIC', 'PRIVATE'] as const).map(value => <button key={value} type="button" aria-pressed={access === value} onClick={() => setAccess(value)}>{value === 'ALL' ? 'Tất cả' : value}</button>)}
      </div>
      <input type="search" aria-label="Tìm kiếm sản phẩm" placeholder="Tìm kiếm sản phẩm…" value={search} onChange={event => setSearch(event.target.value)} />
    </div>
    <div aria-live="polite">{error && <p className="normal-catalog-error" role="alert">{error}</p>}{joinError && !privateRoom && <p className="normal-catalog-error" role="alert">{joinError}</p>}</div>
    {loading ? <p role="status">Đang tải sản phẩm…</p> : <>
      <p className="normal-results-count">{filtered.length} phiên đấu giá</p>
      {!filtered.length && <p className="normal-catalog-empty">Không có phiên phù hợp với bộ lọc hiện tại.</p>}
      <div className="normal-catalog-grid">{filtered.map(item => {
        const active = ['RUNNING', 'UPCOMING'].includes(item.status);
        const hidden = item.access === 'PRIVATE' && !item.joined && !active && auth.user?.role !== 'ADMIN';
        return <article key={item.id} className="normal-auction-card" aria-label={`Phiên #${item.id} · ${item.product.name}`}>
          <div className="normal-card-badges"><span>NORMAL</span><span className={item.access === 'PRIVATE' ? 'private' : 'public'}>{item.access === 'PRIVATE' ? '▣ ' : ''}{item.access}</span><small>#{item.id}</small></div>
          <ProductImage product={item.product} />
          <h2>{item.product.name}</h2><p className="normal-card-description">{item.product.description || 'Chưa có mô tả sản phẩm.'}</p>
          <div className={`normal-card-status ${item.status.toLowerCase()}`}><strong>{statuses[item.status]}</strong>{item.status === 'RUNNING' && <time aria-label="Thời gian còn lại">{countdown(item.endsAt, now)}</time>}</div>
          <dl className="normal-card-facts"><div><dt>{item.status === 'UPCOMING' ? 'Bắt đầu' : 'Kết thúc'}</dt><dd>{date(item.status === 'UPCOMING' ? item.startsAt : item.endsAt)}</dd></div><div><dt>Số lượng</dt><dd>{item.product.quantity}</dd></div></dl>
          <button type="button" className="normal-enter-button" disabled={busy !== null || hidden} onClick={() => choose(item)}>{busy === item.id ? 'Đang vào phòng…' : hidden ? 'Phòng riêng tư đã kết thúc' : active ? 'Vào phòng' : 'Xem kết quả'}</button>
        </article>;
      })}</div>
    </>}
    <dialog ref={dialog} className="normal-code-dialog" aria-labelledby="private-room-title" onCancel={event => { if (busy !== null) event.preventDefault(); else setPrivateRoom(null); }}>
      <form onSubmit={submit}><h2 id="private-room-title">Vào phòng riêng tư #{privateRoom?.id}</h2><p>{privateRoom?.product.name}</p><label htmlFor="catalog-room-code">Mã phòng</label><input id="catalog-room-code" type="password" autoComplete="off" autoFocus required maxLength={50} value={code} onChange={event => setCode(event.target.value)} />
        {joinError && <p className="normal-catalog-error" role="alert">{joinError}</p>}
        <div className="normal-dialog-actions"><button type="button" disabled={busy !== null} onClick={() => setPrivateRoom(null)}>Hủy</button><button className="normal-enter-button" disabled={busy !== null} type="submit">{busy !== null ? 'Đang kiểm tra…' : 'Tham gia phiên'}</button></div>
      </form>
    </dialog>
  </main>;
}
