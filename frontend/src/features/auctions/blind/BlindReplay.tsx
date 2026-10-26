import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import client from '../../../api/axiosClient';
import { useAuth } from '../../auth/AuthProvider';
import './blind.css';

type Timeline={type:string;at:string;payload:{content?:string;username?:string;amount?:number;ownBid?:boolean;status?:string;winningPrice?:number}};
type Replay={auctionId:number;auctionType:string;status:string;product:{name:string};result:{status:string;winningPrice:number|null};events:Timeline[]};
export default function BlindReplay(){const {id}=useParams();const {user,loading}=useAuth();const [data,setData]=useState<Replay|null>(null),[error,setError]=useState('');
 useEffect(()=>{if(!id||!user)return;const controller=new AbortController();void client.get<Replay>('/api/auctions/'+id+'/replay',{signal:controller.signal}).then(v=>setData(v.data)).catch(()=>{if(!controller.signal.aborted)setError('Chưa xem được replay. Chỉ người tham gia hoặc Admin được xem sau khi phiên kết thúc.');});return()=>controller.abort();},[id,user]);
 if(loading)return <p role="status">Đang kiểm tra phiên…</p>;
 if(!user)return <Navigate to="/login" replace/>;
 return <main className="guest-home blind-page"><Link to={'/blind/'+id}>← Trở lại phòng</Link><h1>Diễn biến phiên #{id}</h1>{error&&<p role="alert">{error}</p>}{!error&&!data&&<p role="status">Đang tải replay…</p>}
 {data&&<><p>{data.product.name} · {data.status==='SOLD'?'Đã bán':'Chưa bán được'}{data.result.winningPrice!=null?' · Giá thắng '+data.result.winningPrice+' Coin':''}</p><ol className="blind-panel">{data.events.map((event,index)=><li key={index}><time>{new Date(event.at).toLocaleString('vi-VN')}</time> · {event.type==='CHAT_MESSAGE'?`${event.payload.username}: ${event.payload.content}`:event.type==='BID_PLACED'?`Bid ${event.payload.amount} Coin${event.payload.ownBid?' của bạn':''}`:event.type==='AUCTION_STARTED'?'Phiên bắt đầu':'Phiên kết thúc'}</li>)}</ol></>}</main>;
}
