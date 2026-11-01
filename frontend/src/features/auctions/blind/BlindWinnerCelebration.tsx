import { useEffect, useRef, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';

type Props = { auctionId: string; productName: string; imageUrl: string | null; winningPrice: string | null; onDismiss: () => void };
const colors = ['#e5bd63', '#f0dfad', '#78bda0', '#e2b5a0', '#f7f3df'];
const coin = (value: string | null) => value == null ? '—' : new Intl.NumberFormat('vi-VN').format(BigInt(value)) + ' Coin';

export default function BlindWinnerCelebration({ auctionId, productName, imageUrl, winningPrice, onDismiss }: Props) {
 const dialog = useRef<HTMLDialogElement>(null);
 useEffect(() => {
  const element = dialog.current;
  if (element && !element.open) element.showModal();
  return () => { if (element?.open) element.close(); };
 }, []);

 return <dialog ref={dialog} className="room-winner-dialog blind-winner-dialog" aria-labelledby="blind-winner-title" aria-describedby="blind-winner-description" onCancel={onDismiss}>
  <div className="room-winner-confetti" aria-hidden="true">{Array.from({length:36},(_,index)=><i key={index} style={{
   '--left':`${(index*37+9)%100}%`, '--delay':`${(index%12)*0.12}s`, '--duration':`${3.8+(index%5)*0.35}s`,
   '--drift':`${((index%7)-3)*28}px`, '--piece-color':colors[index%colors.length]
  } as CSSProperties}/>)}</div>
  <div className="room-winner-card">
   <Link className="room-winner-close blind-winner-close" to="/blind" aria-label="Đóng và về danh sách phòng đấu giá kín" title="Về danh sách phòng">×</Link>
   <svg className="room-winner-trophy" viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M15 8h18v11a9 9 0 0 1-18 0V8Z" stroke="currentColor" strokeWidth="2.5"/><path d="M15 12H8v5a8 8 0 0 0 9 8m16-13h7v5a8 8 0 0 1-9 8M24 28v9m-9 4h18m-14-4h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
   <p className="blind-winner-kicker">KẾT QUẢ CHÍNH THỨC · PHIÊN #{auctionId}</p>
   <h2 id="blind-winner-title">Chúc mừng, bạn đã chiến thắng!</h2>
   {imageUrl&&<img className="blind-winner-photo" src={imageUrl} alt={productName}/>}
   <p id="blind-winner-description">Bạn đã thắng <b>{productName}</b>.</p>
   <div className="room-winner-price"><span>Bid chiến thắng</span><strong>{coin(winningPrice)}</strong></div>
   <div className="blind-winner-actions"><Link className="room-primary room-winner-confirm" to={'/auctions/'+auctionId+'/replay'} autoFocus>Xem diễn biến phiên</Link><button type="button" onClick={()=>{onDismiss();dialog.current?.close();}}>Xem kết quả trong phòng</button></div>
  </div>
 </dialog>;
}
