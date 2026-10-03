import {useEffect,useState} from 'react';
import {Link,useParams} from 'react-router-dom';
import client from '../../../api/axiosClient';
import {imageSource} from '../../products/productApi';
import {useAuth} from '../../auth/AuthProvider';
import {auctionStatusLabel} from '../auctionStatus';
import {watchAuctionUpdates} from '../watchAuctionUpdates';
import './discovery.css';

type Auction={id:string;auctionType:'NORMAL'|'BLIND';status:string;startTime:string;endTime:string;serverNow?:string;startingPrice?:string;currentPrice?:string;minBidIncrement?:string;product:{id:string;name:string;imageUrl:string|null;description?:string|null;quantity?:number}};
type AuctionPage={items:Auction[];page:number;totalPages:number;totalElements:string};
const statuses:Record<string,string>={UPCOMING:'Sắp diễn ra',RUNNING:'Đang diễn ra',SOLD:'Đã bán',UNSOLD:'Chưa bán được'};
const date=(value:string)=>new Date(value).toLocaleString('vi-VN');
const coin=(value?:string)=>value===undefined?'—':new Intl.NumberFormat('vi-VN').format(BigInt(value))+' Coin';
function ProductImage({auction}:{auction:Auction}){
 const [failed,setFailed]=useState(false);const src=imageSource(auction.product.imageUrl);
 useEffect(()=>setFailed(false),[src]);
 return src&&!failed?<img className="discovery-image" src={src} alt={auction.product.name} onError={()=>setFailed(true)}/>:<div className="discovery-image discovery-placeholder" aria-label="Chưa có ảnh sản phẩm">◇</div>;
}
function Price({auction}:{auction:Auction}){
 return auction.auctionType==='BLIND'?<p className="discovery-price">Giá trả được giữ kín.</p>:<p className="discovery-price">{coin(auction.currentPrice)}<small>{auction.status==='UPCOMING'?'Giá khởi điểm':'Giá cao nhất ghi nhận'}</small></p>;
}
export function DiscoveryList(){
 const [q,setQ]=useState(''),[type,setType]=useState(''),[status,setStatus]=useState(''),[page,setPage]=useState(0),[reload,setReload]=useState(0);
 const [data,setData]=useState<AuctionPage|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(false);
 useEffect(()=>{
  const controller=new AbortController();let pending=false;setLoading(true);setError(false);setData(null);
  const load=()=>{if(pending)return;pending=true;void client.get<AuctionPage>('/api/discovery/auctions',{params:{q,auctionType:type,status,page,size:12},signal:controller.signal})
   .then(r=>{if(!controller.signal.aborted){setData(r.data);setError(false);}})
   .catch(()=>{if(!controller.signal.aborted)setError(true);})
   .finally(()=>{pending=false;if(!controller.signal.aborted)setLoading(false);});};
  load();const stop=watchAuctionUpdates(load);
  return()=>{controller.abort();stop();};
 },[q,type,status,page,reload]);
 return <div className="discovery">
  <div className="discovery-filters">
   <label>Tìm sản phẩm<input value={q} maxLength={255} placeholder="Tên sản phẩm bạn quan tâm" onChange={e=>{setQ(e.target.value);setPage(0);}}/></label>
   <label>Loại đấu giá<select value={type} onChange={e=>{setType(e.target.value);setPage(0);}}><option value="">Tất cả loại</option><option value="NORMAL">Đấu giá thường</option><option value="BLIND">Đấu giá mù</option></select></label>
   <label>Trạng thái<select value={status} onChange={e=>{setStatus(e.target.value);setPage(0);}}><option value="">Tất cả trạng thái</option>{Object.entries(statuses).map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label>
   <button type="button" onClick={()=>setReload(v=>v+1)} disabled={loading}>Làm mới</button>
  </div>
  <p className="discovery-note">Các phiên công khai · Phiên riêng tư không xuất hiện tại đây.</p>
  {loading?<p role="status">Đang tải phiên đấu giá…</p>:error?<div role="alert">Chưa tải được danh sách phiên. Hãy kiểm tra kết nối. <button onClick={()=>setReload(v=>v+1)}>Thử lại</button></div>:data&&<>
   {!data.items.length?<div className="guest-empty"><h3>Chưa có phiên phù hợp</h3><p>Thử đổi bộ lọc hoặc quay lại sau khi Admin tạo phiên công khai.</p></div>:<div className="discovery-grid">{data.items.map(a=><article className="discovery-card" key={a.id}>
    <ProductImage auction={a}/><div className="discovery-card-body"><div className="discovery-meta"><span>{auctionStatusLabel(a)}</span><span>#{a.id}</span></div>
    <h3><Link to={'/auctions/'+a.id} aria-label={'Xem phiên '+a.product.name}>{a.product.name}</Link></h3>
    <p>{a.auctionType==='NORMAL'?'Đấu giá thường':'Đấu giá mù'}</p><Price auction={a}/>
    <p className="discovery-note">{a.status==='UPCOMING'?'Bắt đầu: ':'Kết thúc: '}{date(a.status==='UPCOMING'?a.startTime:a.endTime)}</p></div>
   </article>)}</div>}
   <nav className="discovery-pagination" aria-label="Phân trang phiên"><button disabled={page===0} onClick={()=>setPage(p=>p-1)}>Trang trước</button><span>{data.totalElements} phiên · Trang {page+1}/{Math.max(1,data.totalPages)}</span><button disabled={page+1>=data.totalPages} onClick={()=>setPage(p=>p+1)}>Trang sau</button></nav>
  </>}
 </div>;
}
export function DiscoveryDetail(){
 const {id}=useParams();const {user}=useAuth();const [data,setData]=useState<Auction|null>(null),[error,setError]=useState(''),[reload,setReload]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();let pending=false;setData(null);setError('');
  const load=()=>{if(pending)return;pending=true;void client.get<Auction>('/api/discovery/auctions/'+encodeURIComponent(id??''),{signal:controller.signal})
   .then(r=>{if(!controller.signal.aborted){setData(r.data);setError('');}})
   .catch(e=>{if(!controller.signal.aborted)setError(e.response?.status===404?'Phiên không tồn tại hoặc không được công khai.':'Chưa tải được phiên. Hãy kiểm tra kết nối.');}).finally(()=>{pending=false;});};
  load();const stop=watchAuctionUpdates(load);
  return()=>{controller.abort();stop();};
 },[id,reload]);
 return <main id="main-content" className="guest-home discovery" tabIndex={-1}><Link to="/">← <span>Quay lại khám phá</span></Link>
  {error?<div role="alert">{error} <button onClick={()=>setReload(v=>v+1)}>Thử lại</button></div>:!data?<p role="status">Đang tải phiên đấu giá…</p>:<>
   <div className="discovery-detail"><section><ProductImage auction={data}/><h2>Thông tin sản phẩm</h2><p className="discovery-description">{data.product.description||'Chưa có mô tả sản phẩm.'}</p><p>Số lượng: {data.product.quantity}</p></section>
   <section><p className="discovery-meta">PHIÊN #{data.id} · {auctionStatusLabel(data)}</p><h1>{data.product.name}</h1><p>{data.auctionType==='NORMAL'?'Đấu giá thường':'Đấu giá mù'} · Công khai</p><Price auction={data}/>
    {data.auctionType==='NORMAL'&&<dl><dt>Giá khởi điểm</dt><dd>{coin(data.startingPrice)}</dd><dt>Bước giá tối thiểu</dt><dd>{coin(data.minBidIncrement)}</dd></dl>}
    <dl><dt>Bắt đầu</dt><dd>{date(data.startTime)}</dd><dt>Kết thúc</dt><dd>{date(data.endTime)}</dd></dl>
    <div className="discovery-notice"><strong>Bạn đang xem thông tin phiên.</strong><p>Chức năng tham gia phòng và trả giá chưa được mở.</p>{!user&&<p><Link to="/login">Đăng nhập</Link> hoặc <Link to="/register">tạo tài khoản</Link> để chuẩn bị ví Coin.</p>}</div>
    <p className="discovery-note">Coin là đơn vị giả lập, chỉ có giá trị trong hệ thống. Thông tin tự cập nhật mỗi 10 giây khi bạn đang xem.</p>
   </section></div>
  </>}
 </main>;
}
