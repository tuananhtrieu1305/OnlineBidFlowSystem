import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from './features/auth/AuthProvider';
import './guest.css';

export default function AppLayout() {
  const { user, loading, failure, refresh, logout } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  async function signOut() {
    if (pending) return;
    setPending(true); setError('');
    try { await logout(); navigate('/', { replace: true }); }
    catch { setError('Chưa thể đăng xuất. Kiểm tra kết nối và thử lại.'); }
    finally { setPending(false); }
  }
  return (
    <div className="guest-shell">
      <button className="guest-skip" onClick={() => document.getElementById('main-content')?.focus()}>Đến nội dung chính</button>
      <aside className="guest-sidebar" aria-label="Thanh điều hướng">
        <Link to="/" className="guest-brand"><span aria-hidden="true">b.</span>OnlineBidFlow</Link>
        <p className="guest-nav-label">KHÔNG GIAN ĐẤU GIÁ</p>
        <nav aria-label="Điều hướng chính">
          <NavLink to="/" end className={({ isActive }) => isActive ? 'guest-nav active' : 'guest-nav'}><span aria-hidden="true">▦</span> Khám phá</NavLink>
          {user?.role === 'ADMIN' && <NavLink to="/admin" className={({ isActive }) => isActive ? 'guest-nav active' : 'guest-nav'}>Quản trị</NavLink>}
        </nav>
        <div className="guest-account">
          {loading ? <p role="status">Đang kiểm tra phiên đăng nhập…</p> : user ? <>
            <span className="guest-mode">{user.role === 'ADMIN' ? 'QUẢN TRỊ VIÊN' : 'TÀI KHOẢN CỦA BẠN'}</span>
            <h2 className="account-name">{user.username}</h2>
            <button className="guest-secondary" onClick={() => void signOut()} disabled={pending}>{pending ? 'Đang đăng xuất…' : 'Đăng xuất'}</button>
            {error && <p role="alert">{error}</p>}
          </> : <>
            <span className="guest-mode">{failure ? 'CHƯA XÁC MINH PHIÊN' : 'CHẾ ĐỘ KHÁCH'}</span>
            <h2>Bắt đầu từ một lựa chọn.</h2>
            <p>Tạo tài khoản để sẵn sàng tham gia những phiên đấu giá bạn yêu thích.</p>
            <Link to="/login" className="guest-primary">Đăng nhập</Link>
            <Link to="/register" className="guest-secondary">Tạo tài khoản <span aria-hidden="true">↗</span></Link>
          </>}
          {failure && <><p role="alert">{failure}</p><button className="guest-secondary" onClick={() => void refresh()}>Thử lại</button></>}
        </div>
      </aside>
      <div className="guest-workspace"><Outlet /></div>
    </div>
  );
}
