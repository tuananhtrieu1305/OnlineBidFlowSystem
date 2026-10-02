import {useEffect,useState,type FormEvent} from 'react';
import {Link,Navigate,useSearchParams} from 'react-router-dom';
import axios from 'axios';
import {useAuth} from '../../auth/AuthProvider';
import {formatCoin} from '../../wallet/validation';
import type {History} from '../../wallet/walletApi';
import {summary,history,type Summary} from './systemWalletApi';
import {queryFilters,type Filters} from './filters';
import '../../products/products.css';
import './system-wallet.css';
const empty:Filters={auctionId:'',type:'',from:'',to:''};
const labels:Record<string,string>={PAYMENT:'Thanh toán',DEPOSIT:'Nạp Coin',LOCK:'Khóa Coin',UNLOCK:'Mở khóa Coin'};
function message(e:unknown){if(axios.isAxiosError(e)){if(e.response?.status===403)return 'Bạn không có quyền xem ví hệ thống.';if(e.response?.status===409)return 'Cấu hình ví hệ thống không hợp lệ: thiếu hoặc trùng ví SYSTEM. Cần kiểm tra dữ liệu.';if(e.response?.status===400)return 'Bộ lọc hoặc vị trí tải thêm không hợp lệ. Hãy áp dụng lại bộ lọc.';}return e instanceof Error&&!axios.isAxiosError(e)?e.message:'Chưa tải được dữ liệu. Kiểm tra kết nối và thử lại.';}
export default function SystemWalletPage(){
 const {user,loading,failure}=useAuth();
 if(loading)return <p role="status">Đang kiểm tra phiên…</p>;
 if(failure)return <p role="alert">Chưa xác minh được quyền. Thử lại ở thanh bên.</p>;
 if(!user)return <Navigate to="/login" replace/>;if(user.role!=='ADMIN')return <Navigate to="/" replace/>;
 return <Content key={user.id}/>;
}
function Content(){
 const [params,setParams]=useSearchParams();const key=params.toString();
 const active:Filters={auctionId:params.get('auctionId')??'',type:params.get('type')??'',from:params.get('from')??'',to:params.get('to')??''};
 const [draft,setDraft]=useState(active),[validation,setValidation]=useState(''),[attempt,setAttempt]=useState(0);
 useEffect(()=>{setDraft(active);},[key]);
 function apply(e:FormEvent){e.preventDefault();try{queryFilters(draft);setValidation('');setParams(Object.fromEntries(Object.entries(draft).filter(([,v])=>v)));setAttempt(v=>v+1);}catch(e){setValidation(message(e));}}
 return <main id="main-content" tabIndex={-1} className="guest-home products-page system-wallet"><header className="guest-topbar">Không gian quản trị</header><div className="products-heading"><div><p className="guest-kicker">COIN TRONG HỆ THỐNG</p><h1>Ví hệ thống</h1><p>Tra cứu số dư và các khoản thanh toán đã ghi nhận.</p></div><button className="product-primary" onClick={()=>setAttempt(v=>v+1)}>Làm mới</button></div>
 <form className="system-filters" onSubmit={apply}><label>Mã phiên<input value={draft.auctionId} inputMode="numeric" maxLength={19} onChange={e=>setDraft(f=>({...f,auctionId:e.target.value}))}/></label><label>Từ ngày<input type="date" value={draft.from} onChange={e=>setDraft(f=>({...f,from:e.target.value}))}/></label><label>Đến ngày<input type="date" value={draft.to} onChange={e=>setDraft(f=>({...f,to:e.target.value}))}/></label><label>Loại giao dịch<select value={draft.type} onChange={e=>setDraft(f=>({...f,type:e.target.value}))}><option value="">Tất cả</option>{Object.entries(labels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><button type="submit">Áp dụng</button><button type="button" onClick={()=>{setDraft(empty);setParams({});setValidation('');setAttempt(v=>v+1);}}>Xóa bộ lọc</button></form>
 <p>Ngày theo múi giờ {Intl.DateTimeFormat().resolvedOptions().timeZone}, bao gồm hết ngày kết thúc.</p>{validation&&<p role="alert">{validation}</p>}<Data key={key+'|'+attempt} filters={active}/></main>;
}
function Data({filters}:{filters:Filters}){
 const [balance,setBalance]=useState<Summary|null>(null),[data,setData]=useState<History|null>(null),[cursor,setCursor]=useState<string|null>(null),[error,setError]=useState(''),[fatal,setFatal]=useState(false),[busy,setBusy]=useState(true),[retry,setRetry]=useState(0),[balanceError,setBalanceError]=useState('');
 function fail(e:unknown){if(axios.isAxiosError(e)&&[401,403,409].includes(e.response?.status??0)){setFatal(true);setBalance(null);setData(null);}return message(e);}
 useEffect(()=>{const abort=new AbortController();void summary(abort.signal).then(v=>{if(!abort.signal.aborted){setBalance(v);setBalanceError('');}}).catch(e=>{if(!abort.signal.aborted)setBalanceError(fail(e));});return()=>abort.abort();},[retry]);
 useEffect(()=>{const abort=new AbortController();setBusy(true);setError('');void history(filters,cursor,abort.signal).then(v=>{if(!abort.signal.aborted)setData(old=>({items:cursor?[...new Map([...(old?.items??[]),...v.items].map(i=>[i.id,i])).values()]:v.items,nextCursor:v.nextCursor}));}).catch(e=>{if(!abort.signal.aborted)setError(fail(e));}).finally(()=>{if(!abort.signal.aborted)setBusy(false);});return()=>abort.abort();},[cursor,retry]);
 if(fatal)return <p role="alert">{balanceError||error} Dùng Làm mới để kiểm tra lại.</p>;
 return <>{balanceError?<p role="alert">{balanceError}</p>:balance?<><div className="system-balances" aria-label="Số liệu ví hệ thống">{[['Số dư hiện tại',balance.availableBalance],['Tổng Coin nhận từ thanh toán',balance.totalReceivedCoin],['Coin đang khóa',balance.lockedBalance]].map(([label,value])=><section key={label}><p>{label}</p><strong>{formatCoin(value)}</strong></section>)}</div><p>Tổng nhận tính trên toàn bộ lịch sử, không đổi theo bộ lọc. Coin là đơn vị giả lập.</p><p>Cập nhật ví: {new Date(balance.updatedAt).toLocaleString('vi-VN')}</p>{BigInt(balance.lockedBalance)!==0n&&<p role="alert">Ví hệ thống có Coin đang khóa. Cần kiểm tra dữ liệu.</p>}</>:<p role="status">Đang tải số dư…</p>}
 <h2>Lịch sử giao dịch</h2>{error&&<p role="alert">{error}</p>}{(error||balanceError)&&<button onClick={()=>setRetry(v=>v+1)}>Thử lại</button>}{busy&&<p role="status">Đang tải giao dịch…</p>}{data&&<><div className="product-table-wrap"><table className="product-table"><thead><tr><th>Mã / thời gian</th><th>Loại</th><th>Thay đổi khả dụng</th><th>Thay đổi đang khóa</th><th>Phiên</th></tr></thead><tbody>{data.items.map(t=><tr key={t.id}><td>#{t.id}<small>{new Date(t.createdAt).toLocaleString('vi-VN')}</small></td><td>{labels[t.type]}</td><td>{BigInt(t.availableDelta)>0n?'+':''}{formatCoin(t.availableDelta)}</td><td>{BigInt(t.lockedDelta)>0n?'+':''}{formatCoin(t.lockedDelta)}</td><td>{t.auctionId?<Link to={'/admin/auctions/'+t.auctionId}>#{t.auctionId}</Link>:'Không gắn phiên'}</td></tr>)}</tbody></table></div>{!data.items.length&&!busy&&<p>Chưa có giao dịch phù hợp.</p>}{data.nextCursor&&<button disabled={busy||!!error} onClick={()=>setCursor(data.nextCursor)}>Tải thêm</button>}</>}</>;
}
