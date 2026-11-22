import { useId } from 'react';
import type { LivePersonalMission, LiveSession } from './liveState';
export default function LiveMissionPanel({ session, mission, userId, host }: {
  session: LiveSession; mission?: LivePersonalMission | null; userId: string; host: boolean;
}) {
  const heading = useId();
  if (!session.mysteryEnabled) return null;
  if (host) return <section className="live-panel live-mission-panel" aria-labelledby={heading}>
    <h2 id={heading}>Vé vào vòng cuối</h2>
    <p role="status">Đã phát {session.ticketCount ?? 0} vé</p>
  </section>;
  const own = mission?.sessionId === session.id && mission.userId === userId ? mission : null;
  return <section className="live-panel live-mission-panel" aria-labelledby={heading}>
    <h2 id={heading}>Nhiệm vụ riêng của bạn</h2>
    {own?.status === 'ASSIGNED' ? <>
      <p>{own.title}</p>
      <progress aria-label="Tiến độ nhiệm vụ" value={own.progress} max={2} />
      <p role="status">{own.ticket ? 'Bạn đã nhận một vé vào vòng cuối' : `Đã thanh toán ${own.progress}/2 sản phẩm phù hợp`}</p>
      <details><summary>Sản phẩm hợp lệ cho nhiệm vụ</summary>
        {(['groupA', 'groupB'] as const).map(group => <div key={group}>
          <h3>Nhóm {group === 'groupA' ? 'A' : 'B'} — mua một món</h3>
          <ul>{own[group]?.map(choice => <li key={choice.productId}>{choice.name}{choice.purchased ? ' · Đã mua' : ''}</li>)}</ul>
        </div>)}
        <p>Cần hai sản phẩm khác nhau. Một món nằm trong cả hai nhóm vẫn chỉ tính một lần.</p>
      </details>
      <p>Vé không thể chuyển nhượng. Giữ Coin để tranh món bí mật ở vòng cuối.</p>
    </> : <p role="status">{own?.status === 'UNAVAILABLE'
      ? 'Không còn nhiệm vụ khả thi với hàng còn lại. Bạn vẫn có thể xem, chat và đấu hàng thường.'
      : own?.status === 'CLOSED' ? 'Đã đóng nhận nhiệm vụ cho phiên này.'
      : 'Đang chờ đồng bộ nhiệm vụ khi vào phòng. Nếu phiên tạm dừng, hãy chờ tiếp tục.'}</p>}
  </section>;
}
