import { Link, NavLink, Outlet } from 'react-router-dom';
import './guest.css';

export default function AppLayout() {
  return (
    <div className="guest-shell">
      <button className="guest-skip" onClick={() => document.getElementById('main-content')?.focus()}>Đến nội dung chính</button>
      <aside className="guest-sidebar" aria-label="Thanh điều hướng">
        <Link to="/" className="guest-brand"><span aria-hidden="true">b.</span>OnlineBidFlow</Link>
        <p className="guest-nav-label">KHÔNG GIAN ĐẤU GIÁ</p>
        <nav aria-label="Điều hướng chính">
          <NavLink to="/" end className={({ isActive }) => isActive ? 'guest-nav active' : 'guest-nav'}><span aria-hidden="true">▦</span> Khám phá</NavLink>
        </nav>
        <div className="guest-account">
          <span className="guest-mode">CHẾ ĐỘ KHÁCH</span>
          <h2>Bắt đầu từ một lựa chọn.</h2>
          <p>Tạo tài khoản để sẵn sàng tham gia những phiên đấu giá bạn yêu thích.</p>
          <button className="guest-primary" disabled aria-describedby="login-note">Đăng nhập</button>
          <Link to="/register" className="guest-secondary">Tạo tài khoản <span aria-hidden="true">↗</span></Link>
          <small id="login-note">Đăng nhập sẽ sớm khả dụng.</small>
        </div>
      </aside>
      <div className="guest-workspace"><Outlet /></div>
    </div>
  );
}
