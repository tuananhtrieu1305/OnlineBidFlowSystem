import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';

export default function AdminPage() {
  const { user, loading, failure } = useAuth();
  if (loading) return <main id="main-content" className="guest-home" tabIndex={-1}><p role="status">Đang kiểm tra phiên đăng nhập…</p></main>;
  if (failure) return <main id="main-content" className="guest-home" tabIndex={-1}><p role="alert">Chưa thể xác minh quyền quản trị. Hãy thử lại ở thanh bên.</p></main>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'ADMIN') return <Navigate to="/" replace />;
  return <main id="main-content" className="guest-home" tabIndex={-1}>
    <header className="guest-topbar">Không gian quản trị</header>
    <section className="guest-auctions"><p className="guest-kicker">TÀI KHOẢN QUẢN TRỊ</p><h1 className="admin-title">Chào mừng, {user.username}.</h1>
      <div className="admin-actions">
        <div className="admin-action-card"><div className="admin-action-copy"><h2>Chuẩn bị sản phẩm cho phiên đấu giá</h2><p>Thêm ảnh, mô tả và quản lý danh mục sản phẩm của hệ thống.</p></div><Link className="admin-action-button" to="/admin/products">Quản lý sản phẩm <span aria-hidden="true">→</span></Link></div>
        <div className="admin-action-card"><div className="admin-action-copy"><h2>Quản lý người dùng</h2><p>Tra cứu tài khoản, ví và lịch sử Coin.</p></div><Link className="admin-action-button" to="/admin/users">Xem người dùng <span aria-hidden="true">→</span></Link></div>
        <div className="admin-action-card"><div className="admin-action-copy"><h2>Ví hệ thống</h2><p>Xem số dư và lịch sử nhận Coin từ đấu giá.</p></div><Link className="admin-action-button" to="/admin/system-wallet">Xem ví hệ thống <span aria-hidden="true">→</span></Link></div>
        <div className="admin-action-card"><div className="admin-action-copy"><h2>Cấu hình phiên đấu giá</h2><p>Chuẩn bị loại phiên, quyền vào phòng, giá và lịch.</p></div><Link className="admin-action-button" to="/admin/auctions">Quản lý phiên <span aria-hidden="true">→</span></Link></div>
        <div className="admin-action-card"><div className="admin-action-copy"><h2>Bảng xếp hạng</h2><p>Xem thành tích người chơi từ các phiên đấu giá đã kết thúc.</p></div><Link className="admin-action-button" to="/leaderboard">Xem bảng xếp hạng <span aria-hidden="true">→</span></Link></div>
      </div>
    </section>
  </main>;
}
