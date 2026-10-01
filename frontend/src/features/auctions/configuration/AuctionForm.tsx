import { useEffect, useRef, useState } from 'react';
import { Link, useBlocker, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import type { Product } from '../../products/productApi';
import { listAuctions, saveAuction, type Auction } from './auctionApi';
import { localTime, utcTime, validateAuction, type AuctionFields } from './validation';
import ProductPicker from './ProductPicker';
export default function AuctionForm({auction,reload}:{auction?:Auction;reload?:()=>void}){
 const [params]=useSearchParams();const navigate=useNavigate();
 const initial:AuctionFields={auctionType:auction?.auctionType??'NORMAL',accessType:auction?.accessType??'PUBLIC',startingPrice:auction?.startingPrice??'',minBidIncrement:auction?.minBidIncrement??'',maxParticipants:auction?.maxParticipants?.toString()??'',startTime:auction?localTime(auction.startTime):'',endTime:auction?localTime(auction.endTime):''};
 const [f,setF]=useState(initial),[product,setProduct]=useState<Product|null>(null),[errors,setErrors]=useState<Partial<Record<keyof AuctionFields,string>>>({}),[message,setMessage]=useState(''),[confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[blocked,setBlocked]=useState(false),[forbidden,setForbidden]=useState(false),[destination,setDestination]=useState(''),[offset,setOffset]=useState(auction?Date.parse(auction.serverNow)-Date.now():0);
 const alive=useRef(true),sending=useRef(false);useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const blocker=useBlocker(!destination&&(!!product||JSON.stringify(f)!==JSON.stringify(initial)));
 useEffect(()=>{if(destination)navigate(destination,{replace:true});},[destination,navigate]);
 useEffect(()=>{if(auction)return;let live=true;void listAuctions({q:'',status:'',auctionType:'',accessType:''},0).then(data=>{if(live)setOffset(Date.parse(data.serverNow)-Date.now());}).catch(()=>{});return()=>{live=false;};},[]);
 function field(key:keyof AuctionFields,value:string){setF(old=>{const next={...old,[key]:value};if(key==='auctionType'&&value==='BLIND')next.minBidIncrement='';if(key==='accessType'&&value==='PUBLIC')next.maxParticipants='';return next;});setErrors(e=>({...e,[key]:undefined}));setConfirm(false);}
 async function submit(event:React.FormEvent){event.preventDefault();if(sending.current||blocked)return;setMessage('');const errors=validateAuction(f,Date.now()+offset);setErrors(errors);
  if(!auction&&!product){setMessage('Chọn sản phẩm trước khi tạo phiên.');return;}const first=Object.keys(errors)[0];if(first){document.getElementById('auction-'+first)?.focus();return;}
  if(!confirm){setConfirm(true);return;}sending.current=true;setBusy(true);
  const body={auctionType:f.auctionType,accessType:f.accessType,startingPrice:f.startingPrice,minBidIncrement:f.auctionType==='NORMAL'?f.minBidIncrement:null,maxParticipants:f.accessType==='PRIVATE'&&f.maxParticipants?Number(f.maxParticipants):null,startTime:utcTime(f.startTime),endTime:utcTime(f.endTime),...(!auction?{productId:product!.id,productVersion:product!.version}:{})};
  try{const result=await saveAuction(body,auction?.id,auction?.version);if(alive.current)setDestination('/admin/auctions/'+result.id);}
  catch(error){if(!alive.current)return;const status=axios.isAxiosError(error)?error.response?.status:0;const code=axios.isAxiosError(error)?error.response?.data?.code:'';
   setBlocked(!status||status>=500||status===409||status===412);setForbidden(status===403);setConfirm(false);
   setMessage(status===412?(code==='PRODUCT_CHANGED'?'Sản phẩm đã thay đổi. Tải lại trang để chọn bản mới trước khi tạo phiên.':'Cấu hình đã được Admin khác cập nhật. Tải bản mới trước khi lưu.'):status===409?(code==='START_TIME_PASSED'?'Thời gian bắt đầu đã qua. Tải lại trang để cập nhật lịch.':'Phiên đã đến giờ bắt đầu hoặc có người tham gia/hoạt động, không thể sửa.'):status===403?'Bạn không có quyền hoặc phiên xác thực đã thay đổi.':status===400?'Cấu hình không hợp lệ. Kiểm tra giá, loại phiên và thời gian.':status===404?'Phiên hoặc sản phẩm không còn tồn tại.':!status||status>=500?'Chưa xác định kết quả lưu. Kiểm tra danh sách trước khi gửi lại để tránh tạo trùng.':'Chưa thể lưu cấu hình. Vui lòng thử lại.');
  }finally{sending.current=false;if(alive.current)setBusy(false);}
 }
 if(forbidden)return <p role="alert">{message} <Link to="/admin">Về quản trị</Link></p>;
 const zone=Intl.DateTimeFormat().resolvedOptions().timeZone;
 return <><div className="products-heading"><div><Link to="/admin/auctions">← Phiên đấu giá</Link><h1>{auction?'Sửa cấu hình phiên #'+auction.id:'Tạo phiên đấu giá'}</h1><p>Chọn sản phẩm, thiết lập luật và lịch đấu giá.</p></div></div>
 {blocker.state==='blocked'&&<div className="product-info" role="alert">Bạn có cấu hình chưa lưu. <button type="button" disabled={busy} onClick={()=>blocker.proceed()}>Rời trang</button><button type="button" onClick={()=>blocker.reset()}>Tiếp tục chỉnh sửa</button></div>}
 <form onSubmit={submit} noValidate aria-busy={busy}><fieldset disabled={busy||blocked}>
 {auction?<section className="auction-section"><h2>1. Sản phẩm</h2><strong>{auction.product.name}</strong><p>Mã #{auction.productId} · Sản phẩm của phiên không thay đổi sau khi tạo.</p></section>:<ProductPicker selected={product} onSelect={p=>{setProduct(p);setConfirm(false);}} initialId={params.get('productId')} disabled={busy||blocked}/>}
 <section className="auction-section"><h2>2. Hình thức và quyền vào phòng</h2><div className="auction-grid"><label>Loại đấu giá<select value={f.auctionType} onChange={e=>field('auctionType',e.target.value)}><option value="NORMAL">Đấu giá thường (NORMAL)</option><option value="BLIND">Đấu giá mù (BLIND)</option></select></label><label>Quyền vào phòng<select value={f.accessType} onChange={e=>field('accessType',e.target.value)}><option value="PUBLIC">Phòng công khai (PUBLIC)</option><option value="PRIVATE">Phòng riêng (PRIVATE)</option></select></label></div>
 <p>{f.auctionType==='BLIND'?'Người chơi chỉ gửi một giá bí mật; giá khởi điểm chỉ Admin thấy.':'Người chơi nhìn thấy giá hiện tại và lịch sử trả giá.'}</p>{f.accessType==='PRIVATE'&&<p>Mã phòng sẽ được hệ thống tạo. Chỉ chia sẻ với người bạn muốn mời.</p>}</section>
 <section className="auction-section"><h2>3. Giá và lịch đấu giá</h2><p>Thời gian theo múi giờ {zone}. Server kiểm tra thời gian lần cuối khi lưu.</p><div className="auction-grid">
 {(['startingPrice',...(f.auctionType==='NORMAL'?['minBidIncrement']:[]),...(f.accessType==='PRIVATE'?['maxParticipants']:[]),'startTime','endTime'] as (keyof AuctionFields)[]).map(key=><label key={key} htmlFor={'auction-'+key}>{({startingPrice:'Giá khởi điểm (Coin)',minBidIncrement:'Bước giá tối thiểu (Coin)',maxParticipants:'Số người tối đa (để trống nếu không giới hạn)',startTime:'Thời gian bắt đầu',endTime:'Thời gian kết thúc'} as Record<string,string>)[key]}<input id={'auction-'+key} type={key.endsWith('Time')?'datetime-local':'text'} step={key.endsWith('Time')?'1':undefined} inputMode={key.endsWith('Time')?undefined:'numeric'} value={f[key]} onChange={e=>field(key,e.target.value)} aria-invalid={!!errors[key]} aria-describedby={errors[key]?'err-'+key:undefined}/>{errors[key]&&<span className="product-field-error" id={'err-'+key}>{errors[key]}</span>}</label>)}
 </div></section></fieldset>
 {message&&<p role="alert">{message}</p>}{blocked&&<><Link to="/admin/auctions">Kiểm tra danh sách</Link>{reload&&<button type="button" onClick={()=>{if(window.confirm('Bỏ bản nhập và tải cấu hình mới?'))reload();}}>Tải bản mới</button>}</>}
 {confirm&&<div className="product-info" role="status"><strong>Xác nhận cấu hình</strong><p>{auction?.product.name??product?.name} · {f.auctionType} · {f.accessType}</p><p>{new Date(utcTime(f.startTime)!).toLocaleString('vi-VN')} → {new Date(utcTime(f.endTime)!).toLocaleString('vi-VN')} ({zone})</p><p>Giá khởi điểm: {f.startingPrice} Coin. Phiên được tạo ở trạng thái sắp diễn ra.</p></div>}
 <div className="product-actions"><Link to="/admin/auctions">Hủy</Link><button className="product-primary" disabled={busy||blocked} type="submit">{busy?'Đang lưu…':confirm?(auction?'Lưu thay đổi':'Xác nhận tạo phiên'):'Xem lại cấu hình'}</button></div>
 </form></>;
}
