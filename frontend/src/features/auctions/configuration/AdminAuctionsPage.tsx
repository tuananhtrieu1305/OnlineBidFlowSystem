import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { getAuction, listAuctions, type Auction, type AuctionPage, type Filters } from './auctionApi';
import AuctionForm from './AuctionForm';
import '../../products/products.css';
import './auctions.css';
const statuses={UPCOMING:'Sắp diễn ra',RUNNING:'Đang diễn ra',SOLD:'Đã bán',UNSOLD:'Chưa bán'};
const date=(value:string)=>new Date(value).toLocaleString('vi-VN');
export default function AdminAuctionsPage(){
 const {user,loading,failure}=useAuth();const {id}=useParams();const location=useLocation();
 if(loading)return <main className="guest-home"><p role="status">Đang kiểm tra phiên…</p></main>;
 if(failure)return <main className="guest-home"><p role="alert">Chưa thể xác minh quyền. Thử lại ở thanh bên.</p></main>;
 if(!user)return <Navigate to="/login" replace/>;
 if(user.role!=='ADMIN')return <Navigate to="/" replace/>;
 return <main id="main-content" className="guest-home products-page auctions-page"><header className="guest-topbar">Không gian quản trị<span className="guest-topnote">Chuẩn bị mỗi phiên đấu giá.</span></header>{id?<Detail key={location.pathname} id={id} edit={location.pathname.endsWith('/edit')}/>:location.pathname.endsWith('/new')?<AuctionForm/>:<List/>}</main>;
}
function List(){
 const [filters,setFilters]=useState<Filters>({q:'',status:'',auctionType:'',accessType:''}),[page,setPage]=useState(0),[data,setData]=useState<AuctionPage|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0);
 useEffect(()=>{const abort=new AbortController();setLoading(true);setData(null);setError('');const timer=setTimeout(()=>{void listAuctions(filters,page,abort.signal).then(value=>{if(!abort.signal.aborted)setData(value);}).catch(()=>{if(!abort.signal.aborted)setError('Chưa tải được phiên đấu giá. Kiểm tra kết nối hoặc quyền truy cập.');}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});},250);return()=>{abort.abort();clearTimeout(timer);};},[filters,page,retry]);
 function filter(key:keyof Filters,value:string){setFilters(f=>({...f,[key]:value}));setPage(0);}
 return <><div className="products-heading"><div><p className="guest-kicker">CẤU HÌNH ĐẤU GIÁ</p><h1>Phiên đấu giá</h1><p>Tổ chức phiên từ những sản phẩm đã chuẩn bị.</p></div><Link className="product-primary" to="/admin/auctions/new">＋ Tạo phiên</Link></div>
 <div className="auction-filters"><label>Tìm phiên<input value={filters.q} maxLength={255} placeholder="Tên sản phẩm hoặc mã phiên" onChange={e=>filter('q',e.target.value)}/></label><label>Trạng thái<select value={filters.status} onChange={e=>filter('status',e.target.value)}><option value="">Tất cả</option>{Object.entries(statuses).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>Loại đấu giá<select value={filters.auctionType} onChange={e=>filter('auctionType',e.target.value)}><option value="">Tất cả</option><option value="NORMAL">Đấu giá thường</option><option value="BLIND">Đấu giá mù</option></select></label><label>Quyền vào phòng<select value={filters.accessType} onChange={e=>filter('accessType',e.target.value)}><option value="">Tất cả</option><option value="PUBLIC">Công khai</option><option value="PRIVATE">Riêng</option></select></label></div>
 {error?<p role="alert">{error} <button onClick={()=>setRetry(v=>v+1)}>Thử lại</button></p>:loading?<p role="status">Đang tải phiên…</p>:<><div className="product-table-wrap"><table className="product-table"><thead><tr><th>Phiên / sản phẩm</th><th>Loại / quyền vào</th><th>Lịch đấu giá</th><th>Trạng thái</th></tr></thead><tbody>{data?.items.map(a=><tr key={a.id}><td><Link to={'/admin/auctions/'+a.id}><span><strong>{a.product.name}</strong><small>Phiên #{a.id}</small></span></Link></td><td>{a.auctionType==='NORMAL'?'Đấu giá thường':'Đấu giá mù'}<small>{a.accessType==='PUBLIC'?'Công khai':'Phòng riêng'}</small></td><td>{date(a.startTime)}<small>Đến {date(a.endTime)}</small></td><td>{statuses[a.status]}<small>{a.participantCount} người tham gia</small></td></tr>)}</tbody></table></div>{!data?.items.length&&<div className="product-empty"><h2>Chưa có phiên phù hợp</h2><p>Tạo phiên mới hoặc điều chỉnh bộ lọc.</p></div>}<div className="product-pagination"><button disabled={page===0} onClick={()=>setPage(v=>v-1)}>Trang trước</button><span>Trang {page+1}/{Math.max(data?.totalPages??1,1)}</span><button disabled={!data||page+1>=data.totalPages} onClick={()=>setPage(v=>v+1)}>Trang sau</button></div></>}
 </>;
}
function Detail({id,edit}:{id:string;edit:boolean}){
 const [a,setA]=useState<Auction|null>(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0),[visible,setVisible]=useState(false),[notice,setNotice]=useState('');
 useEffect(()=>{let alive=true;setA(null);setError('');setVisible(false);void getAuction(id).then(value=>{if(alive)setA(value);}).catch(()=>{if(alive)setError('Không tải được phiên. Phiên có thể không tồn tại hoặc bạn không còn quyền truy cập.');});return()=>{alive=false;};},[id,attempt]);
 if(error)return <><Link to="/admin/auctions">← Phiên đấu giá</Link><p role="alert">{error}</p><button onClick={()=>setAttempt(v=>v+1)}>Thử lại</button></>;
 if(!a)return <p role="status">Đang tải cấu hình…</p>;
 if(edit&&a.editable)return <AuctionForm auction={a} reload={()=>setAttempt(v=>v+1)}/>;
 const price=(v:string|null)=>v?new Intl.NumberFormat('vi-VN').format(BigInt(v))+' Coin':'—';
 return <><div className="products-heading"><div><Link to="/admin/auctions">← Phiên đấu giá</Link><h1>Phiên #{a.id}</h1><p>{a.product.name}</p></div>{a.editable&&<Link className="product-primary" to={'/admin/auctions/'+a.id+'/edit'}>Sửa cấu hình</Link>}</div>
 {!a.editable&&<p className="product-info">{a.editBlockedReason==='START_TIME_REACHED'?'Đã đến giờ bắt đầu, chờ hệ thống cập nhật. Không thể sửa cấu hình.':'Phiên đã có hoạt động hoặc không còn ở trạng thái sắp diễn ra nên không thể sửa.'}</p>}
 <section className="auction-section"><h2>Cấu hình phiên</h2><dl className="auction-info"><div><dt>Sản phẩm</dt><dd><Link to={'/admin/products/'+a.productId}>{a.product.name} ↗</Link></dd></div><div><dt>Trạng thái</dt><dd>{statuses[a.status]}</dd></div><div><dt>Loại đấu giá</dt><dd>{a.auctionType==='NORMAL'?'Đấu giá thường (NORMAL)':'Đấu giá mù (BLIND)'}</dd></div><div><dt>Quyền vào phòng</dt><dd>{a.accessType==='PUBLIC'?'Công khai (PUBLIC)':'Phòng riêng (PRIVATE)'}</dd></div><div><dt>Giá khởi điểm · Admin</dt><dd>{price(a.startingPrice)}</dd></div><div><dt>Bước giá</dt><dd>{price(a.minBidIncrement)}</dd></div><div><dt>Bắt đầu</dt><dd>{date(a.startTime)}</dd></div><div><dt>Kết thúc</dt><dd>{date(a.endTime)}</dd></div><div><dt>Người tham gia</dt><dd>{a.participantCount} / {a.maxParticipants??'Không giới hạn'}</dd></div></dl>
 {a.accessType==='PRIVATE'&&<div className="auction-room-code"><span>Mã phòng</span><strong>{visible?a.roomCode:'••••••••••••'}</strong><button onClick={()=>setVisible(v=>!v)}>{visible?'Ẩn mã':'Hiện mã'}</button><button onClick={()=>{void navigator.clipboard.writeText(a.roomCode??'').then(()=>setNotice('Đã sao chép mã phòng.')).catch(()=>setNotice('Chưa sao chép được. Hãy hiện mã và sao chép thủ công.'));}}>Sao chép mã</button></div>}{notice&&<p role="status">{notice}</p>}</section>
 </>;
}
