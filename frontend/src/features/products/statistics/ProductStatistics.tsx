import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import client from '../../../api/axiosClient';
import './productStatistics.css';

type Counts = { total: number; upcoming: number; running: number; sold: number; unsold: number };
type TypeCounts = { type: 'NORMAL' | 'BLIND'; total: number; sold: number; unsold: number; averagePrice: string | null };
type Prices = { soldCount: number; average: string | null; median: string | null; minimum: string | null; maximum: string | null; latest: string | null };
type AuctionPoint = { id: string; type: 'NORMAL' | 'BLIND'; finishedAt: string; winningPrice: string };
type AuctionHistoryRow = { id: string; type: 'NORMAL' | 'BLIND'; status: 'SOLD' | 'UNSOLD'; finishedAt: string | null; winningPrice: string | null };
type Statistics = { counts: Counts; byType: TypeCounts[]; prices: Prices; trend: AuctionPoint[];
  history: { items: AuctionHistoryRow[]; page: number; size: number; totalElements: number; totalPages: number } };

const number = (value: number) => new Intl.NumberFormat('vi-VN').format(value);
const coin = (value: string | null) => value === null ? '—' : new Intl.NumberFormat('vi-VN').format(BigInt(value)) + ' Coin';
const date = (value: string | null) => value ? new Date(value).toLocaleDateString('vi-VN') : '—';
const typeName = (type: 'NORMAL' | 'BLIND') => type === 'NORMAL' ? 'Đấu giá thường' : 'Đấu giá mù';

function difference(average: string | null, estimate: string | null) {
  if (average === null || estimate === null) return null;
  const delta = BigInt(average) - BigInt(estimate);
  return (delta > 0n ? '+' : delta < 0n ? '−' : '') + new Intl.NumberFormat('vi-VN').format(delta < 0n ? -delta : delta) + ' Coin';
}

export default function ProductStatistics({ productId, estimatedPrice }: { productId: string; estimatedPrice: string | null }) {
  const [page, setPage] = useState(0), [reload, setReload] = useState(0);
  const [data, setData] = useState<Statistics | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true); setError('');
    void client.get<Statistics>('/api/admin/products/' + encodeURIComponent(productId) + '/statistics',
      { params: { page }, signal: abort.signal })
      .then(response => { if (!abort.signal.aborted) setData(response.data); })
      .catch(reason => { if (!abort.signal.aborted) setError(axios.isAxiosError(reason) && reason.response?.status === 403
        ? 'Bạn không có quyền xem thống kê sản phẩm.' : 'Chưa tải được thống kê. Kiểm tra kết nối và thử lại.'); })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [productId, page, reload]);

  const finished = data ? data.counts.sold + data.counts.unsold : 0;
  const successRate = finished ? Math.round(data!.counts.sold * 100 / finished) + '%' : '—';
  const delta = data ? difference(data.prices.average, estimatedPrice) : null;
  const points = data ? [...data.trend].reverse() : [];
  const maximum = points.reduce((largest, point) => {
    const value = BigInt(point.winningPrice);
    return value > largest ? value : largest;
  }, 0n);

  return <section className="product-stats" aria-labelledby="product-stats-title">
    <div className="product-stats-heading"><div><p className="guest-kicker">DỮ LIỆU PHIÊN ĐẤU GIÁ · CHỈ ADMIN</p><h2 id="product-stats-title">Thống kê sản phẩm</h2>
      <p>Giá chỉ tính từ các phiên đã bán thành công. Phiên chưa kết thúc không tham gia tính giá.</p></div>
      <button type="button" onClick={() => setReload(value => value + 1)} disabled={loading}>Làm mới</button></div>
    {loading && !data ? <p role="status">Đang tải thống kê…</p> : error ? <p role="alert">{error}</p> : data && <>
      <div className="product-stats-cards">
        <article><small>Tổng phiên</small><strong>{number(data.counts.total)}</strong><span>{number(data.counts.upcoming)} sắp diễn ra · {number(data.counts.running)} đang chạy</span></article>
        <article><small>Đã bán</small><strong>{number(data.counts.sold)}</strong><span>Phiên SOLD</span></article>
        <article><small>Chưa bán được</small><strong>{number(data.counts.unsold)}</strong><span>Phiên UNSOLD</span></article>
        <article><small>Tỷ lệ bán thành công</small><strong>{successRate}</strong><span>{number(finished)} phiên đã kết thúc</span></article>
      </div>
      <div className="product-stats-main">
        <section className="product-stats-panel"><h3>Giá bán thực tế</h3>
          {data.prices.soldCount ? <><div className="product-stats-prices">
            <div><small>Gần nhất</small><strong>{coin(data.prices.latest)}</strong></div>
            <div><small>Trung bình</small><strong>{coin(data.prices.average)}</strong></div>
            <div><small>Thấp nhất</small><strong>{coin(data.prices.minimum)}</strong></div>
            <div><small>Cao nhất</small><strong>{coin(data.prices.maximum)}</strong></div>
            {data.prices.median !== null && <div><small>Trung vị</small><strong>{coin(data.prices.median)}</strong></div>}
          </div><p className="product-stats-note">Tính từ {number(data.prices.soldCount)} phiên SOLD.{data.prices.median === null ? ' Trung vị hiển thị từ 5 phiên SOLD.' : ''}</p>
          {delta !== null && <p className="product-stats-estimate">So với giá ước tính của Admin: <strong>{delta}</strong></p>}</>
          : <p className="product-stats-empty">Chưa có phiên bán thành công để tính giá.</p>}
        </section>
        <section className="product-stats-panel"><h3>Theo loại đấu giá</h3><div className="product-stats-types">
          {(['NORMAL', 'BLIND'] as const).map(type => { const item = data.byType.find(value => value.type === type);
            return <div key={type}><strong>{typeName(type)}</strong><span>{number(item?.sold ?? 0)} đã bán / {number((item?.sold ?? 0) + (item?.unsold ?? 0))} kết thúc</span>
              <small>Giá bán trung bình: {coin(item?.averagePrice ?? null)}</small></div>; })}
        </div></section>
      </div>
      <section className="product-stats-panel product-stats-trend"><div className="product-stats-section-heading"><h3>Diễn biến giá bán</h3><span>{points.length} phiên SOLD gần nhất</span></div>
        {points.length ? <div className="product-stats-chart" role="group" aria-label="Giá bán theo thời gian">
          {points.map(point => <Link key={point.id} to={'/admin/auctions/' + point.id}
            aria-label={`Phiên #${point.id}, ${typeName(point.type)}, ${date(point.finishedAt)}, ${coin(point.winningPrice)}`}>
            <span className="product-stats-bar-value">{coin(point.winningPrice)}</span>
            <span className="product-stats-bar-track"><span style={{ height: `${maximum === 0n ? 8 : Math.max(8, Number(BigInt(point.winningPrice) * 100n / maximum))}%` }} /></span>
            <span className="product-stats-bar-label">#{point.id}</span>
            <small>{date(point.finishedAt)}</small>
          </Link>)}
        </div> : <p className="product-stats-empty">Chưa có dữ liệu để vẽ diễn biến giá.</p>}
      </section>
      <section className="product-stats-panel"><div className="product-stats-section-heading"><h3>Lịch sử phiên đã kết thúc</h3><span>{number(data.history.totalElements)} phiên</span></div>
        {data.history.items.length ? <div className="product-stats-table-wrap"><table><thead><tr><th>Phiên</th><th>Loại</th><th>Ngày kết thúc</th><th>Kết quả</th><th>Giá thắng</th></tr></thead><tbody>
          {data.history.items.map(item => <tr key={item.id}><td><Link to={'/admin/auctions/' + item.id}>#{item.id}</Link></td><td>{typeName(item.type)}</td><td>{date(item.finishedAt)}</td>
            <td><span className={item.status === 'SOLD' ? 'product-stats-sold' : 'product-stats-unsold'}>{item.status === 'SOLD' ? 'Đã bán' : 'Chưa bán được'}</span></td><td>{coin(item.winningPrice)}</td></tr>)}
        </tbody></table></div> : <p className="product-stats-empty">Chưa có phiên nào kết thúc.</p>}
        {data.history.totalPages > 1 && <nav className="product-stats-pagination" aria-label="Phân trang lịch sử phiên">
          <button type="button" disabled={loading || page === 0} onClick={() => setPage(value => value - 1)}>Trang trước</button>
          <span>Trang {page + 1} / {data.history.totalPages}</span>
          <button type="button" disabled={loading || page + 1 >= data.history.totalPages} onClick={() => setPage(value => value + 1)}>Trang sau</button>
        </nav>}
      </section>
    </>}
  </section>;
}
