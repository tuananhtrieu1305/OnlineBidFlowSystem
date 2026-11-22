import type { LiveSession } from './liveState';
import { coin, ProductThumbnail } from './LiveShared';
import MysteryRules from './MysteryRules';
export default function LiveFinalPanel({ session, host, ticket, pending, connected, onSelect }: {
  session: LiveSession; host: boolean; ticket: boolean; pending: boolean; connected: boolean; onSelect: (id: string) => void;
}) {
  if (!session.mysteryEnabled) return null;
  const secret = session.lots.find(l => l.kind === 'SECRET');
  const revealed = ['REVEALED','OPEN','SOLD'].includes(session.finalState ?? '');
  return <section className="live-panel live-final-panel" aria-label="Vòng bí mật">
    <h2>{revealed ? 'Món bí mật đã công bố' : 'Hộp bí mật'}</h2>
    <p role="status">{session.finalState === 'SKIPPED' ? 'Không mở vòng bí mật: phiên kết thúc trước khi đủ điều kiện.'
      : !revealed ? 'Chờ bán hết hàng thường và có ít nhất một người có vé.'
      : session.finalState === 'SOLD' ? 'Đã chốt món cuối.'
      : session.status === 'ENDED' ? 'Món cuối đã công bố nhưng chưa bán.'
      : session.finalState === 'OPEN' ? 'Vòng cuối đã mở. Chỉ người có vé được đặt giá.' : 'Đã đủ điều kiện. Host giới thiệu sản phẩm rồi mới mở đấu.'}</p>
    {revealed && secret ? <><ProductThumbnail lot={secret} /><strong>{secret.name}</strong><p>Giá khởi điểm: {coin(secret.startingPrice)}</p></> : <span className="live-secret-box" role="img" aria-label="Hộp bí mật chưa tiết lộ">?</span>}
    {!host && revealed && session.status !== 'ENDED' && <p>{ticket ? 'Bạn có vé: có thể đặt giá khi host mở lượt. Bạn cũng có thể bỏ qua.' : 'Bạn không có vé của phiên này. Bạn vẫn được xem và chat.'}</p>}
    {host && session.finalState === 'REVEALED' && session.status === 'LIVE' && secret && session.lots[session.currentLotIndex]?.id !== secret.id && <button type="button" className="live-secondary" disabled={pending || !connected} onClick={() => onSelect(secret.id)}>Đưa món bí mật lên</button>}
    <MysteryRules />
  </section>;
}
