import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { getAdminClues, saveAdminClues } from './blindApi';
import './blind.css';

export default function AdminBlindClues(){
 const {id}=useParams();const {user,loading}=useAuth();const [clues,setClues]=useState(['','','','']);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{if(!id||user?.role!=='ADMIN')return;void getAdminClues(id).then(v=>setClues([...v.clues,...Array(4).fill('')].slice(0,4))).catch(()=>setError('Chưa tải được Clue.'));},[id,user?.role]);
 if(loading)return <p role="status">Đang kiểm tra quyền…</p>;
 if(!user)return <Navigate to="/login" replace/>;
 if(user.role!=='ADMIN')return <Navigate to="/" replace/>;
 async function submit(event:FormEvent){event.preventDefault();if(!id||busy)return;
  const clean=clues.map(c=>c.trim());if(clean.some(c=>!c||c.length>500)||new Set(clean).size!==4){setError('Nhập đúng 4 Clue khác nhau, mỗi Clue tối đa 500 ký tự.');return;}
  setBusy(true);setError('');setNotice('');try{await saveAdminClues(id,clean);setNotice('Đã lưu 4 Clue. Người chơi sẽ nhận ngẫu nhiên khi đủ 4 người.');}
  catch{setError('Chưa lưu được Clue. Phiên phải chưa bắt đầu và chưa có người tham gia.');}finally{setBusy(false);}
 }
 return <main className="guest-home blind-admin"><header className="guest-topbar">Cấu hình đấu giá mù</header><Link to={'/admin/auctions/'+id}>← Phiên #{id}</Link>
 <h1>Bốn manh mối thật</h1><p>Mỗi người chơi nhận ngẫu nhiên một Clue riêng. Chỉ Admin thấy cả bốn trước phiên. Hãy hoàn tất trước khi mời người vào phòng.</p>
 <form onSubmit={e=>void submit(e)}>{clues.map((clue,index)=><label key={index}>Clue {index+1}<textarea required maxLength={500} rows={3} value={clue} onChange={e=>setClues(old=>old.map((v,i)=>i===index?e.target.value:v))}/></label>)}
 {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}<button className="blind-primary" disabled={busy}>{busy?'Đang lưu…':'Lưu 4 Clue'}</button></form>
 </main>;
}
