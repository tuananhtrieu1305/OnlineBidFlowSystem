import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getProduct, listProducts, type Product } from '../../products/productApi';
import { listAuctions, saveAuction } from './auctionApi';

const tradeSeconds = 80;
const bidSeconds = 60;

// Three private hints and a stronger system hint for the demo catalog.
const productHints: Record<string, readonly [string, string, string, string]> = {
  'vintage camera': ['Gắn với việc lưu lại kỷ niệm.', 'Ánh sáng ảnh hưởng trực tiếp đến kết quả.', 'Người sưu tầm có thể thích kiểu dáng cổ điển.', 'Có thể dùng để chụp ảnh.'],
  'mechanical keyboard': ['Thường đặt trên bàn làm việc.', 'Có thể phát ra tiếng lách cách.', 'Người dùng tương tác bằng các ngón tay.', 'Dùng để nhập chữ trên máy tính.'],
  'wireless headphones': ['Thường dùng khi muốn nghe riêng tư.', 'Có thể đeo khi di chuyển.', 'Đeo vào sẽ che quanh tai.', 'Phát âm thanh gần tai mà không cần dây tín hiệu.'],
  'collector watch': ['Có thể là món đồ sưu tầm.', 'Thường mang theo trên người.', 'Có thể trở thành phụ kiện của trang phục.', 'Đeo ở cổ tay để xem giờ.'],
  'gaming monitor': ['Thường đặt trên bàn máy tính.', 'Có thể thay đổi độ sáng.', 'Chuyển động hiển thị mượt là một điểm quan trọng.', 'Hiển thị hình ảnh khi chơi game trên máy tính.'],
  'tablet pro': ['Có thể mang theo trong ba lô.', 'Có thể dùng để đọc tài liệu.', 'Có thể cầm bằng hai tay khi sử dụng.', 'Là thiết bị có màn hình cảm ứng lớn hơn điện thoại thông thường.'],
  'smart speaker': ['Thường dùng chung trong một căn phòng.', 'Có thể phát nhạc hoặc nội dung nói.', 'Người nghe không cần đeo thiết bị trên tai.', 'Thuộc nhóm thiết bị phát âm thanh ra không gian xung quanh.'],
  'drone mini': ['Thường được sử dụng ngoài trời.', 'Có thể cho góc nhìn từ trên cao.', 'Kích thước nhỏ giúp dễ mang theo.', 'Có thể điều khiển từ xa để bay.'],
  'espresso machine': ['Có thể đặt trên mặt bàn bếp.', 'Thường dùng cùng nước và nguyên liệu xay.', 'Gắn với một thức uống có hương thơm rõ.', 'Dùng để pha cà phê espresso.'],
  'desk lamp': ['Thường đặt cạnh nơi đọc sách hoặc làm việc.', 'Hữu ích vào buổi tối.', 'Tập trung vào một khu vực nhỏ trong phòng.', 'Chiếu sáng trực tiếp mặt bàn.']
};

function demoSetup(product: Product) {
  const name = product.name.trim();
  const words = name.split(/\s+/u).map(word => Array.from(word));
  const letters = Array.from(name.replace(/\s/gu, ''));
  const key = name.toLowerCase();
  const hints = Object.hasOwn(productHints, key) ? productHints[key] : [
    `Từ đầu tiên trong tên có ${words[0].length} ký tự.`,
    `Chữ đầu của từ cuối trong tên là “${words.at(-1)?.[0]}”.`,
    product.description?.trim() ? 'Sản phẩm có mô tả trong danh mục.' : 'Sản phẩm chưa có mô tả trong danh mục.',
    letters.length > 2 ? `Hai ký tự đầu của tên là “${letters.slice(0, 2).join('')}”.` : 'Tên sản phẩm có tối đa hai ký tự ngoài dấu cách.'
  ];
  return {
    clues: [
      `Tên sản phẩm gồm ${words.length} từ.`,
      `Ký tự đầu của tên là “${letters[0]}”.`,
      `Ký tự cuối của tên là “${letters.at(-1)}”.`,
      `Tên sản phẩm có ${letters.length} ký tự nếu bỏ dấu cách.`,
      `Từ dài nhất trong tên có ${Math.max(...words.map(word => word.length))} ký tự.`,
      ...hints.slice(0, 3)
    ],
    systemClues: [
      hints[3],
      words.length > 1 ? `Các chữ cái đầu của từng từ trong tên là ${words.map(word => word[0]).join(' · ')}.` :
        `Tên có ${new Set(letters.map(letter => letter.toLowerCase())).size} ký tự khác nhau khi không phân biệt hoa thường.`
    ],
    tradeSeconds,
    bidSeconds
  };
}

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
        endTime: new Date(startsAt + 300_000).toISOString(),
        blindSetup: demoSetup(product)
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
        setError('Sản phẩm vừa hết hàng khả dụng. Bấm tạo lại để chọn sản phẩm khác.');
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
    <small>PUBLIC · 4 người · 8 Clue + 2 hệ thống · Mua bán 80 giây · Trả giá 60 giây</small>
    {error && <p role="alert">{error}</p>}
  </div>;
}
