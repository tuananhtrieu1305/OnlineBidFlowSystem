import { useLivestream } from './useLivestream';
import { useState, type ReactNode } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { formatCoin } from '../wallet/validation';
import { imageSource } from '../products/productApi';
import type { LiveLot, LiveSession } from './liveState';
import studio from './assets/studio.png';
import './livestream.css';

export { studio };
export const coin = (amount: string) => formatCoin(amount) + ' Coin';
export const liveDate = (time: number) =>
  new Date(time).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
export const sessionLabels = {
  LIVE: 'Đang live',
  PAUSED: 'Tạm dừng',
  SCHEDULED: 'Sắp diễn ra',
  ENDED: 'Đã kết thúc'
};
export const lotLabels = {
  QUEUED: 'Chờ đấu',
  PRESENTING: 'Đang giới thiệu',
  OPEN: 'Đang đấu',
  SOLD: 'Đã bán',
  UNSOLD: 'Chưa bán'
};

export function LivePage({
  children,
  host = false,
  showRules = true
}: {
  children: ReactNode;
  host?: boolean;
  showRules?: boolean;
}) {
  const { state, connectionStatus } = useLivestream();
  return (
    <main id="main-content" className="guest-home live-page" tabIndex={-1}>
      <header className="guest-topbar">
        <Link to={host ? '/admin/livestream' : '/livestream'}>
          {host ? 'Không gian quản trị / Livestream' : 'Khám phá / Livestream'}
        </Link>
        <span className="guest-topnote">OnlineBidFlow · Đấu giá trực tiếp</span>
      </header>
      {showRules && (
        <div className="live-sandbox">
          <span>Đấu giá trực tiếp</span>
          <p>Giá hợp lệ giữ Coin trong ví. Hết 5 giây, server chốt và tự thanh toán.</p>
        </div>
      )}
      {state.notifications?.map((n) => (
        <p className="live-notice" key={n.sessionId} role="status">
          Phiên bạn đã đăng ký đang mở:{' '}
          <Link to={'/livestream/' + n.sessionId + '/room'}>{n.title}</Link>
        </p>
      ))}
      {connectionStatus.startsWith('Chưa') && (
        <p className="live-error" role="alert">
          {connectionStatus}
        </p>
      )}
      {children}
    </main>
  );
}

export function LiveAccess({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { user, loading, failure } = useAuth();
  if (loading)
    return (
      <LivePage host={admin}>
        <p className="live-notice" role="status">
          Đang kiểm tra phiên đăng nhập…
        </p>
      </LivePage>
    );
  if (failure)
    return (
      <LivePage host={admin}>
        <p className="live-error" role="alert">
          Chưa xác minh được tài khoản. Hãy thử lại ở thanh bên.
        </p>
      </LivePage>
    );
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== 'ADMIN') return <Navigate to="/livestream" replace />;
  return <>{children}</>;
}

export function SessionCard({ session, host = false }: { session: LiveSession; host?: boolean }) {
  return (
    <article className="live-session-card">
      <div className="live-session-cover">
        <SessionProductImage session={session} />
        <span className={'live-badge live-badge-' + session.status.toLowerCase()}>
          {sessionLabels[session.status]}
        </span>
      </div>
      <div className="live-session-body">
        <p className="live-muted">
          {session.hostName} · {session.lots.length} sản phẩm
        </p>
        <h2>
          <Link to={host ? '/admin/livestream/' + session.id : '/livestream/' + session.id}>
            {session.title}
          </Link>
        </h2>
        <p className="live-description">{session.description}</p>
        <div className="live-session-footer">
          <span>{liveDate(session.startsAt)}</span>
          <Link
            className="live-primary"
            to={
              host
                ? '/admin/livestream/' + session.id
                : '/livestream/' + session.id + (session.status === 'LIVE' ? '/room' : '')
            }
          >
            {host ? 'Điều khiển' : session.status === 'LIVE' ? 'Vào xem live' : 'Xem phiên'}
          </Link>
        </div>
      </div>
    </article>
  );
}

export function SessionProductImage({ session }: { session: LiveSession }) {
  const product = session.lots[session.currentLotIndex] ?? session.lots[0];
  const src = imageSource(product?.imageUrl ?? null);
  const [failed, setFailed] = useState<string | null>(null);
  if (src && failed !== src) {
    return (
      <img
        src={src}
        alt={product.name}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(src)}
      />
    );
  }
  const message = src && failed === src ? 'Không tải được ảnh sản phẩm' : 'Chưa có ảnh sản phẩm';
  return (
    <div
      className="live-product-cover-placeholder"
      role="img"
      aria-label={product ? `${message}: ${product.name}` : message}
    >
      <span aria-hidden="true">◇</span>
      <p>{message}</p>
      {product && <small>{product.name}</small>}
    </div>
  );
}

export function ProductThumbnail({ lot }: { lot: Pick<LiveLot, 'imageUrl' | 'name'> }) {
  const src = imageSource(lot.imageUrl);
  const [failed, setFailed] = useState<string | null>(null);
  return src && src !== failed ? (
    <img
      className="live-product-image"
      src={src}
      alt={lot.name}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(src)}
    />
  ) : (
    <span className="live-product-placeholder" aria-hidden="true">
      ◇
    </span>
  );
}

export function LotQueue({
  session,
  onReopen,
  disabled = false
}: {
  session: LiveSession;
  onReopen?: (lotId: string) => void;
  disabled?: boolean;
}) {
  return (
    <ol className="live-lots">
      {session.lots.map((lot, index) => (
        <li
          key={lot.id}
          className={
            session.currentLotIndex === index && session.status === 'LIVE' ? 'is-current' : ''
          }
        >
          <span className="live-lot-number">{index + 1}</span>
          <ProductThumbnail lot={lot} />
          <div>
            <strong>{lot.name}</strong>
            <p>
              {lot.status === 'SOLD'
                ? lot.leaderName + ' · ' + coin(lot.currentPrice)
                : lotLabels[lot.status] + ' · Khởi điểm ' + coin(lot.startingPrice)}
            </p>
          </div>
          {onReopen && lot.status === 'UNSOLD' && session.status === 'LIVE' && (
            <button
              className="live-secondary live-small"
              disabled={disabled}
              onClick={() => onReopen(lot.id)}
              type="button"
            >
              Đấu lại
            </button>
          )}
        </li>
      ))}
    </ol>
  );
}
