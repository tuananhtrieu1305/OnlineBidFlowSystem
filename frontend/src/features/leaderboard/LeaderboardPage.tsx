import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { getLeaderboard, getMyLeaderboard, type LeaderboardBoard, type LeaderboardMine,
  type LeaderboardPeriod, type LeaderboardType, type PlayerRank } from './leaderboardApi';
import './leaderboard.css';

const count = (value: number) => new Intl.NumberFormat('vi-VN').format(value);
const coin = (value: string) => new Intl.NumberFormat('vi-VN').format(BigInt(value)) + ' Coin';
const rate = (wins: number, played: number) => played
  ? new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(wins * 100 / played) + '%'
  : '—';
const month = (value: string | null) => value ? `Tháng ${Number(value.slice(5, 7))}/${value.slice(0, 4)}` : 'Toàn thời gian';

function Player({ player, self }: { player: PlayerRank; self: boolean }) {
  return <div className={self ? 'leaderboard-player leaderboard-self' : 'leaderboard-player'}>
    <span className="leaderboard-position">#{player.rank}</span>
    <div className="leaderboard-player-name"><strong>{player.username}</strong>{self && <small>Bạn</small>}</div>
    <span><strong>{count(player.wins)}</strong><small>lần thắng</small></span>
    <span><strong>{count(player.wins)}/{count(player.played)}</strong><small>{rate(player.wins, player.played)}</small></span>
  </div>;
}

export default function LeaderboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [type, setType] = useState<LeaderboardType>('ALL');
  const [period, setPeriod] = useState<LeaderboardPeriod>('ALL_TIME');
  const [board, setBoard] = useState<LeaderboardBoard | null>(null), [mine, setMine] = useState<LeaderboardMine | null>(null);
  const [boardLoading, setBoardLoading] = useState(true), [mineLoading, setMineLoading] = useState(false);
  const [boardError, setBoardError] = useState(''), [mineError, setMineError] = useState(''), [reload, setReload] = useState(0);

  useEffect(() => {
    const abort = new AbortController();
    setBoardLoading(true); setBoardError(''); setBoard(null);
    void getLeaderboard(type, period, abort.signal)
      .then(result => { if (!abort.signal.aborted) setBoard(result); })
      .catch(() => { if (!abort.signal.aborted) setBoardError('Chưa tải được bảng xếp hạng. Kiểm tra kết nối và thử lại.'); })
      .finally(() => { if (!abort.signal.aborted) setBoardLoading(false); });
    return () => abort.abort();
  }, [type, period, reload]);

  useEffect(() => {
    if (authLoading || user?.role !== 'USER') { setMine(null); setMineError(''); return; }
    const abort = new AbortController();
    setMineLoading(true); setMineError(''); setMine(null);
    void getMyLeaderboard(type, period, abort.signal)
      .then(result => { if (!abort.signal.aborted) setMine(result); })
      .catch(() => { if (!abort.signal.aborted) setMineError('Chưa tải được thành tích của bạn.'); })
      .finally(() => { if (!abort.signal.aborted) setMineLoading(false); });
    return () => abort.abort();
  }, [type, period, reload, authLoading, user?.id, user?.role]);

  const top = board?.top ?? [];
  const selfId = user?.role === 'USER' ? String(user.id) : null;
  const inTop = !!selfId && top.some(player => player.id === selfId);
  return <main className="guest-home leaderboard" id="main-content" tabIndex={-1}>
    <header className="guest-topbar"><span>Bảng xếp hạng</span><span className="guest-topnote">Thành tích từ các phiên đã kết thúc.</span></header>
    <section className="leaderboard-heading"><div><p className="guest-kicker">CỘNG ĐỒNG ONLINEBIDFLOW</p><h1>Những người chơi dẫn đầu</h1>
      <p>Thắng nhiều phiên hơn sẽ xếp trước. Khi bằng số lần thắng, tỷ lệ thắng quyết định thứ hạng.</p></div>
      <span className="leaderboard-period-label">{period === 'MONTH' ? board?.month ? month(board.month) : 'Tháng này' : 'Toàn thời gian'}</span></section>
    <div className="leaderboard-filters"><div role="group" aria-label="Khoảng thời gian">
      <button type="button" aria-pressed={period === 'ALL_TIME'} onClick={() => setPeriod('ALL_TIME')}>Toàn thời gian</button>
      <button type="button" aria-pressed={period === 'MONTH'} onClick={() => setPeriod('MONTH')}>Tháng này</button></div>
      <div role="group" aria-label="Loại đấu giá">
        <button type="button" aria-pressed={type === 'ALL'} onClick={() => setType('ALL')}>Tất cả</button>
        <button type="button" aria-pressed={type === 'BLIND'} onClick={() => setType('BLIND')}>Chỉ BLIND</button></div>
      <button className="leaderboard-refresh" type="button" disabled={boardLoading} onClick={() => setReload(value => value + 1)}>Làm mới</button>
    </div>
    {boardLoading ? <p role="status">Đang tải bảng xếp hạng…</p> : boardError ? <div className="leaderboard-error" role="alert">{boardError}<button type="button" onClick={() => setReload(value => value + 1)}>Thử lại</button></div> : board && <>
      {top.length ? <>
        <div className="leaderboard-top">{top.slice(0, 3).map(player => <article key={player.id} className="leaderboard-top-card">
          <span>HẠNG #{player.rank}</span><h2>{player.username}{selfId === player.id && <small>Bạn</small>}</h2>
          <strong>{count(player.wins)} lần thắng</strong><p>{count(player.wins)}/{count(player.played)} phiên · {rate(player.wins, player.played)}</p>
        </article>)}</div>
        {top.length > 3 && <section className="leaderboard-list" aria-label="Các vị trí tiếp theo"><div className="leaderboard-list-heading"><h2>Những vị trí tiếp theo</h2><span>Hạng · Người chơi · Số lần thắng · Tỷ lệ</span></div>
          {top.slice(3).map(player => <Player key={player.id} player={player} self={selfId === player.id}/>)}</section>}
      </> : <section className="leaderboard-empty"><strong>Chưa có thành tích phù hợp</strong><p>Hãy quay lại sau khi có phiên công khai kết thúc và người chơi tham gia thực sự.</p></section>}
      <p className="leaderboard-note">{count(board.totalPlayers)} người chơi được xếp hạng · Bảng công khai chỉ tính phiên PUBLIC đã chơi xong. Phiên BLIND phải thực sự bắt đầu.</p>
    </>}
    {user?.role === 'USER' ? <section className="leaderboard-personal" aria-labelledby="leaderboard-personal-title"><div className="leaderboard-section-title"><div><p className="guest-kicker">CHỈ BẠN NHÌN THẤY</p><h2 id="leaderboard-personal-title">Thành tích của bạn</h2></div></div>
      {mineLoading ? <p role="status">Đang tải thành tích của bạn…</p> : mineError ? <p role="alert">{mineError}</p> : mine && <>
        {mine.publicRank ? <div className="leaderboard-my-rank"><p>Vị trí công khai của bạn{inTop ? ' · Trong Top 10' : ''}</p><Player player={mine.publicRank} self/></div>
          : <p className="leaderboard-personal-empty">Bạn chưa tham gia phiên PUBLIC nào được tính hạng trong bộ lọc này.</p>}
        <div className="leaderboard-personal-stats"><div><small>Phiên PRIVATE</small><strong>{count(mine.privateStats.wins)}/{count(mine.privateStats.played)}</strong><span>thắng / đã chơi · {rate(mine.privateStats.wins, mine.privateStats.played)}</span></div>
          <div><small>Tổng phiên đã chơi</small><strong>{count(mine.allStats.played)}</strong><span>{count(mine.allStats.wins)} lần thắng, gồm cả phòng riêng</span></div>
          <div><small>Coin mua sản phẩm</small><strong>{coin(mine.allStats.coinSpent)}</strong><span>Không tính giao dịch Clue</span></div></div>
      </>}
    </section> : !authLoading && !user && <section className="leaderboard-signin"><p>Đăng nhập để xem vị trí và thành tích phòng riêng của bạn.</p><Link to="/login">Đăng nhập →</Link></section>}
  </main>;
}
