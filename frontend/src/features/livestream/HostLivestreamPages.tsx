import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import LiveProductCatalog from './LiveProductCatalog';
import { listProducts, getProduct, type Product } from '../products/productApi';
import LiveMysterySetup from './LiveMysterySetup';
import { toLiveLot, demoMissions, missionFloor } from './mysterySetup';
import { type LiveMissionTemplate, type NewLiveLot } from './liveState';
import { useLivestream, useLiveSession } from './useLivestream';
import {
  coin,
  liveDate,
  LiveAccess,
  LivePage,
  ProductThumbnail,
  sessionLabels,
  lotLabels
} from './LiveShared';

export function HostLivestreamListPage() {
  return (
    <LiveAccess admin>
      <HostSessions />
    </LiveAccess>
  );
}

function HostSessions() {
  const { state } = useLivestream();
  return (
    <LivePage host>
      <div className="live-heading">
        <div>
          <p className="guest-kicker">DÀNH CHO HOST</p>
          <h1>Phiên livestream</h1>
          <p>Chuẩn bị danh sách hàng và điều hành từng lượt đấu.</p>
        </div>
        <Link className="live-primary" to="/admin/livestream/new">
          ＋ Tạo phiên live
        </Link>
      </div>
      <div className="live-admin-table">
        <div className="live-admin-table-head">
          <span>Phiên livestream</span>
          <span>Lịch phát</span>
          <span>Trạng thái</span>
          <span>Thao tác</span>
        </div>
        {state.sessions.map((session) => (
          <article key={session.id}>
            <div>
              <strong>{session.title}</strong>
              <p>
                {session.lots.length} sản phẩm · {session.hostName}
              </p>
            </div>
            <span>{liveDate(session.startsAt)}</span>
            <span className={'live-status live-status-' + session.status.toLowerCase()}>
              {sessionLabels[session.status]}
            </span>
            <div className="live-actions">
              {session.status !== 'ENDED' && (
                <Link to={'/admin/livestream/' + session.id}>Điều khiển</Link>
              )}
              <Link to={'/admin/livestream/' + session.id + '/results'}>Kết quả</Link>
            </div>
          </article>
        ))}
      </div>
    </LivePage>
  );
}

export function HostLivestreamCreatePage() {
  return (
    <LiveAccess admin>
      <CreateSession />
    </LiveAccess>
  );
}

function localDateTime(now: number) {
  const date = new Date(now);
  return new Date(now - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function CreateSession() {
  const { act, pending, error } = useLivestream();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState(() => localDateTime(Date.now() + 3600000));
  const [lots, setLots] = useState<NewLiveLot[]>([]);
  const [showProducts, setShowProducts] = useState(false);
  const [notice, setNotice] = useState('');
  const [mysteryEnabled, setMysteryEnabled] = useState(false);
  const [secretId, setSecretId] = useState('');
  const [missions, setMissions] = useState<LiveMissionTemplate[]>([]);
  const [setupError, setSetupError] = useState('');
  const [demoBusy, setDemoBusy] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const reads = useRef<AbortController | null>(null);
  const demoSending = useRef(false);
  useEffect(() => () => reads.current?.abort(), []);
  async function configureDemo() {
    if (demoSending.current) return;
    demoSending.current = true; setDemoBusy(true); setSetupError('');
    const controller = new AbortController(); reads.current = controller;
    try {
      const page = await listProducts('', 0, controller.signal, true);
      const candidates = [...page.items].sort((a, b) => Number(!!b.imageUrl) - Number(!!a.imageUrl)).slice(0, 5);
      if (candidates.length < 3) throw new Error('Cần ít nhất ba sản phẩm khác nhau còn khả dụng. Hãy bổ sung tồn kho rồi thử lại.');
      const products = await Promise.all(candidates.map(p => getProduct(p.id)));
      if (controller.signal.aborted) return;
      const selected = products.map(toLiveLot);
      setLots(selected); setSecretId(selected[selected.length - 1].productId);
      setMissions(demoMissions(selected.slice(0, -1))); setMysteryEnabled(true);
      setTitle('Demo Săn vé bí ẩn');
      setDescription('Mua đủ hai sản phẩm theo nhiệm vụ để nhận một vé. Bán hết hàng thường và có vé mới mở món bí mật. Giữ Coin để đấu vòng cuối.');
      setStartsAt(localDateTime(Date.now() + 3600000));
      setNotice('Đã điền cấu hình demo từ hàng thực tế, dùng giá ước tính làm giá khởi điểm. Kiểm tra rồi bấm Lưu phiên livestream.');
    } catch (e) {
      if (!controller.signal.aborted) setSetupError(e instanceof Error && !('isAxiosError' in e) ? e.message : 'Không tải được sản phẩm. Kiểm tra kết nối và thử lại.');
    } finally { demoSending.current = false; if (!controller.signal.aborted) setDemoBusy(false); }
  }

  function add(product: Product) {
    const lot: NewLiveLot = {
      id: 'product-' + product.id,
      productId: product.id,
      productVersion: product.version,
      name: product.name,
      description: product.description ?? '',
      imageUrl: product.imageUrl,
      startingPrice:
        product.estimatedPrice && BigInt(product.estimatedPrice) > 0n
          ? product.estimatedPrice
          : '100'
    };
    setLots((items) =>
      items.length >= 30 || items.some((item) => item.id === lot.id) ? items : [...items, lot]
    );
    setNotice('Đã thêm “' + product.name + '”.');
  }
  function move(index: number, offset: number) {
    const next = [...lots];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    setLots(next);
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSetupError('');
    const regular = lots.filter(l => l.productId !== secretId);
    const secretLot = lots.find(l => l.productId === secretId);
    if (mysteryEnabled && (!secretLot || regular.length < 2 || !missions.length || missions.some(m => !m.title.trim() || missionFloor(m, regular) === null || [...m.groupA, ...m.groupB].some(id => !regular.some(l => l.productId === id))))) {
      setSetupError('Chọn một món bí mật, ít nhất hai món thường và mẫu nhiệm vụ gồm hai nhóm ghép được hai sản phẩm khác nhau.');
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    const id = await act({
      type: 'CREATE',
      title,
      description,
      startsAt: Date.parse(startsAt),
      lots: mysteryEnabled ? regular : lots,
      mystery: mysteryEnabled && secretLot ? { secretLot, missions } : undefined
    });
    if (typeof id === 'string') navigate('/admin/livestream/' + id);
  }
  return (
    <LivePage host>
      <div className="live-heading">
        <div>
          <Link className="live-back" to="/admin/livestream">
            ← Phiên livestream
          </Link>
          <p className="guest-kicker">CHUẨN BỊ TRƯỚC GIỜ LÊN SÓNG</p>
          <h1>Tạo phiên livestream</h1>
          <p>Chọn hàng, sắp xếp thứ tự và đặt giá khởi điểm cho từng món.</p>
        </div>
      </div>
      <div className="live-actions">
        <button type="button" className="live-secondary" disabled={pending || demoBusy} aria-busy={demoBusy} onClick={() => void configureDemo()}>{demoBusy ? 'Đang tải hàng thực tế…' : 'Cấu hình nhanh phiên Săn vé bí ẩn demo'}</button>
        <p>Điền lại biểu mẫu từ tối đa 5 sản phẩm còn hàng; kiểm tra rồi lưu.</p>
      </div>
      {notice && <p role="status" className="live-notice">{notice}</p>}
      {setupError && <p ref={errorRef} tabIndex={-1} role="alert" className="live-error">{setupError}</p>}
      <form onSubmit={(event) => void submit(event)} className="live-setup">
        <fieldset disabled={pending || demoBusy} className="live-setup-fields">
          <legend className="live-sr-only">Cấu hình phiên livestream</legend>
        <section className="live-panel live-mystery-toggle"><input id="live-mystery-enabled" type="checkbox" checked={mysteryEnabled} onChange={e => setMysteryEnabled(e.target.checked)} aria-controls="live-mystery-config" aria-expanded={mysteryEnabled} /><label htmlFor="live-mystery-enabled">Bật Săn vé bí ẩn</label><p>Tắt để tạo livestream thường như hiện tại.</p></section>
        <section className="live-panel">
          <h2>Thông tin phiên</h2>
          <label htmlFor="live-title">Tên phiên</label>
          <input
            id="live-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            required
            placeholder="Ví dụ: Góc sưu tầm cuối tuần"
          />
          <label htmlFor="live-start">Thời gian bắt đầu</label>
          <input
            id="live-start"
            type="datetime-local"
            required
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
          />
          <p className="live-field-hint">
            Theo múi giờ {Intl.DateTimeFormat().resolvedOptions().timeZone}. Host chủ động mở live.
          </p>
          <label htmlFor="live-description">Giới thiệu phiên</label>
          <textarea
            id="live-description"
            value={description}
            maxLength={1000}
            rows={4}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Giới thiệu bộ sưu tập và những thông tin người xem cần biết."
          />
          <div className="live-rules">
            <h3>Luật của phiên</h3>
            <p>
              Giá mới cao hơn giá hiện tại. Mỗi lượt hợp lệ bắt đầu lại 5 giây. Khi chốt người
              thắng, búa gỗ gõ ba lần.
            </p>
          </div>
        </section>
        <section className="live-panel live-setup-products">
          <div className="live-setup-products-heading">
            <h2>Danh sách sản phẩm ({lots.length}/30)</h2>
            <button
              className="live-secondary"
              type="button"
              disabled={pending || lots.length >= 30}
              aria-haspopup="dialog"
              onClick={() => {
                setNotice('');
                setShowProducts(true);
              }}
            >
              ＋ Thêm sản phẩm
            </button>
          </div>
          <p className="live-muted">
            Mỗi sản phẩm là một món riêng. Host có thể chọn món đưa lên khi live.
          </p>
          <div
            className="live-selected-lots"
            role="region"
            aria-label="Sản phẩm đã thêm vào phiên"
            tabIndex={0}
          >
            {!lots.length && (
              <div className="live-selected-empty">
                <span aria-hidden="true">＋</span>
                <strong>Chọn món đầu tiên cho phiên live</strong>
                <p>Thêm nhiều sản phẩm từ danh mục, sau đó điều chỉnh giá và thứ tự tại đây.</p>
              </div>
            )}
            {lots.map((lot, index) => (
              <div key={lot.id} className="live-selected-lot">
                <div className="live-selected-lot-title">
                  <ProductThumbnail lot={lot} />
                  <strong>
                    {index + 1}. {lot.name}
                  </strong>
                </div>
                <label htmlFor={'live-lot-price-' + index}>
                  Giá khởi điểm (Coin)<span className="live-sr-only"> cho {lot.name}</span>
                </label>
                <input
                  id={'live-lot-price-' + index}
                  value={lot.startingPrice}
                  inputMode="numeric"
                  required
                  onChange={(event) =>
                    setLots((items) =>
                      items.map((item) =>
                        item.id === lot.id ? { ...item, startingPrice: event.target.value } : item
                      )
                    )
                  }
                />
                <div className="live-actions">
                  <button type="button" disabled={index === 0} onClick={() => move(index, -1)}>
                    Lên
                  </button>
                  <button
                    type="button"
                    disabled={index === lots.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    Xuống
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLots(items => items.filter(item => item.id !== lot.id));
                      if (secretId === lot.productId) setSecretId('');
                      setMissions(items => items.map(m => ({ ...m, groupA: m.groupA.filter(id => id !== lot.productId), groupB: m.groupB.filter(id => id !== lot.productId) })));
                    }}
                  >
                    Bỏ khỏi phiên
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
        {mysteryEnabled && <div id="live-mystery-config"><LiveMysterySetup lots={lots} secretId={secretId} missions={missions} onSecret={id => { setSecretId(id); setMissions(missions.map(m => ({ ...m, groupA: m.groupA.filter(p => p !== id), groupB: m.groupB.filter(p => p !== id) }))); }} onMissions={setMissions} /></div>}
        {error && (
          <p className="live-error" role="alert">
            {error}
          </p>
        )}
        <div className="live-actions live-setup-actions">
          <Link className="live-secondary" to="/admin/livestream">
            Về danh sách
          </Link>
          <button className="live-primary" type="submit" disabled={pending || demoBusy}>
            {pending ? 'Đang lưu…' : 'Lưu phiên livestream'}
          </button>
        </div>
        </fieldset>
      </form>
      {showProducts && (
        <LiveProductCatalog
          addedIds={lots.map((lot) => lot.productId)}
          notice={notice}
          disabled={pending || demoBusy}
          onAdd={add}
          onClose={() => setShowProducts(false)}
        />
      )}
    </LivePage>
  );
}

export function HostLivestreamResultsPage() {
  return (
    <LiveAccess admin>
      <Results />
    </LiveAccess>
  );
}

function Results() {
  const { id } = useParams();
  useLiveSession(id);
  const { state } = useLivestream();
  const [filter, setFilter] = useState<'ALL' | 'SOLD' | 'UNSOLD'>('ALL');
  const [query, setQuery] = useState('');
  const session = state.sessions.find((item) => item.id === id);
  if (!session)
    return (
      <LivePage host showRules={false}>
        <div className="live-empty">
          <h1>Không tìm thấy phiên</h1>
          <Link to="/admin/livestream">Về danh sách</Link>
        </div>
      </LivePage>
    );
  const sold = session.lots.filter((lot) => lot.status === 'SOLD');
  const unsold = session.lots.filter((lot) => lot.status === 'UNSOLD');
  const pending = session.lots.length - sold.length - unsold.length;
  const total = sold.reduce((sum, lot) => sum + BigInt(lot.currentPrice), 0n).toString();
  const search = query.trim().toLocaleLowerCase('vi-VN');
  const rows = session.lots
    .map((lot, index) => ({ lot, index }))
    .filter(
      ({ lot }) =>
        (filter === 'ALL' || lot.status === filter) &&
        (!search ||
          lot.name.toLocaleLowerCase('vi-VN').includes(search) ||
          (lot.status === 'SOLD' && lot.leaderName?.toLocaleLowerCase('vi-VN').includes(search)))
    );
  const filters = [
    { value: 'ALL', label: 'Tất cả', count: session.lots.length },
    { value: 'SOLD', label: 'Đã bán', count: sold.length },
    { value: 'UNSOLD', label: 'Chưa bán', count: unsold.length }
  ] as const;
  return (
    <LivePage host showRules={false}>
      <div className="live-heading live-results-heading">
        <div>
          <p className="guest-kicker">KẾT QUẢ LIVESTREAM</p>
          <h1>{session.title}</h1>
          <div className="live-results-meta">
            <span className={'live-status live-status-' + session.status.toLowerCase()}>
              {sessionLabels[session.status]}
            </span>
            <span>Host: {session.hostName}</span>
            <span>Lịch phát: {liveDate(session.startsAt)}</span>
          </div>
        </div>
        <div className="live-actions">
          <Link className="live-secondary" to="/admin/livestream">
            ← Danh sách phiên
          </Link>
          {session.status !== 'ENDED' && (
            <Link className="live-primary" to={'/admin/livestream/' + session.id}>
              Điều khiển phiên
            </Link>
          )}
        </div>
      </div>
      <section className="live-results-summary" aria-label="Tổng quan kết quả">
        <article className="live-result-stat" aria-label="Tổng sản phẩm">
          <p>Tổng sản phẩm</p>
          <strong>{session.lots.length}</strong>
          <small>Sản phẩm trong phiên</small>
        </article>
        <article className="live-result-stat is-sold" aria-label="Đã bán">
          <p>Đã bán</p>
          <strong>{sold.length}</strong>
          <small>Đã chốt người thắng</small>
        </article>
        <article className="live-result-stat is-unsold" aria-label="Chưa bán">
          <p>Chưa bán</p>
          <strong>{unsold.length}</strong>
          <small>Đã kết thúc lượt, chưa bán được</small>
        </article>
        <article className="live-result-stat is-total" aria-label="Tổng Coin chốt">
          <p>Tổng Coin chốt</p>
          <strong>{coin(total)}</strong>
          <small>Chỉ tính sản phẩm đã bán</small>
        </article>
      </section>
      {session.status !== 'ENDED' && (
        <p className="live-results-progress" role="status">
          Kết quả tạm thời · Còn {pending} sản phẩm chưa chốt.
        </p>
      )}
      <section className="live-results-panel" aria-labelledby="live-result-title">
        <div className="live-results-section-heading">
          <div>
            <h2 id="live-result-title">Kết quả từng sản phẩm</h2>
            <p>Ảnh sản phẩm, giá chốt và người thắng trong từng lượt đấu.</p>
          </div>
          <span>
            {rows.length} / {session.lots.length} sản phẩm
          </span>
        </div>
        <div className="live-results-toolbar">
          <div className="live-result-filters" role="group" aria-label="Lọc kết quả">
            {filters.map((item) => (
              <button
                key={item.value}
                type="button"
                aria-pressed={filter === item.value}
                onClick={() => setFilter(item.value)}
              >
                {item.label} <span>({item.count})</span>
              </button>
            ))}
          </div>
          <label className="live-results-search">
            <span className="live-sr-only">Tìm sản phẩm hoặc người thắng</span>
            <input
              type="search"
              value={query}
              maxLength={255}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm sản phẩm hoặc người thắng…"
            />
          </label>
        </div>
        <div
          className="live-results-table-wrap"
          role="region"
          aria-label="Bảng kết quả sản phẩm"
          tabIndex={0}
        >
          <table className="live-results-table">
            <caption className="live-sr-only">
              Kết quả các sản phẩm trong phiên {session.title}
            </caption>
            <thead>
              <tr>
                <th scope="col">Sản phẩm</th>
                <th scope="col">Giá khởi điểm</th>
                <th scope="col">Giá chốt</th>
                <th scope="col">Người thắng</th>
                <th scope="col">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ lot, index }) => (
                <tr key={lot.id}>
                  <td>
                    <div className="live-result-product">
                      <span className="live-result-number">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <ProductThumbnail lot={lot} />
                      <div>
                        <strong>{lot.name}</strong>
                        <small>
                          {lot.kind === 'SECRET' ? 'Món bí mật cuối phiên' : 'Món ' + (index + 1)} · #{lot.productId}
                        </small>
                      </div>
                    </div>
                  </td>
                  <td className="live-result-money">{coin(lot.startingPrice)}</td>
                  <td className="live-result-money live-result-final">
                    {lot.status === 'SOLD' ? coin(lot.currentPrice) : '—'}
                  </td>
                  <td>
                    {lot.status === 'SOLD' && lot.leaderName ? (
                      <div className="live-result-winner">
                        <span className="live-result-avatar" aria-hidden="true">
                          {Array.from(lot.leaderName)[0]?.toLocaleUpperCase('vi-VN')}
                        </span>
                        {lot.leaderId ? (
                          <Link to={'/admin/users/' + lot.leaderId}>{lot.leaderName}</Link>
                        ) : (
                          <span>{lot.leaderName}</span>
                        )}
                      </div>
                    ) : (
                      <span className="live-result-dash">—</span>
                    )}
                  </td>
                  <td>
                    <span className={'live-result-status is-' + lot.status.toLowerCase()}>
                      {lot.kind === 'SECRET' && session.finalState === 'SKIPPED' ? 'Không mở' : lotLabels[lot.status]}
                    </span>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={5}>
                    <div className="live-results-empty">
                      <strong>Không có sản phẩm phù hợp</strong>
                      <p>Thử đổi trạng thái hoặc từ khóa tìm kiếm.</p>
                      <button
                        type="button"
                        className="live-secondary"
                        onClick={() => {
                          setFilter('ALL');
                          setQuery('');
                        }}
                      >
                        Xóa bộ lọc
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </LivePage>
  );
}
