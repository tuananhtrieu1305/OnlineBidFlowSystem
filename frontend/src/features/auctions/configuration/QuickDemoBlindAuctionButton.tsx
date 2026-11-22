import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getProduct, listProducts } from '../../products/productApi';
import { saveAdminClues } from '../blind/blindApi';
import { listAuctions, saveAuction } from './auctionApi';

export default function QuickDemoBlindAuctionButton() {
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
    let createdId: string | null = null;
    let generatedClues: string[] = [];
    const controller = new AbortController();
    reads.current = controller;
    try {
      const requestedAt = Date.now();
      const [products, sessions] = await Promise.all([
        listProducts('', 0, controller.signal, true),
        listAuctions({ q: '', status: '', auctionType: '', accessType: '' }, 0, controller.signal)
      ]);
      const offset = Date.parse(sessions.serverNow) - (requestedAt + Date.now()) / 2;
      if (!Number.isFinite(offset)) throw new Error('Không lấy được thời gian server.');
      const candidate = products.items.find(product => product.imageUrl) ?? products.items[0];
      if (!candidate) throw new Error('Hết sản phẩm còn hàng để tạo phiên demo. Hãy thêm sản phẩm hoặc cập nhật tồn kho.');
      const product = await getProduct(candidate.id);
      if (!alive.current || controller.signal.aborted) return;

      const startsAt = Date.now() + offset + 30_000;
      submitted = true;
      const auction = await saveAuction({
        productId: product.id,
        productVersion: product.version,
        auctionType: 'BLIND', accessType: 'PUBLIC',
        startingPrice: '1000', minBidIncrement: null, maxParticipants: 4,
        startTime: new Date(startsAt).toISOString(),
        endTime: new Date(startsAt + 180_000).toISOString()
      });
      createdId = auction.id;
      const name = product.name.trim();
      const description = product.description?.trim() ?? '';
      generatedClues = [
        `Tên sản phẩm gồm ${name.split(/\s+/u).filter(Boolean).length} từ.`,
        `Tên sản phẩm bắt đầu bằng chữ “${name[0]}”.`,
        description ? `Mô tả sản phẩm gồm ${description.split(/\s+/u).filter(Boolean).length} từ.` : `Mã sản phẩm trong kho là ${product.id}.`,
        `Sản phẩm có số lượng ${product.quantity} trong kho.`
      ];
      await saveAdminClues(auction.id, generatedClues);
      if (alive.current) navigate(`/admin/auctions/${auction.id}`, { state: { quickBlindDemo: true, cluesReady: true } });
    } catch (failure) {
      if (!alive.current || controller.signal.aborted) return;
      if (createdId) {
        navigate(`/admin/auctions/${createdId}/clues`, { state: { quickBlindDemo: true, fallbackClues: generatedClues } });
      } else {
        const status = axios.isAxiosError(failure) ? failure.response?.status : undefined;
        const code = axios.isAxiosError(failure) ? failure.response?.data?.code : undefined;
        if (submitted && (!status || status >= 500)) {
          setUncertain(true);
          setError('Chưa rõ phiên đã được tạo chưa. Kiểm tra danh sách trước khi bấm tạo lại.');
        } else if (status === 401 || status === 403) {
          setError('Phiên đăng nhập hoặc quyền quản trị không còn hợp lệ. Đăng nhập lại.');
        } else if (status === 412) {
          setError('Sản phẩm vừa thay đổi. Bấm tạo lại để lấy cấu hình mới.');
        } else if (status === 400 && code === 'INVALID_AUCTION_CONFIGURATION') {
          setError('Backend chưa nhận cấu hình phiên BLIND demo. Khởi động lại backend rồi thử lại.');
        } else if (status === 409 && code === 'START_TIME_PASSED') {
          setError('Thời gian server đã qua giờ mở phiên. Đồng bộ giờ máy rồi thử lại.');
        } else if (code === 'PRODUCT_OUT_OF_STOCK') {
          setError('Sản phẩm vừa hết hàng khả dụng. Bấm tạo lại để chọn sản phẩm khác.');
        } else if (status === 400 || status === 409) {
          setError('Chưa tạo được phiên demo (' + (code ?? status) + '). Kiểm tra sản phẩm và thử lại.');
        } else {
          setError(axios.isAxiosError(failure) ? 'Không tải được sản phẩm hoặc cấu hình. Thử lại khi kết nối ổn định.' : failure instanceof Error ? failure.message : 'Không thể tạo phiên demo.');
        }
      }
    } finally {
      sending.current = false;
      if (alive.current) setBusy(false);
    }
  }

  return <div className="auction-quick-demo">
    <button type="button" className="auction-demo-button" disabled={busy || uncertain} onClick={() => void createDemo()} aria-busy={busy}>
      {busy ? 'Đang tạo phiên mù demo…' : 'Tạo phiên đấu giá mù demo nhanh'}
    </button>
    <small>PUBLIC · 4 người · thời lượng chuẩn 8 phút 20 giây</small>
    {error && <p role="alert">{error}</p>}
  </div>;
}
