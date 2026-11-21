import { useId } from 'react';
import type { LiveSession } from './liveState';

function Chair({ occupied }: { occupied: boolean }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg className="live-chair" viewBox="0 0 120 128" aria-hidden="true">
      <defs>
        <linearGradient id={id + 'wood'} x2="1" y2="1">
          <stop stopColor="#b17b47" />
          <stop offset=".5" stopColor="#774827" />
          <stop offset="1" stopColor="#4d2e1d" />
        </linearGradient>
        <linearGradient id={id + 'fabric'} x2="0" y2="1">
          <stop stopColor={occupied ? '#3a8a7b' : '#d7c9b5'} />
          <stop offset="1" stopColor={occupied ? '#14574e' : '#a99a84'} />
        </linearGradient>
        <linearGradient id={id + 'seat'} x2="0" y2="1">
          <stop stopColor={occupied ? '#6cab99' : '#e7dac7'} />
          <stop offset="1" stopColor={occupied ? '#28695c' : '#b5a68e'} />
        </linearGradient>
      </defs>
      <ellipse cx="60" cy="119" rx="46" ry="6" fill="#50371f" opacity=".14" />
      <g fill={'url(#' + id + 'wood)'}>
        <path d="M24 88h10l-4 31h-7zm62 0h10l1 31h-7z" />
        <path d="M30 64h8l-2 42h-6zm52 0h8v42h-6z" />
        <path d="M24 25Q24 10 40 9h40q16 1 16 16l-4 57H28z" />
      </g>
      <path
        d="M30 28q0-12 12-12h36q12 0 12 12l-3 50H33z"
        fill={'url(#' + id + 'fabric)'}
        stroke={occupied ? '#1b5c50' : '#ac9a82'}
      />
      <path d="M36 30q0-8 8-8h32q8 0 8 8l-2 39H38z" fill="none" stroke="#fff" opacity=".16" />
      <path d="M29 76l62 0 10 19q0 9-11 10H30q-11-1-11-10z" fill={'url(#' + id + 'wood)'} />
      <path d="M35 71h50l11 19q-2 7-12 7H36q-10 0-12-7z" fill={'url(#' + id + 'seat)'} />
      <path d="M27 91q33 7 66 0" fill="none" stroke="#fff" opacity=".2" />
      <g fill={'url(#' + id + 'wood)'}>
        <path d="M16 57q0-5 6-5h9v43H20zM89 52h9q6 0 6 5l-4 38H89z" />
        <rect x="12" y="50" width="25" height="10" rx="5" />
        <rect x="83" y="50" width="25" height="10" rx="5" />
      </g>
      <path
        d="M17 53h15m56 0h15"
        stroke="#d9b48a"
        strokeWidth="2"
        strokeLinecap="round"
        opacity=".6"
      />
    </svg>
  );
}

export default function Grandstand({
  session,
  leaderId
}: {
  session: LiveSession;
  leaderId: string | null;
}) {
  const seats = session.participants.slice(0, 10);
  return (
    <section className="live-panel live-grandstand">
      <div className="live-section-title">
        <div>
          <p className="live-audience-kicker">CÙNG THEO DÕI PHIÊN ĐẤU GIÁ</p>
          <h2>Khán đài</h2>
        </div>
        <span className="live-audience-count">
          <i aria-hidden="true" />
          {session.participants.length} người
        </span>
      </div>
      <div className="live-audience-floor">
        <div className="live-audience-stage" aria-hidden="true">
          <span>HƯỚNG SÂN KHẤU</span>
        </div>
        <ol aria-label="Chỗ ngồi của người tham gia">
          {Array.from({ length: 10 }, (_, index) => {
            const person = seats[index];
            const leading = !!person && person.id === leaderId;
            return (
              <li
                key={person?.id ?? 'empty-' + index}
                className={(person ? 'is-occupied' : 'is-empty') + (leading ? ' is-leading' : '')}
                aria-label={person ? undefined : 'Ghế trống'}
              >
                <div className="live-seat-art">
                  <Chair occupied={!!person} />
                  {person && (
                    <span className="live-seat-avatar" aria-hidden="true">
                      {Array.from(person.username.trim())[0]?.toLocaleUpperCase('vi-VN')}
                    </span>
                  )}
                </div>
                <span className="live-seat-name" title={person?.username}>
                  {person?.username ?? 'Ghế trống'}
                </span>
                {leading && <small>Đang dẫn</small>}
              </li>
            );
          })}
        </ol>
      </div>
      <div className="live-audience-legend" aria-hidden="true">
        <span>
          <i />
          Đã có người
        </span>
        <span>
          <i />
          Ghế trống
        </span>
      </div>
      {session.participants.length > 10 && (
        <p className="live-muted">Cùng {session.participants.length - 10} người khác đang xem.</p>
      )}
    </section>
  );
}
