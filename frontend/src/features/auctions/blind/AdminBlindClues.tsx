import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { getAdminBlindSettings, getAdminClues, saveAdminBlindSettings, saveAdminClues, startBlindNow, type BlindAdminSettings } from './blindApi';
import '../../products/products.css';
import '../configuration/auctions.css';
import './blind.css';

export default function AdminBlindClues(){
 const {id}=useParams();const {user,loading}=useAuth();const [clues,setClues]=useState(['','','','']);
 const [settings,setSettings]=useState<BlindAdminSettings|null>(null),[tradeSeconds,setTradeSeconds]=useState('300'),[bidSeconds,setBidSeconds]=useState('100');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[settingsLoadError,setSettingsLoadError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{if(!id||user?.role!=='ADMIN')return;void getAdminClues(id).then(v=>setClues([...v.clues,...Array(4).fill('')].slice(0,4))).catch(()=>setError('Chưa tải được Clue.'));},[id,user?.role]);
 useEffect(()=>{if(!id||user?.role!=='ADMIN')return;let active=true,initialized=false;
  const load=()=>{void getAdminBlindSettings(id).then(v=>{if(!active)return;
   if(!initialized){setTradeSeconds(String(v.tradeSeconds));setBidSeconds(String(v.bidSeconds));initialized=true;}
   setSettings(v);setSettingsLoadError('');
  }).catch(()=>{if(active&&!initialized)setSettingsLoadError('Chưa tải được cấu hình phiên.');});};
  load();const timer=setInterval(load,2000);
  return()=>{active=false;clearInterval(timer);};
 },[id,user?.role]);
 if(loading)return <p role="status">Đang kiểm tra quyền…</p>;
 if(!user)return <Navigate to="/login" replace/>;
 if(user.role!=='ADMIN')return <Navigate to="/" replace/>;
 async function submit(event:FormEvent){event.preventDefault();if(!id||busy)return;
  const clean=clues.map(c=>c.trim());if(clean.some(c=>!c||c.length>500)||new Set(clean).size!==4){setError('Nhập đúng 4 Clue khác nhau, mỗi Clue tối đa 500 ký tự.');return;}
  setBusy(true);setError('');setNotice('');try{await saveAdminClues(id,clean);setNotice('Đã lưu 4 Clue. Người chơi sẽ nhận ngẫu nhiên khi phiên bắt đầu.');setSettings(await getAdminBlindSettings(id));}
  catch{setError('Chưa lưu được Clue. Phiên phải chưa bắt đầu và chưa có người tham gia.');}finally{setBusy(false);}
 }
 async function saveSettings(event:FormEvent){event.preventDefault();if(!id||busy)return;
  const trade=Number(tradeSeconds),bid=Number(bidSeconds);
  if(!Number.isInteger(trade)||trade<1||trade>3600||!Number.isInteger(bid)||bid<1||bid>3600){setError('Mỗi thời lượng phải từ 1 đến 3600 giây.');return;}
  setBusy(true);setError('');setNotice('');try{setSettings(await saveAdminBlindSettings(id,trade,bid));setNotice('Đã lưu thời lượng cho phiên.');}
  catch{setError('Chưa lưu được thời lượng. Phiên có thể đã bắt đầu hoặc đã hết hạn chờ.');}finally{setBusy(false);}
 }
 async function startNow(){if(!id||busy||!settings?.canStartNow)return;
  setBusy(true);setError('');setNotice('');try{setSettings(await startBlindNow(id));setNotice('Phiên đã bắt đầu.');}
  catch{setError('Chưa thể bắt đầu. Kiểm tra 4 người đang online, 4 Clue và hạn chờ của phiên.');setSettings(await getAdminBlindSettings(id).catch(()=>settings));}finally{setBusy(false);}
 }
 return <main className="guest-home products-page auctions-page blind-admin" id="main-content" tabIndex={-1}><header className="guest-topbar">Không gian quản trị<span className="guest-topnote">Chuẩn bị phòng đấu giá kín.</span></header>
  <div className="products-heading"><div><Link to={'/admin/auctions/'+id}>← Phiên #{id}</Link><h1>Thiết lập phòng BLIND</h1><p>Chuẩn bị manh mối, thời lượng và thời điểm bắt đầu.</p></div></div>
  {settingsLoadError&&<p className="blind-admin-feedback" role="alert">{settingsLoadError}</p>}{error&&<p className="blind-admin-feedback" role="alert">{error}</p>}{notice&&<p className="product-info" role="status">{notice}</p>}
  <section className="auction-section"><h2>1. Bốn manh mối thật</h2><p>Mỗi người chơi nhận một Clue riêng khi phiên bắt đầu. Hãy lưu đủ 4 Clue khác nhau trước khi mời người vào phòng.</p>
   <form onSubmit={e=>void submit(e)}><div className="auction-grid blind-admin-clues">{clues.map((clue,index)=><label key={index}>Clue {index+1}<textarea required maxLength={500} rows={3} value={clue} onChange={e=>setClues(old=>old.map((v,i)=>i===index?e.target.value:v))}/></label>)}</div><div className="product-actions"><button className="product-primary" disabled={busy||settings?.status!=='UPCOMING'||!!settings?.participantCount}>{busy?'Đang lưu…':'Lưu 4 Clue'}</button></div></form>
  </section>
  <section className="auction-section"><h2>2. Thời lượng</h2><p>20 giây mở Clue, 60 giây thảo luận và 20 giây khóa bid được giữ cố định. Hai thời lượng dưới đây có thể chỉnh trước khi phiên bắt đầu.</p>
   <form onSubmit={e=>void saveSettings(e)}><div className="auction-grid"><label>Thời gian mua bán Clue (giây)<input type="number" min="1" max="3600" required value={tradeSeconds} onChange={e=>setTradeSeconds(e.target.value)}/></label><label>Thời gian đặt và sửa bid (giây)<input type="number" min="1" max="3600" required value={bidSeconds} onChange={e=>setBidSeconds(e.target.value)}/></label></div><div className="product-actions"><button className="product-primary" disabled={busy||settings?.status!=='UPCOMING'}>Lưu thời lượng</button></div></form>
  </section>
  {settings&&<section className="auction-section blind-admin-start"><h2>3. Bắt đầu phiên</h2><dl className="auction-info"><div><dt>Người đã giữ chỗ</dt><dd>{settings.participantCount}/4</dd></div><div><dt>Đang kết nối</dt><dd>{settings.onlineCount}/4</dd></div><div><dt>Giờ theo lịch</dt><dd>{new Date(settings.scheduledStartAt).toLocaleString('vi-VN')}</dd></div><div><dt>Trạng thái</dt><dd>{settings.status==='UPCOMING'?'Đang chờ':settings.status==='RUNNING'?'Đang diễn ra':'Đã kết thúc'}</dd></div></dl><p>Khi đến giờ theo lịch, phiên tự bắt đầu nếu đủ 4 người online và 4 Clue. Admin có thể bắt đầu sớm khi đã đủ điều kiện.</p><div className="product-actions"><span>{settings.status==='UPCOMING'&&!settings.canStartNow?'Cần đủ 4 người online, 4 Clue và chưa hết hạn chờ.':''}</span><button type="button" className="product-primary" disabled={busy||!settings.canStartNow} onClick={()=>void startNow()}>Start now · Bắt đầu ngay</button></div></section>}
 </main>;
}
