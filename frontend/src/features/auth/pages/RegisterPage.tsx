import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { registerAccount, type RegisteredUser } from '../api/authApi';
import { validateRegistration, type FieldErrors, type RegistrationFields } from '../validation';
import CollectionArtwork from '../components/CollectionArtwork';
import '../registration.css';

function Eye({ open }: { open: boolean }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{!open && <path d="m3 3 18 18"/>}</svg>;
}

export default function RegisterPage() {
  const [values, setValues] = useState<RegistrationFields>({ username: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [visible, setVisible] = useState({ password: false, confirmPassword: false });
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState('');
  const [user, setUser] = useState<RegisteredUser | null>(null);
  const inFlight = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const successTitle = useRef<HTMLHeadingElement>(null);

  function focusError(next: FieldErrors) {
    const first = (['username', 'password', 'confirmPassword'] as const).find((key) => next[key]);
    if (first) form.current?.querySelector<HTMLInputElement>(`#register-${first}`)?.focus();
  }
  function update(key: keyof RegistrationFields, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setFailure('');
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    const next = validateRegistration(values);
    setErrors(next);
    if (Object.keys(next).length) { focusError(next); return; }
    inFlight.current = true;
    setPending(true);
    setFailure('');
    try {
      const registered = await registerAccount(values.username, values.password);
      setValues({ username: '', password: '', confirmPassword: '' });
      setUser(registered);
      requestAnimationFrame(() => successTitle.current?.focus());
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        const duplicate = { username: 'Tên đăng nhập đã được sử dụng. Hãy chọn tên khác.' };
        setErrors(duplicate); focusError(duplicate);
      } else if (axios.isAxiosError(error) && error.response?.status === 429) {
        setFailure('Bạn đã thử quá nhiều lần. Vui lòng thử lại sau một phút.');
      } else if (axios.isAxiosError(error) && error.response?.status === 400) {
        setFailure('Thông tin chưa hợp lệ. Hãy kiểm tra lại tên đăng nhập và mật khẩu.');
      } else if (axios.isAxiosError(error) && error.response) {
        setFailure('Máy chủ chưa thể tạo tài khoản. Vui lòng thử lại sau.');
      } else {
        setFailure('Chưa nhận được xác nhận từ máy chủ. Kiểm tra kết nối; tài khoản có thể đã được tạo.');
      }
    } finally {
      inFlight.current = false; setPending(false);
    }
  }

  return (
    <div className="registration-shell">
      <header className="registration-header">
        <Link to="/" className="registration-brand" aria-label="OnlineBidFlow — Trang chủ"><span className="brand-symbol" aria-hidden="true">b<span>.</span></span>OnlineBidFlow</Link>
        <Link to="/" className="back-link"><span aria-hidden="true">←</span> Về trang chủ</Link>
      </header>
      <main className="registration-main">
        <aside className="registration-story" aria-label="Khám phá OnlineBidFlow">
          <div className="story-intro"><span className="eyebrow">DÀNH CHO NHỮNG ĐIỀU BẠN TRÂN TRỌNG</span>
            <h2>Mỗi món đồ.<br/>Một câu chuyện mới.</h2>
            <p>Khám phá những món đồ đáng giữ lại.<br/>Tìm giá trị của riêng bạn qua từng phiên đấu giá.</p>
          </div>
          <div className="collection-frame"><CollectionArtwork/><div className="collection-caption"><span>GÓC SƯU TẦM</span><span>Âm thanh của những ngày chậm rãi ↗</span></div></div>
          <div className="story-note"><span className="note-mark" aria-hidden="true">↗</span><p>Một nơi để khám phá.<br/><strong>Một cách để sở hữu điều bạn thích.</strong></p></div>
        </aside>
        <section className="registration-panel" aria-labelledby={user ? 'registration-success' : 'registration-title'}>
          {user ? (
            <div className="registration-success">
              <span className="success-icon" aria-hidden="true">✓</span>
              <span className="eyebrow">KHỞI ĐẦU MỚI</span>
              <h1 id="registration-success" ref={successTitle} tabIndex={-1}>Chào mừng, {user.username}.</h1>
              <p>Tài khoản và ví Coin của bạn đã được tạo.</p>
              <div className="wallet-summary"><span>Coin khả dụng<strong>0 <small>Coin</small></strong></span><span>Coin đang khóa<strong>0 <small>Coin</small></strong></span></div>
              <p className="success-note">Tài khoản đã sẵn sàng. Đăng nhập để tiếp tục.</p>
              <Link to="/login" className="registration-submit">Đăng nhập <span aria-hidden="true">→</span></Link>
            </div>
          ) : (
            <>
              <span className="eyebrow">CHÀO MỪNG ĐẾN ONLINEBIDFLOW</span>
              <h1 id="registration-title">Bắt đầu bộ sưu tập của bạn.</h1>
              <p className="form-intro">Tạo tài khoản để sẵn sàng cho phiên đấu giá đầu tiên.</p>
              <form ref={form} onSubmit={submit} noValidate aria-busy={pending}>
                <div className="registration-field"><label htmlFor="register-username">Tên đăng nhập</label>
                  <input id="register-username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="Ví dụ: batien" value={values.username} disabled={pending} maxLength={50} onChange={(e) => update('username', e.target.value)} aria-invalid={!!errors.username} aria-describedby={errors.username ? 'error-username' : 'username-hint'}/>
                  {errors.username ? <p className="field-error" id="error-username">{errors.username}</p> : <p className="field-hint" id="username-hint">3–50 ký tự. Dùng chữ không dấu, số hoặc . _ -</p>}
                </div>
                {(['password', 'confirmPassword'] as const).map((key) => (
                  <div className="registration-field" key={key}><label htmlFor={`register-${key}`}>{key === 'password' ? 'Mật khẩu' : 'Xác nhận mật khẩu'}</label>
                    <div className="password-input"><input id={`register-${key}`} name={key} type={visible[key] ? 'text' : 'password'} autoComplete="new-password" placeholder={key === 'password' ? 'Tạo mật khẩu của bạn' : 'Nhập lại mật khẩu'} value={values[key]} disabled={pending} onChange={(e) => update(key, e.target.value)} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `error-${key}` : key === 'password' ? 'password-hint' : undefined}/>
                      <button type="button" aria-label={`${visible[key] ? 'Ẩn' : 'Hiện'} ${key === 'password' ? 'mật khẩu' : 'mật khẩu xác nhận'}`} aria-pressed={visible[key]} onClick={() => setVisible((current) => ({ ...current, [key]: !current[key] }))}><Eye open={visible[key]}/></button>
                    </div>
                    {errors[key] ? <p className="field-error" id={`error-${key}`}>{errors[key]}</p> : key === 'password' && <p className="field-hint" id="password-hint">Ít nhất 12 ký tự. Nên dùng một cụm từ dễ nhớ.</p>}
                  </div>
                ))}
                {failure && <div className="registration-error" role="alert"><span aria-hidden="true">!</span>{failure}</div>}
                <button type="submit" className="registration-submit" disabled={pending}>{pending ? 'Đang tạo tài khoản…' : 'Tạo tài khoản'}<span aria-hidden="true">{pending ? '◌' : '→'}</span></button>
                <div className="registration-assurance"><svg width="17" height="19" viewBox="0 0 20 22" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="m10 2 7 3v6c0 4-4 7-7 9-3-2-7-5-7-9V5Z"/><path d="m6 10 3 3 5-6"/></svg><span>Mật khẩu được bảo vệ. Ví Coin được tạo tự động.</span></div>
              </form>
              <p className="auth-switch">Đã có tài khoản? <Link to="/login">Đăng nhập</Link></p>
              <div className="registration-coin-note"><span className="coin-symbol" aria-hidden="true">C</span><p><strong>Khởi đầu với ví Coin của riêng bạn</strong><br/>Coin là đơn vị giả lập, chỉ sử dụng trong hệ thống.</p></div>
            </>
          )}
        </section>
      </main>
      <footer className="registration-footer"><span>OnlineBidFlow · Đấu giá theo cách của bạn.</span><span>Khám phá. Định giá. Sưu tầm.</span></footer>
    </div>
  );
}
