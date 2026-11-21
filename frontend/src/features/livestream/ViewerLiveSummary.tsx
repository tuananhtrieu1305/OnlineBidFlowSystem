import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { coin, lotLabels, ProductThumbnail } from './LiveShared';
import type { LiveSession } from './liveState';

export default function ViewerLiveSummary({
  session,
  userId
}: {
  session: LiveSession;
  userId: string;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const sold = session.lots.filter((lot) => lot.status === 'SOLD');
  const won = sold.filter((lot) => lot.leaderId === userId);
  const total = won.reduce((sum, lot) => sum + BigInt(lot.currentPrice), 0n).toString();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    heading.current?.focus({ preventScroll: true });
  }, [session.id]);

  return (
    <section className="live-ended-summary" aria-labelledby="live-ended-title">
      <Link className="live-back" to="/livestream">
        ← Danh sách livestream
      </Link>
      <div className="live-ended-hero">
        <span className="live-ended-seal" aria-hidden="true">
          <svg
            width="30"
            height="30"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="m8 12 3 3 5-6" />
          </svg>
        </span>
        <p className="live-ended-kicker">CẢM ƠN BẠN ĐÃ THAM GIA</p>
        <h1 ref={heading} tabIndex={-1} id="live-ended-title">
          Phiên livestream đã kết thúc
        </h1>
        <p className="live-ended-session">
          {session.title} <span>· Host {session.hostName}</span>
        </p>
        <p className="live-ended-description">
          Phiên đã khép lại. Cùng xem kết quả và những món bạn đã giành được.
        </p>
        <div className="live-actions">
          <Link className="live-primary" to="/livestream">
            Khám phá phiên khác
          </Link>
          {won.length > 0 && (
            <Link className="live-secondary" to="/livestream/purchases">
              Xem món đã thắng
            </Link>
          )}
        </div>
      </div>

      <div className="live-ended-overview">
        <dl className="live-ended-stats" aria-label="Tổng kết phiên">
          <div>
            <dt>Sản phẩm trong phiên</dt>
            <dd>{session.lots.length}</dd>
          </div>
          <div>
            <dt>Đã bán</dt>
            <dd>{sold.length}</dd>
          </div>
          <div>
            <dt>Chưa bán</dt>
            <dd>{session.lots.filter((lot) => lot.status === 'UNSOLD').length}</dd>
          </div>
        </dl>
        <section className="live-ended-personal" aria-label="Kết quả của bạn">
          <span className="live-ended-personal-icon" aria-hidden="true">
            {won.length > 0 ? '✓' : '◇'}
          </span>
          <div>
            <h2>
              {won.length > 0 ? `Bạn đã thắng ${won.length} món` : 'Hẹn bạn ở phiên tiếp theo'}
            </h2>
            <p>
              {won.length > 0 ? (
                <>
                  Tổng giá chốt <strong>{coin(total)}</strong>
                </>
              ) : (
                'Bạn chưa thắng món nào trong phiên này. Khám phá thêm những phiên sắp diễn ra nhé.'
              )}
            </p>
          </div>
          {won.length > 0 && <Link to="/wallet">Xem ví →</Link>}
        </section>
      </div>

      <section className="live-ended-results" aria-labelledby="live-ended-results-title">
        <div className="live-ended-results-heading">
          <h2 id="live-ended-results-title">Kết quả sản phẩm</h2>
          <span>{session.lots.length} món trong phiên</span>
        </div>
        <ul aria-label="Kết quả sản phẩm trong phiên">
          {session.lots.map((lot) => {
            const own = lot.status === 'SOLD' && lot.leaderId === userId;
            return (
              <li key={lot.id} className={own ? 'is-own-win' : ''}>
                <div className="live-ended-product-image">
                  <ProductThumbnail lot={lot} />
                </div>
                <div className="live-ended-product-body">
                  <span
                    className={'live-ended-lot-status' + (lot.status === 'SOLD' ? ' is-sold' : '')}
                  >
                    {own ? '✓ Bạn đã thắng' : lotLabels[lot.status]}
                  </span>
                  <h3>{lot.name}</h3>
                  {lot.status === 'SOLD' ? (
                    <>
                      <p className="live-ended-product-price">{coin(lot.currentPrice)}</p>
                      <p>
                        {own
                          ? 'Món này đã có trong danh sách món bạn thắng.'
                          : `Người thắng: ${lot.leaderName ?? '—'}`}
                      </p>
                    </>
                  ) : (
                    <p>Giá khởi điểm {coin(lot.startingPrice)}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </section>
  );
}
