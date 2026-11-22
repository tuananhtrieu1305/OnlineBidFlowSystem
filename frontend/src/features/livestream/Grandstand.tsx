import { useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { LiveSession } from './liveState';

function Chair({ occupied, rear = false }: { occupied: boolean; rear?: boolean }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg className="live-chair" viewBox="0 0 120 128" aria-hidden="true">
      <defs>
        <linearGradient id={id + 'wood'} x2="1" y2="1">
          <stop stopColor={rear ? '#976b43' : '#b17b47'} />
          <stop offset=".5" stopColor={rear ? '#60432e' : '#774827'} />
          <stop offset="1" stopColor={rear ? '#32251c' : '#4d2e1d'} />
        </linearGradient>
        <linearGradient id={id + 'fabric'} x2="0" y2="1">
          <stop stopColor={occupied ? '#4a9075' : rear ? '#38634c' : '#d7c9b5'} />
          <stop offset=".4" stopColor={occupied ? '#35745b' : rear ? '#254b38' : '#c7b89f'} />
          <stop offset="1" stopColor={occupied ? '#1c5542' : rear ? '#132f24' : '#a99a84'} />
        </linearGradient>
        <linearGradient id={id + 'seat'} x2="0" y2="1">
          <stop stopColor={occupied ? '#6cab99' : '#e7dac7'} />
          <stop offset="1" stopColor={occupied ? '#28695c' : '#b5a68e'} />
        </linearGradient>
      </defs>
      <ellipse
        cx="60"
        cy="120"
        rx="43"
        ry="4"
        fill={rear ? '#050b07' : '#50371f'}
        opacity={rear ? '.48' : '.14'}
      />
      {rear ? (
        <>
          <g fill={'url(#' + id + 'wood)'}>
            <path d="M24 87h10l-4 32h-8zm62 0h10l2 32h-8z" />
            <path d="M23 28q0-15 16-17h42q16 2 16 17l-4 74H27z" />
            <path d="M16 62h17v31H20zm71 0h17l-4 31H87z" />
            <rect x="12" y="59" width="25" height="9" rx="4" />
            <rect x="83" y="59" width="25" height="9" rx="4" />
          </g>
          <path
            d="M30 30q0-12 12-12h36q12 0 12 12l-3 64H33z"
            fill={'url(#' + id + 'fabric)'}
            stroke={occupied ? '#b69c65' : '#9b81534d'}
          />
          <path
            d="M36 33q0-8 9-8h30q9 0 9 8l-2 53H38z"
            fill="none"
            stroke="#f9e8c4"
            opacity=".18"
          />
          <path
            d="M27 30q0-16 14-16h38q14 0 14 16"
            fill="none"
            stroke="#d5af73"
            strokeWidth="1.5"
            opacity=".35"
          />
          <path d="M30 98h60" stroke="#c59b6c" opacity=".5" />
          <g fill={occupied ? '#d3b676' : '#b394595e'}>
            <circle cx="47" cy="38" r="1.4" />
            <circle cx="73" cy="38" r="1.4" />
            <circle cx="47" cy="76" r="1.4" />
            <circle cx="73" cy="76" r="1.4" />
          </g>
        </>
      ) : (
        <>
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
        </>
      )}
    </svg>
  );
}

export default function Grandstand({
  session,
  leaderId,
  integrated = false
}: {
  session: LiveSession;
  leaderId: string | null;
  integrated?: boolean;
}) {
  const floor = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(5);
  useLayoutEffect(() => {
    const element = floor.current;
    if (!integrated || !element) return;
    const resize = () => {
      const spacing = matchMedia('(max-width: 1050px)').matches ? 72 : 90;
      const next = Math.max(5, Math.min(18, Math.floor(element.clientWidth / spacing)));
      setColumns((current) => (current === next ? current : next));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    window.addEventListener('resize', resize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, [integrated]);
  const seatCount = integrated ? columns * 3 : 10;
  const seats = session.participants.slice(0, seatCount);
  return (
    <section className={'live-grandstand' + (integrated ? ' is-integrated' : ' live-panel')}>
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
      <div className="live-audience-floor" ref={floor}>
        <div className="live-audience-stage" aria-hidden="true">
          <span>HƯỚNG SÂN KHẤU</span>
        </div>
        {integrated && (
          <div className="live-audience-terraces" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
        )}
        <ol
          aria-label="Chỗ ngồi của người tham gia"
          style={integrated ? ({ '--audience-columns': columns } as CSSProperties) : undefined}
        >
          {Array.from({ length: seatCount }, (_, index) => {
            const person = seats[index];
            const leading = !!person && person.id === leaderId;
            const row = Math.floor(index / (integrated ? columns : 5));
            const column = (index % columns) - (columns - 1) / 2;
            const perspective = column / Math.max(1, (columns - 1) / 2);
            return (
              <li
                key={person?.id ?? 'empty-' + index}
                className={(person ? 'is-occupied' : 'is-empty') + (leading ? ' is-leading' : '')}
                data-row={integrated ? row : undefined}
                style={
                  integrated
                    ? ({
                        '--seat-column': column,
                        '--seat-arc': perspective * perspective * 6 + 'px',
                        '--seat-turn': -perspective * 10 + 'deg'
                      } as CSSProperties)
                    : undefined
                }
                aria-label={person ? undefined : 'Ghế trống'}
              >
                <div className="live-seat-art">
                  <Chair occupied={!!person} rear={integrated} />
                  {person && (
                    <span className="live-seat-avatar" aria-hidden="true">
                      {Array.from(person.username.trim())[0]?.toLocaleUpperCase('vi-VN')}
                    </span>
                  )}
                </div>
                {(person || !integrated) && (
                  <span className="live-seat-name" title={person?.username}>
                    {person?.username ?? 'Ghế trống'}
                  </span>
                )}
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
      {session.participants.length > seatCount && (
        <p className="live-muted">
          Cùng {session.participants.length - seatCount} người khác đang xem.
        </p>
      )}
    </section>
  );
}
