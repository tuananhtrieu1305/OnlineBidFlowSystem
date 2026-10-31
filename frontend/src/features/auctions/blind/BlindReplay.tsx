import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import client from '../../../api/axiosClient';
import { useAuth } from '../../auth/AuthProvider';
import '../../normal/normal-room.css';
import './blind.css';

type Timeline={type:string;at:string;payload:{content?:string;username?:string;amount?:number;ownBid?:boolean;status?:string;winningPrice?:number}};
type Replay={auctionId:number;auctionType:string;status:string;product:{name:string};result:{status:string;winningPrice:number|null};events:Timeline[]};
const coin=(value:number|null)=>value==null?'—':new Intl.NumberFormat('vi-VN').format(value)+' Coin';
function eventText(event:Timeline){if(event.type==='CHAT_MESSAGE')return `${event.payload.username}: ${event.payload.content}`;if(event.type==='BID_PLACED')return `Bid ${coin(event.payload.amount??null)}${event.payload.ownBid?' của bạn':''}`;if(event.type==='AUCTION_STARTED')return 'Phiên bắt đầu';if(event.type==='AUCTION_FINISHED')return 'Phiên kết thúc';return event.type.replaceAll('_',' ');}
export default function BlindReplay(){const {id}=useParams();const {user,loading}=useAuth();const [data,setData]=useState<Replay|null>(null),[error,setError]=useState('');
 useEffect(()=>{if(!id||!user)return;const controller=new AbortController();void client.get<Replay>('/api/auctions/'+id+'/replay',{signal:controller.signal}).then(v=>setData(v.data)).catch(()=>{if(!controller.signal.aborted)setError('Chưa xem được replay. Chỉ người tham gia hoặc Admin được xem sau khi phiên kết thúc.');});return()=>controller.abort();},[id,user]);
 if(loading)return <main className="normal-room blind-replay room-loading"><p role="status">Đang kiểm tra phiên…</p></main>;
 if(!user)return <Navigate to="/login" replace/>;
 const back=user.role==='ADMIN'?'/admin/auctions/'+id:'/blind/'+id;
 return <main className="normal-room blind-replay" id="main-content" tabIndex={-1}>
  <header className="room-header blind-replay-header"><div className="room-identity"><small>Phiên #{id} · Đấu giá kín</small><h1>{data?.product.name??'Diễn biến phiên'}</h1></div><div className="blind-replay-header-status">REPLAY · KẾT QUẢ</div><Link className="room-exit" to={back} aria-label="Trở lại phiên" title="Trở lại phiên"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></Link></header>
  {error?<div className="blind-replay-loading" role="alert">{error}</div>:!data?<div className="blind-replay-loading" role="status">Đang tải diễn biến phiên…</div>:<div className="blind-replay-body"><section className="blind-replay-summary"><p className="blind-replay-kicker">KẾT QUẢ CHÍNH THỨC</p><h2>{data.product.name}</h2><p className="blind-replay-status">{data.status==='SOLD'?'Đã bán thành công':'Chưa bán được'}</p><dl><div><dt>Phiên</dt><dd>#{data.auctionId}</dd></div><div><dt>Giá thắng</dt><dd>{coin(data.result.winningPrice)}</dd></div><div><dt>Sự kiện</dt><dd>{data.events.length}</dd></div></dl><Link className="blind-replay-back" to={back}>← Trở lại phiên</Link></section><section className="room-data-panel blind-replay-events" aria-label="Diễn biến phiên"><div className="room-data-tabs"><h2>Diễn biến phiên</h2><span>{data.events.length} sự kiện</span></div><ol>{data.events.map((event,index)=><li key={index}><time>{new Date(event.at).toLocaleString('vi-VN')}</time><span className="blind-replay-marker" aria-hidden="true"/><p>{eventText(event)}</p></li>)}</ol></section></div>}
 </main>;
}
