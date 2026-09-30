import { Navigate } from 'react-router-dom';
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
      <div className="guest-empty"><h2>Bạn đã đăng nhập với quyền Admin</h2><p>Các chức năng quản lý người dùng, sản phẩm và tạo phiên sẽ được bổ sung ở bước tiếp theo.</p></div>
    </section>
  </main>;
}
