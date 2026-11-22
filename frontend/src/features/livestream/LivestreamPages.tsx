import MysteryRules from './MysteryRules';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { availableCoin } from './liveState';
import { useLivestream, useLiveSession } from './useLivestream';
import {
  coin,
  liveDate,
  LiveAccess,
  LivePage,
  LotQueue,
  SessionCard,
  sessionLabels,
  SessionProductImage
} from './LiveShared';

export function LivestreamListPage({ registered = false }: { registered?: boolean }) {
  return registered ? (
    <LiveAccess>
      <SessionList registered />
    </LiveAccess>
  ) : (
    <SessionList />
  );
}

function SessionList({ registered = false }: { registered?: boolean }) {
  const { state } = useLivestream();
  const { user } = useAuth();
  const [filter, setFilter] = useState('');
  const ids = state.registrations[String(user?.id)] ?? [];
  const sessions = state.sessions.filter(
    (session) => (!registered || ids.includes(session.id)) && (!filter || session.status === filter)
  );
  return (
    <LivePage>
      <section className="live-heading">
        <div>
          <p className="guest-kicker">
            {registered ? 'HẸN GẶP TẠI PHÒNG LIVE' : 'XEM TRỰC TIẾP · ĐẶT GIÁ · SỞ HỮU'}
          </p>
          <h1>{registered ? 'Phiên đã đăng ký' : 'Đấu giá livestream'}</h1>
          <p>Xem host giới thiệu hàng, chọn mức giá của bạn và chờ tiếng búa chốt.</p>
        </div>
        <label className="live-filter">
          Trạng thái
          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="">Tất cả phiên</option>
            <option value="LIVE">Đang live</option>
            <option value="SCHEDULED">Sắp diễn ra</option>
            <option value="ENDED">Đã kết thúc</option>
          </select>
        </label>
      </section>
      {registered && sessions.some((session) => session.status === 'LIVE') && (
        <p className="live-success" role="status">
          Phiên bạn đăng ký đã mở. Chọn Vào xem live để tham gia.
        </p>
      )}
      {sessions.length ? (
        <div className="live-session-grid">
          {sessions.map((session) => (
            <SessionCard session={session} key={session.id} />
          ))}
        </div>
      ) : (
        <div className="live-panel live-empty">
          <h2>{registered ? 'Bạn chưa có phiên phù hợp' : 'Chưa có phiên ở trạng thái này'}</h2>
          <p>Khám phá danh sách live và đăng ký phiên bạn quan tâm.</p>
          <Link className="live-secondary" to="/livestream">
            Khám phá livestream
          </Link>
        </div>
      )}
    </LivePage>
  );
}

export function LivestreamDetailPage() {
  const { id } = useParams();
  useLiveSession(id);
  const { state, act, error, pending } = useLivestream();
  const { user } = useAuth();
  const session = state.sessions.find((item) => item.id === id);
  if (!session)
    return (
      <LivePage>
        <div className="live-empty">
          <h1>Không tìm thấy phiên livestream</h1>
          <Link to="/livestream">Về danh sách live</Link>
        </div>
      </LivePage>
    );
  const registered = (state.registrations[String(user?.id)] ?? []).includes(session.id);
  return (
    <LivePage>
      <div className="live-heading">
        <div>
          <Link className="live-back" to="/livestream">
            ← Danh sách livestream
          </Link>
          <p className="guest-kicker">{sessionLabels[session.status].toLocaleUpperCase('vi-VN')}</p>
          <h1>{session.title}</h1>
          <p>
            {session.hostName} · {liveDate(session.startsAt)}
          </p>
        </div>
        <div className="live-actions">
          {session.status !== 'SCHEDULED' && (
            <Link className="live-primary" to={'/livestream/' + session.id + '/room'}>
              {session.status === 'ENDED' ? 'Xem kết quả' : 'Vào phòng live'}
            </Link>
          )}
          {session.status !== 'ENDED' &&
            (user?.role === 'USER' ? (
              <button
                type="button"
                className="live-secondary"
                disabled={pending}
                onClick={() => void act({ type: 'REGISTER', sessionId: session.id })}
              >
                {registered ? 'Đã đăng ký · Hủy nhắc' : 'Đăng ký nhắc trong ứng dụng'}
              </button>
            ) : (
              !user && (
                <Link className="live-secondary" to="/login">
                  Đăng nhập để đăng ký
                </Link>
              )
            ))}
        </div>
      </div>
      {error && (
        <p className="live-error" role="alert">
          {error}
        </p>
      )}
      {session.mysteryEnabled && <MysteryRules />}
      <div className="live-detail-grid">
        <div>
          <div className="live-stage live-product-stage">
            <SessionProductImage session={session} />
            <span>Ảnh sản phẩm</span>
          </div>
          <section className="live-panel live-rules">
            <h2>Về phiên live</h2>
            <p>{session.description}</p>
            <h2>Luật đấu giá</h2>
            <p>
              Mỗi lượt đấu một sản phẩm. Lượt đầu từ giá khởi điểm, các lượt sau được nhập bất kỳ số
              Coin nguyên nào cao hơn giá hiện tại.
            </p>
            <p>
              Mỗi giá hợp lệ bắt đầu lại 5 giây. Hết giờ, người dẫn đầu thắng. Búa gõ ba lần khi
              chốt người thắng.
            </p>
            <p>Đăng ký sẽ nhắc bạn ở mục Phiên đã đăng ký khi mở ứng dụng.</p>
          </section>
        </div>
        <section className="live-panel">
          <h2>Danh sách sản phẩm</h2>
          <LotQueue session={session} />
        </section>
      </div>
    </LivePage>
  );
}

export function LivestreamPurchasesPage() {
  return (
    <LiveAccess>
      <Purchases />
    </LiveAccess>
  );
}

function Purchases() {
  const { user } = useAuth();
  const { state, error } = useLivestream();

  const orders = state.orders.filter((order) => order.userId === String(user?.id));

  const available = availableCoin(state, String(user?.id));
  return (
    <LivePage>
      <div className="live-heading">
        <div>
          <p className="guest-kicker">SAU TIẾNG BÚA CHỐT</p>
          <h1>Món đã thắng</h1>
          <p>Các món đã thắng được server tự thanh toán bằng Coin.</p>
        </div>
        <Link className="live-secondary" to="/livestream">
          Tiếp tục xem live
        </Link>
      </div>
      <div className="live-balances">
        <article>
          <p>Coin khả dụng</p>
          <strong>{coin(available)}</strong>
        </article>
        <article>
          <p>Coin tạm giữ</p>
          <strong>{coin(state.wallet?.lockedBalance ?? '0')}</strong>
        </article>
      </div>
      {error && (
        <p className="live-error" role="alert">
          {error}
        </p>
      )}
      {!orders.length ? (
        <div className="live-panel live-empty">
          <h2>Bạn chưa thắng sản phẩm nào</h2>
          <p>Những món bạn thắng trong phiên livestream sẽ xuất hiện ở đây.</p>
          <Link className="live-primary" to="/livestream">
            Tìm phiên đang live
          </Link>
        </div>
      ) : (
        <div className="live-orders">
          {orders.map((order) => (
            <article className="live-panel live-order" key={order.id}>
              <div>
                <p className="live-muted">
                  {state.sessions.find((session) => session.id === order.sessionId)?.title}
                </p>
                <h2>{order.name}</h2>
                <strong>{coin(order.amount)}</strong>
                <p>{order.paid ? 'Đã tự thanh toán Coin' : 'Chờ thanh toán · Coin đang tạm giữ'}</p>
              </div>
              <div className="live-order-actions">
                <Link className="live-secondary" to={'/livestream/' + order.sessionId + '/room'}>
                  Xem phiên
                </Link>
                <Link className="live-primary" to="/wallet">
                  Xem ví Coin
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </LivePage>
  );
}
