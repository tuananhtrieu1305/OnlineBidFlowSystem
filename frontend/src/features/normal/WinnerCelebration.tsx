import { useEffect, useRef, type CSSProperties } from 'react';
import { roomCoin } from './roomExperience';

type Props = { winner: string; price: number; product: string; username: string; openSignal: number; onViewResult: () => void };
const colors = ['#e5bd63', '#f0dfad', '#78bda0', '#e2b5a0', '#f7f3df'];

export default function WinnerCelebration({ winner, price, product, username, openSignal, onViewResult }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const won = winner === username;
  const parts = winner.trim().split(/[\s._-]+/u).filter(Boolean);
  const initials = (parts.length > 1 ? parts.slice(0, 2).map(part => part[0]).join('') : winner.slice(0, 2)).toLocaleUpperCase('vi-VN');

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    return () => { if (element?.open) element.close(); };
  }, [openSignal]);

  return <dialog ref={dialog} className="room-winner-dialog" aria-labelledby="room-winner-title" aria-describedby="room-winner-description">
    <div className="room-winner-confetti" aria-hidden="true">{Array.from({ length: 36 }, (_, index) => <i key={`${openSignal}-${index}`} style={{
      '--left': `${(index * 37 + 9) % 100}%`,
      '--delay': `${(index % 12) * 0.12}s`,
      '--duration': `${3.8 + (index % 5) * 0.35}s`,
      '--drift': `${((index % 7) - 3) * 28}px`,
      '--piece-color': colors[index % colors.length]
    } as CSSProperties} />)}</div>
    <div className="room-winner-card" key={openSignal}>
      <button type="button" className="room-winner-close" aria-label="Đóng chúc mừng" onClick={() => dialog.current?.close()}>×</button>
      <svg className="room-winner-trophy" viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M15 8h18v11a9 9 0 0 1-18 0V8Z" stroke="currentColor" strokeWidth="2.5"/><path d="M15 12H8v5a8 8 0 0 0 9 8m16-13h7v5a8 8 0 0 1-9 8M24 28v9m-9 4h18m-14-4h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
      <h2 id="room-winner-title">{won ? 'Bạn đã thắng!' : 'Chúc mừng người thắng!'}</h2>
      <div className="room-winner-avatar" role="img" aria-label={`Avatar ${winner}`}>{initials}</div>
      <strong className="room-winner-name">{winner}</strong>
      <p id="room-winner-description">Đã thắng phiên đấu giá <b>{product}</b></p>
      <div className="room-winner-price"><span>Giá thắng</span><strong>{roomCoin(price)}</strong></div>
      <button type="button" className="room-primary room-winner-confirm" autoFocus onClick={() => { dialog.current?.close(); onViewResult(); }}>Xem kết quả</button>
    </div>
  </dialog>;
}
