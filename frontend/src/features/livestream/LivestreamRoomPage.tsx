import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { validateAmount } from '../wallet/validation';
import { availableCoin } from './liveState';
import { useLiveNow, useLivestream, useLiveRoom, liveSaleEffect } from './useLivestream';
import { coin, LiveAccess, LivePage, LotQueue } from './LiveShared';
import Gavel from './Gavel';
import LiveCamera from './LiveCamera';
import { useLiveVideo, RemoteLiveVideo } from './useLiveVideo';
import EndLiveDialog from './EndLiveDialog';
import Grandstand from './Grandstand';
import LiveNotice from './LiveNotice';
import ViewerLiveSummary from './ViewerLiveSummary';

export default function LivestreamRoomPage({ host = false }: { host?: boolean }) {
  return host ? (
    <LiveAccess admin>
      <Room host />
    </LiveAccess>
  ) : (
    <LiveAccess>
      <Room />
    </LiveAccess>
  );
}

function Room({ host = false }: { host?: boolean }) {
  const { id } = useParams();
  const { user } = useAuth();
  const { state, act, error, pending, connected, connectionStatus } = useLivestream();
  const now = useLiveNow();
  const navigate = useNavigate();
  const session = state.sessions.find((item) => item.id === id);
  const lot = session?.lots[session.currentLotIndex];
  const [amount, setAmount] = useState('');
  const [chat, setChat] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [selectedLotId, setSelectedLotId] = useState('');

  useLiveRoom(id);
  const media = useLiveVideo(session, host, connected);
  useEffect(() => {
    setAmount('');
    setNotice('');
    setSelectedLotId('');
  }, [lot?.id]);

  if (!session || !lot)
    return (
      <LivePage host={host}>
        <div className="live-empty">
          <h1>Không tìm thấy phòng live</h1>
          <Link to={host ? '/admin/livestream' : '/livestream'}>Về danh sách phiên</Link>
        </div>
      </LivePage>
    );
  if (host && session.hostId !== String(user?.id))
    return (
      <LivePage host>
        <p className="live-error">Chỉ host tạo phiên được điều khiển.</p>
      </LivePage>
    );
  const isOpen = session.status === 'LIVE' && lot.status === 'OPEN';
  const sold = lot.status === 'SOLD';
  const inProgress = isOpen && lot.leaderId !== null;
  const remaining = sold
    ? 0
    : session.status === 'PAUSED'
      ? (session.remainingMs ?? 5000)
      : lot.deadline === null
        ? 5000
        : Math.max(0, Math.min(5000, lot.deadline - now));
  const ownLeader = lot.leaderId === String(user?.id);
  const won = !host && sold && ownLeader;
  const minimum = lot.leaderId ? (BigInt(lot.currentPrice) + 1n).toString() : lot.startingPrice;
  const canBid =
    connected && !host && user?.role === 'USER' && isOpen && !ownLeader && remaining > 0;
  const resultId = sold ? liveSaleEffect(session.id, lot.id) : null;
  const selectableLots = session.lots.filter(
    (item) => item.id !== lot.id && (item.status === 'QUEUED' || item.status === 'UNSOLD')
  );
  const selection = selectableLots.some((item) => item.id === selectedLotId) ? selectedLotId : '';
  const endedViewer = !host && session.status === 'ENDED';

  async function bid(event: React.FormEvent) {
    event.preventDefault();
    if (!session) return;
    if (await act({ type: 'BID', sessionId: session.id, amount })) {
      setAmount('');
      setNotice('Đã nhận giá của bạn. Đồng hồ bắt đầu lại từ 5 giây.');
    }
  }
  async function sendChat(event: React.FormEvent) {
    event.preventDefault();
    if (session && (await act({ type: 'CHAT', sessionId: session.id, text: chat }))) setChat('');
  }
  return (
    <LivePage host={host} showRules={!endedViewer}>
      <Gavel
        resultId={resultId}
        winnerName={lot.leaderName ?? ''}
        amount={lot.currentPrice}
        productName={lot.name}
      />
      {endedViewer ? (
        <ViewerLiveSummary session={session} userId={String(user?.id)} />
      ) : (
        <>
          <section className="live-heading live-room-heading">
            <div>
              <Link className="live-back" to={host ? '/admin/livestream' : '/livestream'}>
                ← {host ? 'Phiên livestream' : 'Danh sách livestream'}
              </Link>
              <p className="guest-kicker">
                {host ? 'PHÒNG ĐIỀU KHIỂN CỦA HOST' : 'PHÒNG ĐẤU GIÁ TRỰC TIẾP'}
              </p>
              <h1>{session.title}</h1>
              <p>
                {session.hostName} · {session.participants.length} người trong phòng
              </p>
            </div>
            <div className="live-actions">
              {host ? (
                <>
                  <Link
                    className="live-secondary"
                    to={'/admin/livestream/' + session.id + '/results'}
                  >
                    Kết quả phiên
                  </Link>
                  <button
                    type="button"
                    className="live-secondary"
                    disabled={session.status === 'ENDED' || pending}
                    onClick={() => setConfirmEnd(true)}
                  >
                    Kết thúc live
                  </button>
                </>
              ) : user?.role === 'USER' ? (
                <div className="live-room-balance">
                  <span>Coin khả dụng</span>
                  <strong>{coin(availableCoin(state, String(user.id)))}</strong>
                  <Link to="/livestream/purchases">Món đã thắng →</Link>
                </div>
              ) : user?.role === 'ADMIN' ? (
                <Link className="live-primary" to={'/admin/livestream/' + session.id}>
                  Đến phòng điều khiển
                </Link>
              ) : (
                <Link className="live-primary" to="/login">
                  Đăng nhập để đặt giá
                </Link>
              )}
            </div>
          </section>
          <div
            className={'live-room-connection' + (connected ? ' is-connected' : '')}
            role="status"
          >
            <span className="live-connection-dot" aria-hidden="true" />
            <span>{connectionStatus}</span>
          </div>
          {media.error && (
            <LiveNotice
              tone="warning"
              title="Kết nối video"
              action={
                <button type="button" className="live-secondary" onClick={media.reconnect}>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M20 7v5h-5M4 17v-5h5" />
                    <path d="M6.1 7a7 7 0 0 1 11.5-1L20 9M4 15l2.4 3A7 7 0 0 0 17.9 17" />
                  </svg>
                  Kết nối lại video
                </button>
              }
            >
              {media.error}
            </LiveNotice>
          )}
          {session.status === 'PAUSED' && (
            <LiveNotice
              tone="warning"
              title="Phiên đang tạm dừng"
              action={
                host ? (
                  <button
                    className="live-primary"
                    disabled={pending || !connected || !session.publisherReady}
                    onClick={() => void act({ type: 'RESUME', sessionId: session.id })}
                  >
                    Tiếp tục đấu
                  </button>
                ) : undefined
              }
            >
              Phiên tạm dừng. Chờ host trở lại trong tối đa 5 phút. Thời gian đấu được giữ nguyên.
            </LiveNotice>
          )}
          {session.status === 'ENDED' && (
            <LiveNotice tone="success" title="Đã kết thúc phiên">
              Phiên đã kết thúc. Các kết quả đã chốt được lưu bên dưới.
            </LiveNotice>
          )}
          {session.status === 'SCHEDULED' && (
            <LiveNotice title={host ? 'Chuẩn bị lên sóng' : 'Đang chờ bắt đầu'}>
              {host
                ? 'Kiểm tra camera và danh sách hàng trước khi mở live.'
                : 'Phiên chưa bắt đầu. Bạn có thể đăng ký nhắc tại trang thông tin phiên.'}
            </LiveNotice>
          )}
          {error && (
            <LiveNotice tone="error" title="Chưa thực hiện được thao tác">
              {error}
            </LiveNotice>
          )}
          <div className={'live-room-grid' + (host ? ' live-host-grid' : '')}>
            <div className="live-stage-column">
              {host && session.status !== 'ENDED' ? (
                <LiveCamera title={session.hostName} onStreamChange={media.onStreamChange} />
              ) : (
                <RemoteLiveVideo stream={media.remote} />
              )}
              <div className="live-current-product">
                <p className="live-muted">
                  Món {session.currentLotIndex + 1} / {session.lots.length} ·{' '}
                  {sold
                    ? 'Đã chốt'
                    : lot.status === 'PRESENTING'
                      ? 'Đang giới thiệu'
                      : lot.status === 'UNSOLD'
                        ? 'Chưa bán'
                        : isOpen
                          ? 'Đang đấu'
                          : 'Chờ đấu'}
                </p>
                <h2>{lot.name}</h2>
                <p>{lot.description}</p>
              </div>
              <Grandstand
                session={session}
                leaderId={lot.status === 'OPEN' ? lot.leaderId : null}
              />
              <section className="live-panel">
                <h2>{host ? 'Hàng chờ đấu giá' : 'Sản phẩm trong phiên'}</h2>
                <LotQueue
                  session={session}
                  disabled={inProgress || pending}
                  onReopen={
                    host
                      ? (lotId) => void act({ type: 'REOPEN', sessionId: session.id, lotId })
                      : undefined
                  }
                />
              </section>
            </div>
            <aside className="live-bid-column">
              <section className="live-panel live-bid-panel">
                <div className="live-price-heading">
                  <p>{sold ? 'Giá chốt' : lot.leaderId ? 'Giá hiện tại' : 'Giá khởi điểm'}</p>
                  <strong data-testid="live-current-price">{coin(lot.currentPrice)}</strong>
                </div>
                <div
                  className={
                    'live-countdown' + (inProgress && remaining <= 2000 ? ' is-urgent' : '')
                  }
                >
                  <div>
                    <span>
                      {session.status === 'ENDED'
                        ? 'Phiên đã kết thúc'
                        : sold
                          ? 'Đã chốt giá'
                          : lot.status === 'PRESENTING' || session.status === 'SCHEDULED'
                            ? 'Đang chờ host mở đấu'
                            : lot.leaderId
                              ? 'Thời gian chốt giá'
                              : 'Chờ lượt đặt đầu tiên'}
                    </span>
                    <strong data-testid="live-countdown">
                      {(Math.ceil(remaining / 100) / 10).toLocaleString('vi-VN', {
                        minimumFractionDigits: 1
                      })}
                      <small> s</small>
                    </strong>
                  </div>
                  <div className="live-countdown-track" aria-hidden="true">
                    <span style={{ transform: 'scaleX(' + remaining / 5000 + ')' }} />
                  </div>
                </div>
                <div className={'live-winner' + (sold ? ' is-sold' : '')} role="status">
                  <span>{won ? 'Kết quả của bạn' : sold ? 'Người thắng' : 'Người dẫn đầu'}</span>
                  <strong className={won ? 'live-win-confirmation' : undefined}>
                    {won ? (
                      <>
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <circle cx="12" cy="12" r="9" />
                          <path d="m8 12 3 3 5-6" />
                        </svg>
                        <span>Bạn đã thắng</span>
                      </>
                    ) : (
                      (lot.leaderName ?? 'Chưa có lượt đặt giá')
                    )}
                  </strong>
                  {sold && (
                    <p>
                      {won ? 'Giá chốt: ' : 'Đã chốt với '}
                      {coin(lot.currentPrice)}
                    </p>
                  )}
                </div>
                {host ? (
                  <div className="live-host-actions">
                    {session.status === 'SCHEDULED' && (
                      <button
                        className="live-primary"
                        type="button"
                        disabled={pending || !connected}
                        onClick={() => void act({ type: 'START', sessionId: session.id })}
                      >
                        Bắt đầu live
                      </button>
                    )}
                    {session.status === 'LIVE' && lot.status === 'PRESENTING' && (
                      <button
                        className="live-primary"
                        type="button"
                        disabled={pending || !connected}
                        onClick={() => void act({ type: 'OPEN', sessionId: session.id })}
                      >
                        Mở đấu giá sản phẩm
                      </button>
                    )}
                    {session.status !== 'ENDED' && selectableLots.length > 0 && (
                      <div className="live-lot-selection">
                        <label htmlFor="live-next-lot">Chọn sản phẩm đưa lên lần này</label>
                        <select
                          id="live-next-lot"
                          value={selection}
                          disabled={
                            pending || !connected || inProgress || session.status === 'PAUSED'
                          }
                          onChange={(event) => setSelectedLotId(event.target.value)}
                        >
                          <option value="">Chọn sản phẩm…</option>
                          {selectableLots.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                              {item.status === 'UNSOLD' ? ' · Chưa bán' : ''}
                            </option>
                          ))}
                        </select>
                        <button
                          className="live-secondary"
                          type="button"
                          disabled={
                            !selection ||
                            pending ||
                            !connected ||
                            inProgress ||
                            session.status === 'PAUSED'
                          }
                          onClick={() =>
                            void act({ type: 'SELECT', sessionId: session.id, lotId: selection })
                          }
                        >
                          Đưa lên
                        </button>
                        {session.status === 'PAUSED' && (
                          <p className="live-field-hint">Tiếp tục đấu để chuyển sản phẩm.</p>
                        )}
                      </div>
                    )}
                    {session.status === 'LIVE' && inProgress && (
                      <p className="live-muted">
                        Kết quả tự chốt khi hết 5 giây. Mỗi giá mới hợp lệ bắt đầu lại đồng hồ.
                      </p>
                    )}
                    {session.status === 'LIVE' && !selectableLots.length && !inProgress && (
                      <p className="live-muted">
                        Không còn món khác chờ đấu. Bạn có thể kết thúc live sau khi xử lý món hiện
                        tại.
                      </p>
                    )}
                  </div>
                ) : (
                  <form onSubmit={(event) => void bid(event)} className="live-bid-form">
                    <label htmlFor="live-bid-amount">Giá của bạn (Coin)</label>
                    <input
                      id="live-bid-amount"
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={19}
                      value={amount}
                      disabled={!canBid || pending}
                      onChange={(event) => setAmount(event.target.value)}
                      placeholder={minimum}
                      aria-describedby="live-bid-rule"
                      required
                    />
                    <p id="live-bid-rule" className="live-field-hint">
                      {lot.leaderId
                        ? 'Giá mới lớn hơn ' + coin(lot.currentPrice) + '. Bạn tự chọn mức trả.'
                        : 'Lượt đầu từ ' + coin(lot.startingPrice) + '.'}
                    </p>
                    <button className="live-primary" type="submit" disabled={!canBid || pending}>
                      {pending
                        ? 'Đang gửi…'
                        : sold
                          ? 'Đã chốt giá'
                          : ownLeader && isOpen
                            ? 'Bạn đang dẫn đầu'
                            : !user
                              ? 'Đăng nhập để đặt giá'
                              : !isOpen
                                ? 'Chưa mở đấu giá'
                                : amount && !validateAmount(amount)
                                  ? 'Đặt ' + coin(amount)
                                  : 'Đặt giá'}
                    </button>
                  </form>
                )}
                {!host && notice && !sold && (
                  <p className="live-success live-compact" role="status">
                    {notice}
                  </p>
                )}
                {won && (
                  <Link className="live-secondary live-result-link" to="/livestream/purchases">
                    Xem món đã thắng
                  </Link>
                )}
              </section>
              <section className="live-panel live-chat">
                <h2>Trò chuyện</h2>
                <div className="live-messages" aria-label="Tin nhắn trong phòng">
                  {!session.messages.length && (
                    <p className="live-muted">Cùng chào host và những người đang xem live.</p>
                  )}
                  {session.messages.slice(-8).map((message) => (
                    <p key={message.id}>
                      <strong>{message.username}</strong>
                      <span>{message.text}</span>
                    </p>
                  ))}
                </div>
                <form onSubmit={(event) => void sendChat(event)}>
                  <label className="live-sr-only" htmlFor="live-chat-input">
                    Tin nhắn
                  </label>
                  <input
                    id="live-chat-input"
                    maxLength={500}
                    required
                    value={chat}
                    disabled={
                      !user || !['LIVE', 'PAUSED'].includes(session.status) || !connected || pending
                    }
                    onChange={(event) => setChat(event.target.value)}
                    placeholder={user ? 'Gửi lời cổ vũ…' : 'Đăng nhập để trò chuyện'}
                  />
                  <button
                    className="live-secondary"
                    disabled={
                      !user ||
                      !['LIVE', 'PAUSED'].includes(session.status) ||
                      !connected ||
                      pending ||
                      !chat.trim()
                    }
                    type="submit"
                  >
                    Gửi
                  </button>
                </form>
              </section>
              <details className="live-panel live-bid-history">
                <summary>Lịch sử trả giá ({lot.bids.length})</summary>
                {!lot.bids.length ? (
                  <p className="live-muted">Chưa có lượt đặt giá.</p>
                ) : (
                  <ol>
                    {lot.bids
                      .slice(-10)
                      .reverse()
                      .map((item) => (
                        <li key={item.id}>
                          <span>{item.username}</span>
                          <strong>{coin(item.amount)}</strong>
                        </li>
                      ))}
                  </ol>
                )}
              </details>
            </aside>
          </div>
          {host && confirmEnd && (
            <EndLiveDialog
              session={session}
              pending={pending}
              error={error}
              onClose={() => setConfirmEnd(false)}
              onConfirm={async () => {
                if (await act({ type: 'END', sessionId: session.id }))
                  navigate('/admin/livestream/' + session.id + '/results');
              }}
            />
          )}
        </>
      )}
    </LivePage>
  );
}
