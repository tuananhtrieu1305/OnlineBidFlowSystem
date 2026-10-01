import { useEffect,useRef,useState } from 'react';
import { Link,Navigate,useParams,useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../auth/AuthProvider';
import { getUser,getUserHistory,listUsers,type UserPage,type UserDetail } from './adminUsersApi';
import type { History } from '../../wallet/walletApi';
import '../../products/products.css';
import './users.css';
const coin=(value:string)=>new Intl.NumberFormat('vi-VN').format(BigInt(value));
const types:Record<string,string>={DEPOSIT:'Nạp Coin',LOCK:'Khóa Coin',UNLOCK:'Mở khóa Coin',PAYMENT:'Thanh toán'};
function errorText(error:unknown){const status=axios.isAxiosError(error)?error.response?.status:0;return status===403?'Bạn không có quyền xem dữ liệu này.':status===404?'Không tìm thấy tài khoản.':'Chưa tải được dữ liệu. Kiểm tra kết nối và thử lại.';}
export default function AdminUsersPage(){
 const {user,loading,failure}=useAuth();const {id}=useParams();
 if(loading)return <p role="status">Đang kiểm tra phiên…</p>;
 if(failure)return <p role="alert">Chưa xác minh được quyền. Hãy thử lại ở thanh bên.</p>;
 if(!user)return <Navigate to="/login" replace/>;
 if(user.role!=='ADMIN')return <Navigate to="/" replace/>;
 return <main id="main-content" tabIndex={-1} className="guest-home products-page"><header className="guest-topbar">Không gian quản trị<span>Thông tin tài khoản và Coin</span></header>{id?<Detail key={id} id={id}/>:<UserList/>}</main>;
}
function UserList(){
 const [params,setParams]=useSearchParams();const q=params.get('q')??'',role=params.get('role')??'';const raw=Number(params.get('page')??0),page=Number.isSafeInteger(raw)&&raw>=0?raw:0;
 const [data,setData]=useState<UserPage|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{const abort=new AbortController();setData(null);setError('');const timer=setTimeout(()=>{void listUsers(q,role,page,abort.signal).then(v=>{if(!abort.signal.aborted)setData(v);}).catch(e=>{if(!abort.signal.aborted)setError(errorText(e));});},300);return()=>{abort.abort();clearTimeout(timer);};},[q,role,page,retry]);
 function filter(key:string,value:string){setParams(old=>{const p=new URLSearchParams(old);p.set(key,value);if(key!=='page')p.delete('page');return p;},{replace:true});}
 return <><div className="products-heading"><div><p className="guest-kicker">QUẢN LÝ TÀI KHOẢN</p><h1>Người dùng</h1><p>Tra cứu tài khoản, số dư và lịch sử Coin.</p></div></div>
 <div className="users-filters"><label>Tìm người dùng<input value={q} maxLength={50} placeholder="Tên đăng nhập hoặc mã tài khoản" onChange={e=>filter('q',e.target.value)}/></label><label>Vai trò<select value={role} onChange={e=>filter('role',e.target.value)}><option value="">Tất cả</option><option value="USER">Người dùng</option><option value="ADMIN">Quản trị viên</option></select></label></div>
 {error?<p role="alert">{error} <button onClick={()=>setRetry(v=>v+1)}>Thử lại</button></p>:!data?<p role="status">Đang tải người dùng…</p>:<><div className="product-table-wrap"><table className="product-table"><thead><tr><th>Mã</th><th>Tên đăng nhập</th><th>Vai trò</th><th>Chi tiết</th></tr></thead><tbody>{data.items.map(u=><tr key={u.id}><td>#{u.id}</td><td>{u.username}</td><td>{u.role==='ADMIN'?'Quản trị viên':'Người dùng'}</td><td><Link aria-label={'Xem '+u.username} to={'/admin/users/'+u.id+'?'+params.toString()}>Xem tài khoản →</Link></td></tr>)}</tbody></table></div>{!data.items.length&&<p>Không tìm thấy tài khoản phù hợp.</p>}<div className="product-pagination"><button disabled={page===0} onClick={()=>filter('page',String(page-1))}>Trang trước</button><span>{data.totalElements} tài khoản · Trang {page+1}/{Math.max(data.totalPages,1)}</span><button disabled={page+1>=data.totalPages} onClick={()=>filter('page',String(page+1))}>Trang sau</button></div></>}
 </>;
}
function Detail({id}:{id:string}){
 const [params]=useSearchParams();const [user,setUser]=useState<UserDetail|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{const abort=new AbortController();setUser(null);setError('');void getUser(id,abort.signal).then(v=>{if(!abort.signal.aborted)setUser(v);}).catch(e=>{if(!abort.signal.aborted)setError(errorText(e));});return()=>abort.abort();},[id,retry]);
 return <><Link to={'/admin/users?'+params.toString()}>← Người dùng</Link>{error?<p role="alert">{error} <button onClick={()=>setRetry(v=>v+1)}>Thử lại</button></p>:!user?<p role="status">Đang tải tài khoản…</p>:<><div className="products-heading"><div><p className="guest-kicker">TÀI KHOẢN #{user.id}</p><h1>{user.username}</h1><p>{user.role==='ADMIN'?'Quản trị viên':'Người dùng'}</p></div></div>{user.walletState==='AVAILABLE'&&user.wallet?<><div className="users-balances" aria-label="Số dư người dùng"><section><p>Coin khả dụng</p><strong>{coin(user.wallet.availableBalance)}</strong></section><section><p>Coin đang khóa</p><strong>{coin(user.wallet.lockedBalance)}</strong></section></div><p>Coin là đơn vị giả lập trong hệ thống. Cập nhật ví: {new Date(user.wallet.updatedAt).toLocaleString('vi-VN')}.</p><UserHistory id={id} deny={()=>{setUser(null);setError('Bạn không còn quyền xem dữ liệu này.');}}/></>:<p className="product-info">{user.walletState==='MISSING'?'Tài khoản thiếu ví. Cần kiểm tra dữ liệu; hệ thống không tự tạo ví khi xem.':'Tài khoản quản trị không dùng ví cá nhân.'}</p>}</> }</>;
}
function UserHistory({id,deny}:{id:string;deny:()=>void}){
 const [type,setType]=useState(''),[cursor,setCursor]=useState<string|null>(null),[data,setData]=useState<History|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0);const denied=useRef(deny);denied.current=deny;
 useEffect(()=>{const abort=new AbortController();setBusy(true);setError('');void getUserHistory(id,type,cursor,abort.signal).then(v=>{if(!abort.signal.aborted)setData(old=>({items:cursor?[...new Map([...(old?.items??[]),...v.items].map(i=>[i.id,i])).values()]:v.items,nextCursor:v.nextCursor}));}).catch(e=>{if(!abort.signal.aborted){if(axios.isAxiosError(e)&&e.response?.status===403){setData(null);denied.current();}else setError(errorText(e));}}).finally(()=>{if(!abort.signal.aborted)setBusy(false);});return()=>abort.abort();},[id,type,cursor,retry]);
 return <section><h2>Lịch sử Coin</h2><label>Loại giao dịch<select value={type} onChange={e=>{setType(e.target.value);setCursor(null);setData(null);}}><option value="">Tất cả</option>{Object.entries(types).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>{error&&<p role="alert">{error} <button onClick={()=>setRetry(v=>v+1)}>Thử lại</button></p>}{busy&&<p role="status">Đang tải giao dịch…</p>}{data&&<><div className="product-table-wrap"><table className="product-table"><thead><tr><th>Thời gian</th><th>Loại</th><th>Δ Khả dụng</th><th>Δ Đang khóa</th><th>Phiên</th></tr></thead><tbody>{data.items.map(e=><tr key={e.id}><td>{new Date(e.createdAt).toLocaleString('vi-VN')}</td><td>{types[e.type]}</td><td>{coin(e.availableDelta)}</td><td>{coin(e.lockedDelta)}</td><td>{e.auctionId?<Link to={'/admin/auctions/'+e.auctionId}>#{e.auctionId}</Link>:'—'}</td></tr>)}</tbody></table></div>{!data.items.length&&!busy&&<p>Chưa có giao dịch phù hợp.</p>}{data.nextCursor&&<button disabled={busy||!!error} onClick={()=>setCursor(data.nextCursor)}>Tải thêm giao dịch</button>}</>}</section>;
}
