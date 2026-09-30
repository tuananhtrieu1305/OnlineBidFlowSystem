import { useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../AuthProvider';
import CollectionArtwork from '../components/CollectionArtwork';
import '../registration.css';

export default function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState('');
  const busy = useRef(false);
  const usernameInput = useRef<HTMLInputElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  if (!auth.loading && auth.user) return <Navigate to={auth.user.role === 'ADMIN' ? '/admin' : '/'} replace />;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy.current) return;
    if (!username.trim() || !password) {
      setFailure('Vui lòng nhập tên đăng nhập và mật khẩu.');
      (!username.trim() ? usernameInput : passwordInput).current?.focus();
      return;
    }
    busy.current = true; setPending(true); setFailure('');
    try {
      const user = await auth.login(username, password);
      setPassword('');
      navigate(user.role === 'ADMIN' ? '/admin' : '/', { replace: true });
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      setFailure(status === 401 ? 'Tên đăng nhập hoặc mật khẩu không đúng.'
        : status === 429 ? 'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau một phút.'
        : status === 403 ? 'Phiên xác thực đã hết hạn. Vui lòng đăng nhập lại.'
        : status === 400 ? 'Thông tin đăng nhập không hợp lệ.'
        : status ? 'Máy chủ chưa thể đăng nhập. Vui lòng thử lại sau.'
        : 'Chưa nhận được xác nhận đăng nhập. Kiểm tra kết nối và thử lại.');
      setPassword(''); passwordInput.current?.focus();
    } finally { busy.current = false; setPending(false); }
  }
  return (
    <div className="registration-shell">
      <header className="registration-header">
        <Link to="/" className="registration-brand"><span className="brand-symbol" aria-hidden="true">b<span>.</span></span>OnlineBidFlow</Link>
        <Link to="/" className="back-link">← Về khám phá</Link>
      </header>
      <main className="registration-main">
        <aside className="registration-story" aria-label="Khám phá OnlineBidFlow">
          <div className="story-intro"><span className="eyebrow">TIẾP NỐI ĐIỀU BẠN YÊU THÍCH</span><h2>Bộ sưu tập của bạn.<br/>Câu chuyện còn tiếp.</h2><p>Trở lại để khám phá những món đồ đáng giữ lại.<br/>Lựa chọn tiếp theo đang chờ bạn.</p></div>
          <div className="collection-frame"><CollectionArtwork/><div className="collection-caption"><span>GÓC SƯU TẦM</span><span>Âm thanh của những ngày chậm rãi ↗</span></div></div>
        </aside>
        <section className="registration-panel" aria-labelledby="login-title">
          <span className="eyebrow">ĐĂNG NHẬP ONLINEBIDFLOW</span>
          <h1 id="login-title">Chào mừng bạn trở lại.</h1>
          <p className="form-intro">Đăng nhập để tiếp tục hành trình của bạn.</p>
          <form onSubmit={submit} noValidate aria-busy={pending}>
            <div className="registration-field"><label htmlFor="login-username">Tên đăng nhập</label>
              <input ref={usernameInput} id="login-username" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={50} value={username} disabled={pending} onChange={e => { setUsername(e.target.value); setFailure(''); }} placeholder="Tên đăng nhập của bạn"/>
            </div>
            <div className="registration-field"><label htmlFor="login-password">Mật khẩu</label>
              <div className="password-input"><input ref={passwordInput} id="login-password" autoComplete="current-password" type={visible ? 'text' : 'password'} value={password} disabled={pending} onChange={e => { setPassword(e.target.value); setFailure(''); }} placeholder="Mật khẩu của bạn"/>
                <button type="button" aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? 'Ẩn' : 'Hiện'}</button>
              </div>
            </div>
            {failure && <div className="registration-error" role="alert">{failure}</div>}
            <button className="registration-submit" type="submit" disabled={pending}>{pending ? 'Đang đăng nhập…' : 'Đăng nhập'}<span aria-hidden="true">→</span></button>
          </form>
          <p className="auth-switch">Chưa có tài khoản? <Link to="/register">Tạo tài khoản</Link></p>
          <div className="registration-coin-note"><span className="coin-symbol" aria-hidden="true">C</span><p><strong>Một tài khoản, một ví Coin riêng</strong><br/>Coin là đơn vị giả lập, chỉ sử dụng trong hệ thống.</p></div>
        </section>
      </main>
      <footer className="registration-footer"><span>OnlineBidFlow · Đấu giá theo cách của bạn.</span><span>Khám phá. Định giá. Sưu tầm.</span></footer>
    </div>
  );
}
