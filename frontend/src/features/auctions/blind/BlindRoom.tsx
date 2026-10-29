import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { serverConfig } from '../../../api/axiosClient';
import { useAuth } from '../../auth/AuthProvider';
import { imageSource } from '../../products/productApi';
import { getWallet, type Wallet } from '../../wallet/walletApi';
import { buyClue, cancelClue, getBlindState, listClue, submitBlindBid, type BlindState, type Clue, type Listing } from './blindApi';
import './blind.css';

type Chat={messageId:number;userId:number;username:string;content:string;sentAt:string};
type Event={type:string;payload:any};
const coin=(value:string|number|null|undefined)=>value==null?'—':new Intl.NumberFormat('vi-VN').format(BigInt(value))+' Coin';
const reason=(error:unknown)=>axios.isAxiosError(error)?error.response?.data?.code??'NETWORK_ERROR':'NETWORK_ERROR';
const descriptions:Record<string,string>={NOT_IN_ROOM:'Bạn cần tham gia phòng trước.',ROOM_CODE_REQUIRED:'Nhập mã phòng riêng.',ROOM_CODE_INVALID:'Mã phòng không đúng.',ROOM_FULL:'Phòng đã đủ 4 người.',AUCTION_NOT_JOINABLE:'Phiên đã đóng.',CLUE_MARKET_CLOSED:'Thời gian mua bán Clue đã kết thúc.',LISTING_CHANGED:'Giá hoặc trạng thái Clue đã thay đổi. Hãy xem lại trước khi mua.',CLUE_ALREADY_KNOWN:'Bạn đã biết Clue này.',INSUFFICIENT_COIN:'Coin khả dụng không đủ.',BID_WINDOW_CLOSED:'Thời gian tạo và sửa bid đã kết thúc.',NETWORK_ERROR:'Chưa xác định kết quả. Hãy kiểm tra Clue, bid và ví trước khi gửi lại.'};
const explain=(code:string)=>descriptions[code]??'Thao tác chưa thành công ('+code+'). Hãy kiểm tra trạng thái mới nhất.';

export function PrivateBlindEntry(){const [id,setId]=useState('');const navigate=useNavigate();const {user}=useAuth();
 return <main className="guest-home blind-entry"><Link to="/">← Khám phá</Link><h1>Vào phòng đấu giá kín</h1><p>Nhập mã phiên do Admin chia sẻ. Bạn sẽ nhập mã phòng ở bước kế tiếp.</p>
 <form onSubmit={e=>{e.preventDefault();if(/^[1-9][0-9]{0,18}$/.test(id))navigate('/blind/'+id);}}><label>Mã phiên<input inputMode="numeric" value={id} onChange={e=>setId(e.target.value)} placeholder="Ví dụ: 12"/></label><button className="blind-primary">Tiếp tục</button></form>
 {!user&&<p><Link to="/login">Đăng nhập</Link> để tham gia.</p>}</main>;
}

export default function BlindRoom(){
 const {id}=useParams();const {user,loading}=useAuth();const [roomCode,setRoomCode]=useState(''),[attempt,setAttempt]=useState(0);
 const [joined,setJoined]=useState(false),[connected,setConnected]=useState(false),[state,setState]=useState<BlindState|null>(null);
 const [chat,setChat]=useState<Chat[]>([]),[chatText,setChatText]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false),[bid,setBid]=useState(''),[seconds,setSeconds]=useState(Date.now()),[clockOffset,setClockOffset]=useState(0),[wallet,setWallet]=useState<Wallet|null>(null),[revealReady,setRevealReady]=useState(false);
 const socket=useRef<WebSocket|null>(null),seenReveal=useRef(false);
 const validId=!!id&&/^[1-9][0-9]{0,18}$/.test(id)&&Number.isSafeInteger(Number(id));
 const refresh=useCallback(async()=>{if(!id)return;try{const next=await getBlindState(id);setClockOffset(Date.parse(next.serverNow)-Date.now());setState(next);void getWallet().then(setWallet).catch(()=>{});}catch(err){setError(explain(reason(err)));}},[id]);
 useEffect(()=>{if(!validId||!user||user.role!=='USER')return;let disposed=false,retry:ReturnType<typeof setTimeout>|null=null;
  const connect=()=>{if(disposed)return;const url=new URL(serverConfig.apiUrl);const ws=new WebSocket((url.protocol==='https:'?'wss://':'ws://')+url.host+'/ws/auction');socket.current=ws;
   ws.onopen=()=>{if(disposed)return;setConnected(true);ws.send(JSON.stringify({type:'JOIN_ROOM',requestId:crypto.randomUUID(),payload:{auctionId:Number(id),roomCode:roomCode.trim()||null}}));};
   ws.onmessage=message=>{if(disposed)return;let event:Event;try{event=JSON.parse(message.data) as Event;}catch{return;}
    if(event.type==='AUCTION_STATE'){setJoined(true);setError('');setChat((event.payload?.chatHistory??[]) as Chat[]);void refresh();}
    else if(event.type==='CHAT_MESSAGE'){const item=event.payload as Chat;setChat(old=>old.some(v=>v.messageId===item.messageId)?old:[...old,item].slice(-100));}
    else if(event.type==='ERROR')setError(explain(event.payload?.code??'INVALID_MESSAGE'));
    else if(['AUCTION_FINISHED','BLIND_BID_ACCEPTED','USER_JOINED','USER_LEFT'].includes(event.type))void refresh();
   };
   ws.onclose=()=>{if(disposed)return;setConnected(false);setJoined(false);retry=setTimeout(connect,3000);};
   ws.onerror=()=>setConnected(false);
  };connect();return()=>{disposed=true;if(retry)clearTimeout(retry);socket.current?.close();socket.current=null;setConnected(false);setJoined(false);};
 },[validId,id,user?.id,user?.role,attempt,refresh]);
 useEffect(()=>{if(!joined)return;const timer=setInterval(()=>void refresh(),2000);return()=>clearInterval(timer);},[joined,refresh]);
 useEffect(()=>{const timer=setInterval(()=>setSeconds(Date.now()),250);return()=>clearInterval(timer);},[]);
 useEffect(()=>{if(state?.ownBid?.amount)setBid(state.ownBid.amount);},[state?.ownBid?.amount]);
 useEffect(()=>{if(!state)return;if(state.phase!=='REVEAL'){setRevealReady(true);return;}if(seenReveal.current){setRevealReady(true);return;}
  setRevealReady(false);const timer=setTimeout(()=>{seenReveal.current=true;setRevealReady(true);},3000);return()=>clearTimeout(timer);},[state?.phase]);
 if(loading)return <p role="status">Đang kiểm tra phiên…</p>;
 if(!user)return <Navigate to="/login" replace/>;
 if(user.role!=='USER')return <Navigate to="/admin" replace/>;
 if(!validId)return <main className="guest-home"><p role="alert">Mã phiên không hợp lệ.</p><Link to="/blind">Nhập lại mã phiên</Link></main>;
 const target=state?.phase==='WAITING'?state.lobbyClosesAt:state?.phase==='REVEAL'?state.revealEndsAt:state?.phase==='TRADE'?state.tradeEndsAt:state?.phase==='DISCUSS'?state.bidStartsAt:state?.phase==='BID'?state.bidLocksAt:state?.endsAt;
 const remaining=target?Math.max(0,Math.ceil((Date.parse(target)-seconds-clockOffset)/1000)):0;
 const time=`${Math.floor(remaining/60).toString().padStart(2,'0')}:${(remaining%60).toString().padStart(2,'0')}`;
 const trade=state?.phase==='TRADE',canBid=state?.phase==='BID';
 const phaseLabel:Record<BlindState['phase'],string>={WAITING:'Chờ đủ 4 người',REVEAL:'Đang mở Clue',TRADE:'Thảo luận & mua bán Clue',DISCUSS:'Chốt thông tin · chờ bid',BID:'Đặt giá bí mật',LOCKED:'Bid đã khóa',SETTLING:'Đang xác định kết quả',FINISHED:'Đã kết thúc'};
 async function act(work:()=>Promise<unknown>,success:string){if(busy)return;setBusy(true);setError('');setNotice('');try{await work();setNotice(success);await refresh();}catch(err){setError(explain(reason(err)));await refresh();}finally{setBusy(false);}}
 function sendChat(event:FormEvent){event.preventDefault();const content=chatText.trim();if(!content||!joined||socket.current?.readyState!==WebSocket.OPEN)return;
  socket.current.send(JSON.stringify({type:'SEND_CHAT_MESSAGE',requestId:crypto.randomUUID(),payload:{auctionId:Number(id),content}}));setChatText('');}
 const own=new Set(state?.ownedClues.map(c=>c.id)??[]);
 const productPhoto=state?imageSource(state.product.image_url):null;
 const availableListings=state?.listings.filter(l=>l.sellerId!==String(user.id)&&!own.has(l.clueId))??[];
 return <main className="guest-home blind-page" id="main-content" tabIndex={-1}>
  <header className="guest-topbar"><span>Phòng đấu giá mù</span><span className="guest-topnote">Phiên #{id}</span></header>
  <div className="blind-top"><Link to="/">← Quay lại khám phá</Link><span className={connected?'blind-connection blind-online':'blind-connection blind-offline'}><span aria-hidden="true"/>{connected?'Đã kết nối':'Đang kết nối lại…'}</span></div>
  {!joined&&<section className="blind-panel blind-join"><p className="guest-kicker">PHIÊN #{id} · ĐẤU GIÁ MÙ</p><h1>Vào phòng đấu giá</h1><p>Tối đa 4 người. Khi đủ người, hệ thống sẽ chia ngẫu nhiên 4 Clue thật.</p>
   <label>Mã phòng riêng <span>(để trống nếu công khai)</span><input value={roomCode} onChange={e=>setRoomCode(e.target.value)} maxLength={50}/></label>
   <button type="button" className="blind-primary" onClick={()=>setAttempt(v=>v+1)}>Tham gia phòng</button></section>}
  {error&&<p className="blind-error" role="alert">{error}</p>}{notice&&<p className="blind-notice" role="status">{notice}</p>}
  {joined&&!state&&<p role="status">Đang tải dữ liệu phòng…</p>}
  {joined&&state&&<>
   <div className="blind-heading">
    <div><p className="guest-kicker">PHIÊN #{id} · {phaseLabel[state.phase].toUpperCase()}</p><h1>{state.product.name}</h1><p className="blind-room-meta"><span>{state.onlineCount}/4 đang kết nối</span><span>{state.participantCount}/4 vị trí đã giữ</span></p></div>
    <div className="blind-timer"><small>{state.phase==='WAITING'?'Hạn chờ đủ người':'Còn lại ở giai đoạn này'}</small><strong>{state.phase==='FINISHED'?'KẾT THÚC':time}</strong></div>
   </div>
   <div className="blind-layout">
    <section className="blind-panel blind-product"><div className="blind-photo">{productPhoto?<img src={productPhoto} alt={state.product.name}/>:<span aria-label="Chưa có ảnh sản phẩm">◇</span>}</div><div className="blind-product-copy"><p className="blind-section-label">SẢN PHẨM ĐẤU GIÁ</p><h2>{state.product.name}</h2><p>{state.product.description||'Chưa có mô tả sản phẩm.'}</p><p className="blind-privacy">Giá sàn và bid của người khác được giữ kín.</p></div></section>
    <section className="blind-panel blind-bid"><div className="blind-panel-heading"><div><p className="blind-section-label">GIÁ CỦA BẠN</p><h2>Đặt giá bí mật</h2></div></div>
     <div className="blind-wallet-summary"><div><small>Coin khả dụng</small><strong>{coin(wallet?.availableBalance)}</strong></div><div><small>Coin đang khóa</small><strong>{coin(wallet?.lockedBalance)}</strong></div></div>
     <div className="blind-current-bid"><small>Bid đã xác nhận</small>{state.ownBid?<><strong>{coin(state.ownBid.amount)}</strong><span>Lúc {new Date(state.ownBid.at).toLocaleTimeString('vi-VN')}</span></>:<span>Bạn chưa đặt bid.</span>}</div>
     {canBid&&<form onSubmit={e=>{e.preventDefault();if(!/^[1-9][0-9]{0,18}$/.test(bid))return;const message=state.ownBid?'Sửa bid sẽ cập nhật thời điểm phá hòa. Xác nhận?':'Bid bí mật chỉ bạn nhìn thấy. Xác nhận?';if(window.confirm(message))void act(()=>submitBlindBid(id!,bid),'Server đã xác nhận bid của bạn.');}}><label>Số Coin muốn đặt<input value={bid} onChange={e=>setBid(e.target.value)} inputMode="numeric" placeholder="Nhập số Coin"/></label><button className="blind-primary" disabled={busy||!/^[1-9][0-9]{0,18}$/.test(bid)}>{state.ownBid?'Sửa bid':'Đặt bid bí mật'}</button><small>Được sửa đến trước 20 giây cuối. Thời điểm xác nhận bid cuối dùng để phá hòa.</small></form>}
     {state.phase==='LOCKED'&&<p className="blind-muted">20 giây cuối: bid đã khóa, không thể tạo hoặc sửa.</p>}
     {state.phase==='FINISHED'&&<div className="blind-result"><strong>{state.result?.status==='SOLD'?'Đã bán':'Không đạt giá sàn'}</strong>{state.result?.status==='SOLD'&&<p>Giá thắng: {coin(state.result.winningPrice)}{state.result.winnerUserId===String(user.id)?' · Bạn thắng!':''}</p>}<Link to={'/auctions/'+id+'/replay'}>Xem replay →</Link></div>}
     {!canBid&&!['LOCKED','FINISHED'].includes(state.phase)&&<p className="blind-muted blind-bid-hint">Khu vực đặt giá mở sau giai đoạn thảo luận.</p>}
    </section>
    <section className="blind-panel blind-clue-panel"><div className="blind-panel-heading"><div><p className="blind-section-label">THÔNG TIN RIÊNG</p><h2>Manh mối của bạn</h2></div><span>{state.ownedClues.length} Clue đã biết</span></div>
     {state.phase==='REVEAL'&&!revealReady?<><p role="status">Đang mở Clue của bạn…</p><div className="blind-reel" aria-label="Đang mở manh mối"><span>?</span><span>?</span><span>◆</span><span>?</span><span>?</span></div></>:!state.ownedClues.length?<p className="blind-muted">Clue sẽ xuất hiện khi đủ 4 người.</p>:<div className="blind-clues">{state.ownedClues.map((clue:Clue)=><article className={state.phase==='REVEAL'?'blind-clue blind-reveal':'blind-clue'} key={clue.id}><small>CLUE #{clue.slot} <span>✓ ĐÃ XÁC THỰC</span></small><p>{clue.content}</p>{trade&&<ClueSeller id={id!} clue={clue} busy={busy} listing={state.listings.find(l=>l.clueId===clue.id&&l.sellerId===String(user.id))} act={act}/>}</article>)}</div>}
    </section>
    <section className="blind-panel blind-market"><div className="blind-panel-heading"><div><p className="blind-section-label">TRAO ĐỔI THÔNG TIN</p><h2>Thị trường Clue</h2></div><span>{trade?`${availableListings.length} tin bán`:'Đã đóng'}</span></div>
     <p className="blind-muted">{trade?'Mua quyền xem Clue từ người khác. Người bán vẫn giữ Clue và giao dịch không hoàn Coin.':state.phase==='WAITING'||state.phase==='REVEAL'?'Mở khi kết thúc quay Clue.':state.phase==='DISCUSS'?'Đã đóng. Còn 1 phút thảo luận trước khi bid.':'Đã đóng trước giai đoạn bid.'}</p>
     {trade&&<div className="blind-listings">{availableListings.map((l:Listing)=><article key={l.id}><div className="blind-listing-info"><strong>Clue #{l.slot}</strong><span>Người bán: {l.seller}</span></div><b>{coin(l.price)}</b><button type="button" disabled={busy} onClick={()=>{if(window.confirm(`Mua Clue #${l.slot} của ${l.seller} với ${coin(l.price)}? Giao dịch không hoàn tiền.`))void act(()=>buyClue(id!,l.id,l.version),'Đã mua Clue. Nội dung đã được mở.');}}>Mua Clue</button></article>)}</div>}
     {trade&&!availableListings.length&&<p className="blind-empty">Chưa có Clue mới để mua.</p>}
    </section>
    <section className="blind-panel blind-chat"><div className="blind-panel-heading"><div><p className="blind-section-label">CẢ PHÒNG</p><h2>Thảo luận</h2></div></div><p className="blind-muted">Clue được xác thực là thật. Nội dung chat có thể đúng hoặc sai.</p><div className="blind-chat-list" role="log" aria-live="polite">{chat.length?chat.map(m=><p key={m.messageId}><small>{m.username} · {new Date(m.sentAt).toLocaleTimeString('vi-VN')}</small><span>{m.content}</span></p>):<p className="blind-chat-empty">Chưa có tin nhắn. Hãy bắt đầu thảo luận.</p>}</div><form onSubmit={sendChat}><input aria-label="Tin nhắn trong phòng" value={chatText} onChange={e=>setChatText(e.target.value)} maxLength={500} placeholder="Nhắn tin cho cả phòng"/><button type="submit" disabled={!joined||!chatText.trim()}>Gửi</button></form></section>
    <section className="blind-panel blind-history"><div className="blind-panel-heading"><div><p className="blind-section-label">THAM KHẢO</p><h2>Giá lịch sử sản phẩm</h2></div></div>{Number(state.historicalStats.soldCount)>0?<div className="blind-stats"><div><small>Phiên đã bán</small><strong>{state.historicalStats.soldCount}</strong></div><div><small>Giá trung bình</small><strong>{coin(state.historicalStats.averagePrice)}</strong></div><div><small>Thấp nhất</small><strong>{coin(state.historicalStats.minimumPrice)}</strong></div><div><small>Cao nhất</small><strong>{coin(state.historicalStats.maximumPrice)}</strong></div></div>:<p className="blind-muted">Sản phẩm chưa có phiên bán thành công trước đây.</p>}</section>
   </div></>}
 </main>;
}

function ClueSeller({id,clue,busy,listing,act}:{id:string;clue:Clue;busy:boolean;listing:Listing|undefined;act:(work:()=>Promise<unknown>,success:string)=>Promise<void>}){
 const [price,setPrice]=useState(listing?.price??'');
 useEffect(()=>setPrice(listing?.price??''),[listing?.price]);
 return <div className="blind-sell"><label>Giá bán Clue (Coin)<input inputMode="numeric" value={price} onChange={e=>setPrice(e.target.value)} placeholder="Ví dụ: 50"/></label><button type="button" disabled={busy||!/^[1-9][0-9]{0,18}$/.test(price)} onClick={()=>void act(()=>listClue(id,clue.id,price),listing?'Đã cập nhật giá.':'Đã đăng bán Clue.')}>{listing?'Đổi giá':'Đăng bán'}</button>{listing&&<button type="button" disabled={busy} onClick={()=>void act(()=>cancelClue(id,clue.id),'Đã hủy niêm yết.')}>Hủy bán</button>}</div>;
}
