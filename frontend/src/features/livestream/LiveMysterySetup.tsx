import type { LiveMissionTemplate, NewLiveLot } from './liveState';
import { missionFloor } from './mysterySetup';
import { coin } from './LiveShared';
export default function LiveMysterySetup({ lots, secretId, missions, onSecret, onMissions }: {
  lots: NewLiveLot[]; secretId: string; missions: LiveMissionTemplate[];
  onSecret: (id: string) => void; onMissions: (missions: LiveMissionTemplate[]) => void;
}) {
  const regular = lots.filter(l => l.productId !== secretId);
  return <section className="live-panel live-mystery-setup">
    <h2>Săn vé bí ẩn</h2>
    <p>Chọn 2–29 món thường và một món bí mật từ danh sách đã thêm. Cấu hình sẽ khóa khi lưu phiên.</p>
    <fieldset><legend>Sản phẩm bí mật (bắt buộc)</legend>
      {lots.map(l => <div key={l.id} className="live-mystery-choice">
        <input type="radio" id={'secret-' + l.id} name="secretProduct" value={l.productId} checked={secretId === l.productId} onChange={() => onSecret(l.productId)} required />
        <label htmlFor={'secret-' + l.id}>{l.name} · {coin(l.startingPrice || '0')}</label>
      </div>)}
      {!lots.length && <p>Thêm sản phẩm ở danh sách bên dưới trước.</p>}
    </fieldset>
    <p>Mỗi nhiệm vụ cần mua hai sản phẩm khác nhau: một thuộc nhóm A, một thuộc nhóm B. Admin tự chọn sản phẩm đúng với mô tả nhiệm vụ.</p>
    {missions.map((m, index) => <fieldset key={index}>
      <legend>Nhiệm vụ {index + 1}</legend>
      <label htmlFor={'mission-title-' + index}>Mô tả nhiệm vụ (bắt buộc)</label>
      <input id={'mission-title-' + index} name={'mission-title-' + index} value={m.title} required maxLength={200} onChange={e => onMissions(missions.map((v, i) => i === index ? { ...v, title: e.target.value } : v))} />
      <div className="live-mission-groups">{(['groupA', 'groupB'] as const).map(group => <fieldset key={group}>
        <legend>Nhóm {group === 'groupA' ? 'A' : 'B'} — chọn ít nhất một sản phẩm</legend>
        {regular.map(l => <div key={l.id} className="live-mystery-choice">
          <input type="checkbox" id={`mission-${index}-${group}-${l.id}`} name={`mission-${index}-${group}`} checked={m[group].includes(l.productId)} onChange={e => onMissions(missions.map((v, i) => i === index ? { ...v, [group]: e.target.checked ? [...v[group], l.productId] : v[group].filter(id => id !== l.productId) } : v))} />
          <label htmlFor={`mission-${index}-${group}-${l.id}`}>{l.name}</label>
        </div>)}
      </fieldset>)}</div>
      <p>Tổng giá khởi điểm thấp nhất: {missionFloor(m, regular) === null ? 'Chưa có cặp hợp lệ' : coin(missionFloor(m, regular)!)}</p>
      <button type="button" className="live-secondary" onClick={() => onMissions(missions.filter((_, i) => i !== index))}>Xóa nhiệm vụ {index + 1}</button>
    </fieldset>)}
    <button type="button" className="live-secondary" disabled={missions.length >= 30} onClick={() => onMissions([...missions, { title: '', groupA: [], groupB: [] }])}>Thêm mẫu nhiệm vụ</button>
    <p className="live-notice">Chỉ mở hộp khi toàn bộ hàng thường đã bán và có ít nhất một người có vé. Người chơi vẫn cần Coin cho vòng cuối. Nếu không đủ điều kiện, các món đã mua giữ kết quả.</p>
    <p>Sau khi lưu, host mở live và đấu hàng thường. Món cuối tự công bố khi đủ điều kiện; host chủ động mở lượt đấu cuối.</p>
  </section>;
}
