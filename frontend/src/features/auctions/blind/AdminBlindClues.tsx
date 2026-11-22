import { useEffect, useState, type FormEvent } from 'react';
import axios from 'axios';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import BlindCluePoolFields from './BlindCluePoolFields';
import { getAdminBlindSettings, getAdminClues, openBlindLobby, saveAdminBlindSettings, saveAdminClues, type BlindAdminSettings } from './blindApi';
import '../../products/products.css';
import '../configuration/auctions.css';
import './blind.css';

export default function AdminBlindClues(){
 const {id}=useParams();const location=useLocation();const {user,loading}=useAuth();const fallback=Array.isArray(location.state?.fallbackClues)?location.state.fallbackClues.filter((v:unknown):v is string=>typeof v==='string').slice(0,4):[];const [clues,setClues]=useState([...fallback,...Array(4).fill('')].slice(0,4));
 const [settings,setSettings]=useState<BlindAdminSettings|null>(null),[tradeSeconds,setTradeSeconds]=useState('300'),[bidSeconds,setBidSeconds]=useState('100');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[settingsLoadError,setSettingsLoadError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{if(!id||user?.role!=='ADMIN')return;void Promise.all([getAdminClues(id), getAdminBlindSettings(id)]).then(([v,config])=>setClues(Array.from({length:Math.max(config.capacity,v.clues.length)},(_,i)=>v.clues[i]??fallback[i]??''))).catch(failure=>{
  const status=axios.isAxiosError(failure)?failure.response?.status:undefined;
  if(fallback.length===4)setError(status&&status<500?'Chưa đọc được Clue đã lưu. Bốn Clue mẫu đang được điền sẵn; thử lưu lại.':'Backend/DB chưa đọc được Clue. Bốn Clue mẫu đang được điền sẵn; kiểm tra kết nối hoặc migration BLIND rồi thử lưu.');
  else setError(status===401||status===403?'Phiên đăng nhập không có quyền quản trị. Đăng nhập lại bằng tài khoản ADMIN.':status===404?'Không tìm thấy phiên đấu giá mù. Kiểm tra mã phiên.':status&&status>=500?'DB/backend chưa đọc được Clue. Kiểm tra kết nối MySQL và migration BLIND.':'Không kết nối được backend để tải Clue. Kiểm tra backend rồi thử lại.');
 });},[id,user?.role]);
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
 async function submit(event:FormEvent){event.preventDefault();if(!id||busy||!settings)return;
  const clean=clues.map(c=>c.trim());if(clean.length<settings.capacity||clean.length>100||clean.some(c=>!c||c.length>500)||new Set(clean).size!==clean.length){setError(`Nhập từ ${settings.capacity} đến 100 Clue khác nhau, mỗi Clue tối đa 500 ký tự.`);return;}
  setBusy(true);setError('');setNotice('');try{await saveAdminClues(id,clean);setNotice(`Đã lưu ${clean.length} Clue.`);}
  catch(failure){const status=axios.isAxiosError(failure)?failure.response?.status:undefined;setError(status===401||status===403?'Không có quyền lưu Clue. Đăng nhập lại bằng tài khoản ADMIN.':status===409?'Phiên đã bắt đầu hoặc có người tham gia; không thể sửa Clue.':status&&status>=500?'DB/backend chưa lưu được Clue. Kiểm tra kết nối MySQL và migration BLIND.':'Chưa lưu được Clue. Kiểm tra backend và thử lại.');}finally{setSettings(await getAdminBlindSettings(id).catch(()=>settings));setBusy(false);}
 }
 async function saveSettings(event:FormEvent){event.preventDefault();if(!id||busy)return;
  const trade=Number(tradeSeconds),bid=Number(bidSeconds);
  if(!Number.isInteger(trade)||trade<1||trade>3600||!Number.isInteger(bid)||bid<1||bid>3600){setError('Mỗi thời lượng phải từ 1 đến 3600 giây.');return;}
  setBusy(true);setError('');setNotice('');try{setSettings(await saveAdminBlindSettings(id,trade,bid));setNotice('Đã lưu thời lượng cho phiên.');}
  catch{setError('Chưa lưu được thời lượng. Phiên có thể đã bắt đầu hoặc đã hết hạn chờ.');}finally{setBusy(false);}
 }
 async function startNow(){if(!id||busy||settings?.status!=='UPCOMING'||settings.opened||settings.clueCount<settings.capacity)return;
  setBusy(true);setError('');setNotice('');try{setSettings(await openBlindLobby(id));setNotice('Đã mở phòng chờ. Người chơi có thể vào phòng.');}
  catch{setError('Chưa mở được phòng. Kiểm tra trạng thái phiên và số Clue đã lưu.');setSettings(await getAdminBlindSettings(id).catch(()=>settings));}finally{setBusy(false);}
 }
 return <main className="guest-home products-page auctions-page blind-admin" id="main-content" tabIndex={-1}><header className="guest-topbar">Không gian quản trị<span className="guest-topnote">Chuẩn bị phòng đấu giá kín.</span></header>
  <div className="products-heading"><div><Link to={'/admin/auctions/'+id}>← Phiên #{id}</Link><h1>Thiết lập phòng BLIND</h1><p>Chuẩn bị manh mối, thời lượng và thời điểm bắt đầu.</p></div></div>
  {settingsLoadError&&<p className="blind-admin-feedback" role="alert">{settingsLoadError}</p>}{error&&<p className="blind-admin-feedback" role="alert">{error}</p>}{notice&&<p className="product-info" role="status">{notice}</p>}
  <section className="auction-section"><h2>1. Manh mối người chơi</h2><p>Mỗi người chơi nhận một Clue riêng khi phiên bắt đầu. Hãy lưu đủ {settings?.capacity??4} Clue khác nhau trước khi mời người vào phòng.</p>
   <form onSubmit={e=>void submit(e)}><fieldset disabled={busy||settings?.status!=='UPCOMING'||settings.opened||!!settings.participantCount}>
    <BlindCluePoolFields prefix="admin-blind-clue" title="Số Clue trong pool" clueLabel="Clue" clues={clues}
      minimum={settings?.capacity??4} maximum={100} onChange={setClues} />
    <div className="product-actions"><button className="product-primary" type="submit">{busy?'Đang lưu…':`Lưu ${clues.length} Clue`}</button></div>
   </fieldset></form>
  </section>
  <section className="auction-section"><h2>2. Thời lượng</h2><p>20 giây mở Clue, 60 giây thảo luận và 20 giây khóa bid được giữ cố định. Hai thời lượng dưới đây có thể chỉnh trước khi phiên bắt đầu.</p>
   <form onSubmit={e=>void saveSettings(e)}><div className="auction-grid"><label>Thời gian mua bán Clue (giây)<input type="number" min="1" max="3600" required value={tradeSeconds} onChange={e=>setTradeSeconds(e.target.value)}/></label><label>Thời gian đặt và sửa bid (giây)<input type="number" min="1" max="3600" required value={bidSeconds} onChange={e=>setBidSeconds(e.target.value)}/></label></div><div className="product-actions"><button className="product-primary" disabled={busy||settings?.status!=='UPCOMING'}>Lưu thời lượng</button></div></form>
  </section>
  {settings&&<section className="auction-section blind-admin-start"><h2>3. Phòng chờ</h2><dl className="auction-info"><div><dt>Người đã vào</dt><dd>{settings.participantCount}/{settings.capacity}</dd></div><div><dt>Đang kết nối</dt><dd>{settings.onlineCount}/{settings.capacity}</dd></div><div><dt>{settings.opened?'Hạn mở phòng':'Giờ theo lịch'}</dt><dd>{settings.opened&&settings.lobbyClosesAt?new Date(settings.lobbyClosesAt).toLocaleString('vi-VN'):settings.scheduledStartAt?new Date(settings.scheduledStartAt).toLocaleString('vi-VN'):'—'}</dd></div><div><dt>Trạng thái</dt><dd>{settings.status==='UPCOMING'?(settings.opened?'Đang mở phòng chờ':'Đang chờ'):settings.status==='RUNNING'?'Đang diễn ra':'Đã kết thúc'}</dd></div></dl><p>Khi đủ người online, phiên tự bắt đầu. Hết hạn chờ, phiên bắt đầu nếu còn ít nhất 3 người.</p><div className="product-actions"><span>{settings.status==='UPCOMING'&&!settings.opened&&settings.clueCount<settings.capacity?'Cần lưu đủ Clue trước khi mở phòng.':''}</span><button type="button" className="product-primary" disabled={busy||settings.status!=='UPCOMING'||settings.opened||settings.clueCount<settings.capacity} onClick={()=>void startNow()}>{settings.opened?'Đã mở phòng':'Mở phòng chờ'}</button></div></section>}
 </main>;
}
