import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getProduct, listProducts } from '../../products/productApi';
import { listAuctions, saveAuction } from './auctionApi';

export default function QuickDemoAuctionButton() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const sending = useRef(false);
  const alive = useRef(true);
  const reads = useRef<AbortController | null>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; reads.current?.abort(); }; }, []);

  async function createDemo() {
    if (sending.current || uncertain) return;
    sending.current = true;
    setBusy(true); setError('');
    let submitted = false;
    const controller = new AbortController();
    reads.current = controller;
    try {
      const requestedAt = Date.now();
      const [products, sessions] = await Promise.all([
        listProducts('', 0, controller.signal),
        listAuctions({ q: '', status: '', auctionType: '', accessType: '' }, 0, controller.signal)
      ]);
      const offset = Date.parse(sessions.serverNow) - (requestedAt + Date.now()) / 2;
      if (!Number.isFinite(offset)) throw new Error('Không lấy được thời gian server.');
      const candidates = products.items.filter(product => product.quantity > 0);
      const candidate = candidates.find(product => product.imageUrl) ?? candidates[0];
      if (!candidate) throw new Error('Thêm ít nhất một sản phẩm trước khi tạo phiên demo.');
      const product = await getProduct(candidate.id);
      if (!alive.current || controller.signal.aborted) return;
      const startsAt = Date.now() + offset + 30_000;
      submitted = true;
      const auction = await saveAuction({
        productId: product.id,
        productVersion: product.version,
        auctionType: 'NORMAL', accessType: 'PUBLIC',
        startingPrice: '1000', minBidIncrement: '100', maxParticipants: null,
        startTime: new Date(startsAt).toISOString(),
        endTime: new Date(startsAt + 180_000).toISOString(),
        normalTiming: { closingWindowSeconds: 30, extensionSeconds: 30, leaderboardSeconds: 60 }
      });
      if (alive.current) navigate(`/admin/auctions/${auction.id}`, { state: { quickDemo: true } });
    } catch (failure) {
      if (!alive.current || controller.signal.aborted) return;
      const status = axios.isAxiosError(failure) ? failure.response?.status : undefined;
      if (submitted && (!status || status >= 500)) {
        setUncertain(true);
        setError('Chưa xác định kết quả tạo. Tải lại danh sách để kiểm tra trước khi tạo tiếp.');
      } else if (status === 401 || status === 403) {
        setError('Phiên đăng nhập hoặc quyền quản trị không còn hợp lệ. Đăng nhập lại.');
      } else if (status === 412) {
        setError('Sản phẩm vừa thay đổi. Bấm tạo lại để lấy cấu hình mới.');
      } else if (status === 400 || status === 409) {
        setError('Chưa tạo được phiên demo. Kiểm tra cấu hình và thời gian server rồi thử lại.');
      } else {
        setError(axios.isAxiosError(failure) ? 'Không tải được sản phẩm hoặc cấu hình. Thử lại khi kết nối ổn định.' : failure instanceof Error ? failure.message : 'Không thể tạo phiên demo.');
      }
    } finally {
      sending.current = false;
      if (alive.current) setBusy(false);
    }
  }

  return <div className="auction-quick-demo">
    <button type="button" className="auction-demo-button" disabled={busy || uncertain} onClick={() => void createDemo()} aria-busy={busy}>
      {busy ? 'Đang tạo phiên demo…' : 'Tạo phiên demo nhanh'}
    </button>
    <small>PUBLIC · 3 phút · bắt đầu sau 30 giây</small>
    {error && <p role="alert">{error}</p>}
  </div>;
}
