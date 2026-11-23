import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { listProducts } from '../../products/productApi';
import { listAuctions, saveAuction } from './auctionApi';

const demoProductName = 'Vintage Camera';

// The camera's provenance is fictional and applies only to this demo.
const demoSetup = {
  clues: [
    'Chiếc máy từng được nhiếp ảnh gia Henri Cartier-Bresson sử dụng.',
    'Chiếc máy được sản xuất năm 1984.',
    'Chủ cũ thường dùng máy để chụp chân dung đen trắng.',
    'Chiếc máy đã qua tay hai người chủ trước khi được đưa ra đấu giá.',
    'Sổ lưu trữ của chủ cũ ghi nhận máy đã chụp khoảng 10.000 bức ảnh.',
    'Máy sử dụng phim 35 mm.',
    'Ống kính đi kèm là 50 mm f/1.8.',
    'Màn trập cơ có tốc độ từ 1 giây đến 1/1.000 giây.'
  ],
  systemClues: [
    'Một bức ảnh chụp bằng chiếc máy này từng đoạt giải Pulitzer về nhiếp ảnh.',
    'Bản âm của bức ảnh đoạt giải vẫn còn trong kho lưu trữ của tòa soạn. Mặt sau phong bì lưu phim ghi số sê-ri trùng với thân máy.'
  ],
  tradeSeconds: 80,
  bidSeconds: 60
};

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
    const controller = new AbortController();
    reads.current = controller;
    try {
      const requestedAt = Date.now();
      const [products, sessions] = await Promise.all([
        listProducts(demoProductName, 0, controller.signal, true),
        listAuctions({ q: '', status: '', auctionType: '', accessType: '' }, 0, controller.signal)
      ]);
      const offset = Date.parse(sessions.serverNow) - (requestedAt + Date.now()) / 2;
      if (!Number.isFinite(offset)) throw new Error('Không lấy được thời gian server.');
      const product = products.items.find(item => item.name.trim().toLowerCase() === demoProductName.toLowerCase());
      if (!product) throw new Error('Cần có Vintage Camera còn hàng khả dụng để tạo phiên demo.');
      if (!alive.current || controller.signal.aborted) return;

      const startsAt = Date.now() + offset + 30_000;
      submitted = true;
      const auction = await saveAuction({
        productId: product.id,
        productVersion: product.version,
        auctionType: 'BLIND', accessType: 'PUBLIC',
        startingPrice: '1000', minBidIncrement: null, maxParticipants: 4,
        startTime: new Date(startsAt).toISOString(),
        endTime: new Date(startsAt + 300_000).toISOString(),
        blindSetup: demoSetup
      });
      if (alive.current) navigate(`/admin/auctions/${auction.id}`);
    } catch (failure) {
      if (!alive.current || controller.signal.aborted) return;
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
        setError('Vintage Camera vừa hết hàng khả dụng. Hãy kiểm tra tồn kho trước khi tạo lại.');
      } else if (status === 400 || status === 409) {
        setError('Chưa tạo được phiên demo (' + (code ?? status) + '). Kiểm tra sản phẩm và thử lại.');
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
      {busy ? 'Đang tạo phiên mù demo…' : 'Tạo phiên đấu giá mù demo nhanh'}
    </button>
    <small>Vintage Camera · Lai lịch hư cấu · 4 người · 8 Clue + 2 hệ thống · Mua bán 80 giây · Trả giá 60 giây</small>
    {error && <p role="alert">{error}</p>}
  </div>;
}
