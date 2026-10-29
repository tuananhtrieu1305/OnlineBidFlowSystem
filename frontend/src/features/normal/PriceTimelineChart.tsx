import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { NormalAuction, NormalBid } from './types';
import { roomCoin } from './roomExperience';

const timeLabel = (value: number) => new Date(value).toLocaleTimeString('vi-VN', { hour12: false });
const fullTime = (value: number) => new Date(value).toLocaleString('vi-VN');
const compactCoin = new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 });
const avatarColors = ['#175c52', '#5c4f7a', '#895b32', '#365e83', '#754e5d', '#4c6740'];
function avatarColor(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return avatarColors[hash % avatarColors.length];
}
function initials(name: string) {
  const words = name.trim().split(/[\s._-]+/u).filter(Boolean);
  return (words.length > 1 ? words.slice(0, 2).map(word => word[0]).join('') : name.slice(0, 2)).toLocaleUpperCase('vi-VN');
}
type Props = { auction: NormalAuction; serverTime: number; username: string; stale: boolean; connected: boolean; visible?: boolean; fullscreenSignal?: number };

function PriceTimelineChart({ auction, serverTime, username, stale, connected, visible = true, fullscreenSignal = 0 }: Props) {
  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const pan = useRef<{ pointerId: number; x: number; scroll: number } | null>(null);
  const replayPositioned = useRef(false);
  const handledFullscreenSignal = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const finished = auction.status === 'SOLD' || auction.status === 'UNSOLD';
  const avatars = useRef<Array<HTMLButtonElement | null>>([]);
  const [size, setSize] = useState({ width: 600, height: 220 });
  const [inspected, setInspected] = useState<number | null>(null);
  const [range, setRange] = useState<'recent' | 'all'>('recent');
  const titleId = useId();
  const descId = useId();
  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const measure = () => { if (element.clientWidth > 0 && element.clientHeight > 0) setSize(old => old.width === element.clientWidth && old.height === element.clientHeight ? old : { width: element.clientWidth, height: element.clientHeight }); };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const syncFullscreen = () => setFullscreen(document.fullscreenElement === root.current);
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

  useEffect(() => {
    if (!fullscreen || document.fullscreenElement === root.current) return;
    const leaveFallback = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFullscreen(false);
    };
    document.addEventListener('keydown', leaveFallback);
    return () => document.removeEventListener('keydown', leaveFallback);
  }, [fullscreen]);

  const enterFullscreen = useCallback(async () => {
    const element = root.current;
    if (!element) return;
    if (element.requestFullscreen) {
      try {
        await element.requestFullscreen();
        return;
      } catch {
        // Use the in-page expanded view if browser fullscreen is unavailable.
      }
    }
    setFullscreen(true);
  }, []);

  async function toggleFullscreen() {
    if (!fullscreen) {
      await enterFullscreen();
      return;
    }
    if (document.fullscreenElement === root.current && document.exitFullscreen) {
      await document.exitFullscreen().catch(() => setFullscreen(false));
    } else setFullscreen(false);
  }

  useEffect(() => {
    if (!visible || !finished || fullscreenSignal <= handledFullscreenSignal.current) return;
    handledFullscreenSignal.current = fullscreenSignal;
    void enterFullscreen();
  }, [fullscreenSignal, visible, finished, enterFullscreen]);

  const bids = useMemo(() => auction.bids.filter(bid => Number.isFinite(bid.amount) && Number.isFinite(Date.parse(bid.createdAt))).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id - b.id), [auction.bids]);
  const data = useMemo(() => {
    const last = bids[bids.length - 1];
    const lastTime = last ? Date.parse(last.createdAt) : auction.startsAt;
    const closed = auction.status === 'SOLD' || auction.status === 'UNSOLD';
    const observedEnd = closed ? auction.endsAt : auction.status === 'UPCOMING' ? auction.startsAt : Math.min(Math.max(serverTime, lastTime, auction.startsAt), auction.endsAt);
    // Recent is a real moving 60-second window. Its start advances even without a new bid.
    const end = !finished && range === 'recent' ? observedEnd : Math.max(auction.startsAt + 1000, observedEnd);
    const start = !finished && range === 'recent' ? end - 60_000 : Math.min(auction.startsAt, bids[0] ? Date.parse(bids[0].createdAt) : auction.startsAt);
    const selected = bids.filter(bid => Date.parse(bid.createdAt) >= start && Date.parse(bid.createdAt) <= end);
    let baseline = auction.startingPrice;
    for (const bid of bids) { if (Date.parse(bid.createdAt) >= start) break; baseline = bid.amount; }
    const lineStart = Math.max(start, auction.startsAt);
    const minPrice = selected.reduce((value, bid) => Math.min(value, bid.amount), baseline);
    const maxPrice = selected.reduce((value, bid) => Math.max(value, bid.amount), baseline);
    const spread = Math.max(maxPrice - minPrice, auction.increment * 2, 1);
    const rawStep = spread / 4;
    const power = 10 ** Math.floor(Math.log10(rawStep));
    const fraction = rawStep / power;
    const step = (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * power;
    const floor = Math.max(0, Math.floor(minPrice / step) * step);
    const ceiling = Math.max(floor + step * 2, Math.ceil(maxPrice / step) * step);
    const ticks = Array.from({ length: Math.min(9, Math.round((ceiling - floor) / step) + 1) }, (_, index) => floor + index * step);
    return { bids, selected, baseline, start, end, lineStart, floor, ceiling, ticks, last };
  }, [bids, auction.startingPrice, auction.increment, auction.startsAt, auction.endsAt, auction.status, serverTime, range, finished]);

  const geometry = useMemo(() => {
    const viewportWidth = Math.max(260, size.width);
    const width = finished ? Math.max(viewportWidth, Math.min(24000, Math.max((data.end - data.start) / 60000 * viewportWidth, data.selected.length * 52))) : viewportWidth;
    const height = Math.max(140, size.height);
    const tickCount = finished ? Math.min(180, Math.max(4, Math.ceil(width / 140))) : 4;
    const left = 64, right = width - 24, top = 20, bottom = height - 72;
    const x = (time: number) => left + (time - data.start) / (data.end - data.start) * (right - left);
    const y = (amount: number) => bottom - (amount - data.floor) / (data.ceiling - data.floor) * (bottom - top);
    // Keep all bids in data/tooltips; reduce SVG line vertices only for large histories.
    const stride = Math.max(1, Math.ceil(data.selected.length / 700));
    const sampled = data.selected.filter((_, index) => index % stride === 0 || index === data.selected.length - 1);
    let previousX = x(data.lineStart), previousY = y(data.baseline);
    let path = `M ${previousX} ${previousY}`;
    for (const bid of sampled) {
      const nextX = x(Date.parse(bid.createdAt)), nextY = y(bid.amount);
      path += ` L ${nextX} ${nextY}`;
      previousX = nextX; previousY = nextY;
    }
    path += ` L ${right} ${previousY}`;
    const groups: Array<{ x: number; bids: NormalBid[] }> = [];
    for (const bid of data.selected) {
      const px = x(Date.parse(bid.createdAt));
      const previous = groups[groups.length - 1];
      if (previous && px - previous.x < 46) previous.bids.push(bid);
      else groups.push({ x: px, bids: [bid] });
    }
    return { width, height, left, right, top, bottom, x, y, path, groups, sampled, tickCount };
  }, [data, size, finished]);
  const inspectedPoint = inspected === null ? undefined : data.selected.find(bid => bid.id === inspected);
  const current = inspectedPoint ?? data.last;
  useEffect(() => {
    const element = stage.current;
    if (!element || !visible || !finished || replayPositioned.current || element.clientWidth <= 0) return;
    element.scrollLeft = element.scrollWidth;
    replayPositioned.current = true;
  }, [finished, size.width, geometry.width, visible]);

  function scrollReplay(to: 'start' | 'end') {
    stage.current?.scrollTo({ left: to === 'start' ? 0 : stage.current.scrollWidth, behavior: 'auto' });
  }
  function cycleGroup(index: number) {
    const group = geometry.groups[index];
    const currentIndex = group.bids.findIndex(bid => bid.id === inspected);
    setInspected(group.bids[(currentIndex + 1) % group.bids.length].id);
  }
  const chart = <section ref={root} className={`room-price-chart ${finished ? 'price-chart-replay' : ''} ${fullscreen ? 'price-chart-fullscreen-fallback' : ''}`} aria-label="Biểu đồ giá theo thời gian">
    <div className="price-chart-toolbar"><span className={stale ? 'price-chart-state stale' : 'price-chart-state'}>{stale ? 'Đang đồng bộ' : finished ? 'Xem lại' : connected ? 'Trực tiếp' : 'Tự cập nhật'}</span>{finished ? <div role="group" aria-label="Di chuyển biểu đồ kết quả"><button type="button" onClick={() => scrollReplay('start')}>Về đầu</button><button type="button" onClick={() => scrollReplay('end')}>Về cuối</button></div> : <div role="group" aria-label="Khoảng dữ liệu biểu đồ"><button type="button" aria-pressed={range === 'recent'} onClick={() => { setRange('recent'); setInspected(null); }}>60 giây</button><button type="button" aria-pressed={range === 'all'} onClick={() => { setRange('all'); setInspected(null); }}>Toàn phiên</button></div>}<small>{data.bids.length} lượt</small><button type="button" className="price-chart-expand" onClick={() => void toggleFullscreen()} aria-label={fullscreen ? 'Thu nhỏ biểu đồ' : 'Xem biểu đồ toàn màn hình'} title={fullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}>{fullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}</button></div>
    <div className="price-chart-readout" aria-live="off"><strong>{current ? current.username === username ? 'Bạn' : current.username : 'Khởi điểm'}</strong><span>{roomCoin(current?.amount ?? data.baseline)}</span><time title={fullTime(inspectedPoint ? Date.parse(inspectedPoint.createdAt) : data.end)}>{auction.status === 'UPCOMING' ? 'Chưa mở' : timeLabel(inspectedPoint ? Date.parse(inspectedPoint.createdAt) : data.end)}</time></div>
    <div className={`price-chart-viewport ${finished ? 'replay' : ''} ${dragging ? 'dragging' : ''}`} ref={stage} tabIndex={finished ? 0 : undefined} role="region" aria-label={finished ? 'Lịch sử biểu đồ, cuộn ngang hoặc dùng phím trái phải để xem lại' : 'Vùng biểu đồ trực tiếp'}
      onKeyDown={event => {
        if (!finished || event.target !== event.currentTarget) return;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); event.currentTarget.scrollBy({ left: event.key === 'ArrowLeft' ? -160 : 160 }); }
        else if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); scrollReplay(event.key === 'Home' ? 'start' : 'end'); }
      }}
      onPointerDown={event => {
        if (!finished || event.pointerType !== 'mouse' || event.button !== 0 || (event.target instanceof Element && event.target.closest('button'))) return;
        pan.current = { pointerId: event.pointerId, x: event.clientX, scroll: event.currentTarget.scrollLeft };
        event.currentTarget.setPointerCapture(event.pointerId); setDragging(true);
      }}
      onPointerMove={event => { if (pan.current?.pointerId === event.pointerId) event.currentTarget.scrollLeft = pan.current.scroll + pan.current.x - event.clientX; }}
      onPointerUp={event => { if (pan.current?.pointerId === event.pointerId) { pan.current = null; setDragging(false); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); } }}
      onPointerCancel={() => { pan.current = null; setDragging(false); }} onLostPointerCapture={() => { pan.current = null; setDragging(false); }}>
    <div className="price-chart-stage" style={{ width: geometry.width, height: geometry.height }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${geometry.width} ${geometry.height}`} preserveAspectRatio="none" role="img" aria-labelledby={`${titleId} ${descId}`}>
        <title id={titleId}>Giá đấu giá theo thời gian</title><desc id={descId}>Trục dọc là Coin, trục ngang là thời gian server. Đường nối được làm mềm; các chấm là mức giá thực tế đã được server ghi nhận. {data.bids.length} lượt trả giá. Mỗi avatar bên dưới đại diện người trả tại thời điểm đó; các lượt gần nhau được gộp. Chi tiết đầy đủ ở tab Lượt trả.</desc>
        {!finished && <text className="price-chart-axis-caption" x="8" y="13">Coin</text>}
        {data.ticks.map(value => <g key={value}><line className="price-chart-grid" x1={geometry.left} x2={geometry.right} y1={geometry.y(value)} y2={geometry.y(value)} />{!finished && <text className="price-chart-tick" x={geometry.left - 10} y={geometry.y(value) + 4} textAnchor="end">{compactCoin.format(value)}</text>}</g>)}
        <line className="price-chart-axis" x1={geometry.left} x2={geometry.right} y1={geometry.bottom} y2={geometry.bottom} />
        {Array.from({ length: geometry.tickCount }, (_, index) => index).map(index => {
          const time = data.start + (data.end - data.start) * index / (geometry.tickCount - 1);
          return <text key={index} className="price-chart-tick" x={geometry.x(time)} y={geometry.bottom + 19} textAnchor={index === 0 ? 'start' : index === geometry.tickCount - 1 ? 'end' : 'middle'}><title>{fullTime(time)}</title>{timeLabel(time)}</text>;
        })}
        {geometry.sampled.filter((_, index) => index % Math.max(1, Math.ceil(geometry.sampled.length / 32)) === 0 || index === geometry.sampled.length - 1).map(bid => <line key={`drop-${bid.id}`} className="price-chart-drop-line" x1={geometry.x(Date.parse(bid.createdAt))} x2={geometry.x(Date.parse(bid.createdAt))} y1={geometry.y(bid.amount)} y2={geometry.bottom} />)}
        <path className={`price-chart-line ${data.bids.length ? '' : 'empty'}`} d={geometry.path} />
        {auction.status !== 'UPCOMING' && <circle className="price-chart-now" cx={geometry.right} cy={geometry.y(data.last?.amount ?? data.baseline)} r="4" />}
        {geometry.sampled.map(bid => <circle key={bid.id} className={`price-chart-dot ${bid.id === data.last?.id ? 'latest' : ''}`} cx={geometry.x(Date.parse(bid.createdAt))} cy={geometry.y(bid.amount)} r={bid.id === data.last?.id ? 4.5 : 3}><title>{`${bid.username} · ${roomCoin(bid.amount)} · ${fullTime(Date.parse(bid.createdAt))}`}</title></circle>)}
        {inspectedPoint && <g><line className="price-chart-guide" x1={geometry.x(Date.parse(inspectedPoint.createdAt))} x2={geometry.x(Date.parse(inspectedPoint.createdAt))} y1={geometry.y(inspectedPoint.amount)} y2={geometry.bottom} /><circle className="price-chart-selected" cx={geometry.x(Date.parse(inspectedPoint.createdAt))} cy={geometry.y(inspectedPoint.amount)} r="5" /></g>}
      </svg>
      <div className="price-chart-avatars" role="group" aria-label="Người trả giá trên dòng thời gian">{geometry.groups.map((group, index) => {
        const shown = group.bids.find(bid => bid.id === inspected) ?? group.bids[group.bids.length - 1];
        return <button key={group.bids[0].id} ref={element => { avatars.current[index] = element; }} type="button" className={`price-chart-avatar ${shown.id === current?.id ? 'selected' : ''}`} style={{ left: `${group.x / geometry.width * 100}%` }} tabIndex={index === geometry.groups.length - 1 ? 0 : -1}
          aria-label={`${shown.username}, ${roomCoin(shown.amount)}, ${fullTime(Date.parse(shown.createdAt))}${group.bids.length > 1 ? `, nhóm ${group.bids.length} lượt, bấm để xem tiếp` : ''}`}
          title={`${shown.username} · ${roomCoin(shown.amount)} · ${fullTime(Date.parse(shown.createdAt))}${group.bids.length > 1 ? ` · ${group.bids.length} lượt gần nhau` : ''}`}
          onMouseEnter={() => setInspected(shown.id)} onMouseLeave={() => setInspected(null)} onFocus={event => { setInspected(shown.id); if (finished && stage.current) { const viewport = stage.current; const left = event.currentTarget.offsetLeft; if (left < viewport.scrollLeft + 84) viewport.scrollLeft = Math.max(0, left - 84); else if (left > viewport.scrollLeft + viewport.clientWidth - 30) viewport.scrollLeft = left - viewport.clientWidth + 40; } }} onBlur={() => setInspected(null)} onClick={() => cycleGroup(index)}
          onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); avatars.current[Math.max(0, Math.min(geometry.groups.length - 1, index + (event.key === 'ArrowLeft' ? -1 : 1)))]?.focus(); } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); cycleGroup(index); } }}>
          <span className="price-chart-initials" style={{ backgroundColor: avatarColor(shown.username) }} aria-hidden="true">{initials(shown.username)}</span>{group.bids.length > 1 && <b aria-hidden="true">+{group.bids.length - 1}</b>}<small>{shown.username === username ? 'Bạn' : shown.username}</small>
        </button>;
      })}</div>
      {finished && <svg className="price-chart-y-overlay" width="64" height={geometry.height} aria-hidden="true"><text className="price-chart-axis-caption" x="8" y="13">Coin</text>{data.ticks.map(value => <text key={value} className="price-chart-tick" x="54" y={geometry.y(value) + 4} textAnchor="end">{compactCoin.format(value)}</text>)}</svg>}
      {!data.bids.length && <p className="price-chart-empty">Giá sẽ cập nhật khi có bid đầu tiên</p>}
    </div>
    </div>
    {finished && <p className="price-chart-replay-hint">Kéo hoặc vuốt ngang để xem lại · Bấm avatar để xem giá</p>}
  </section>;
  return fullscreen && !document.fullscreenElement ? createPortal(chart, document.body) : chart;
}

export default memo(PriceTimelineChart);
