import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../auth/AuthProvider';
import { deposit, getHistory, getWallet, type Entry, type Wallet } from './walletApi';
import { formatCoin, validateAmount } from './validation';
import './wallet.css';

const labels: Record<Entry['type'], string> = { DEPOSIT:'Nạp Coin', LOCK:'Khóa Coin', UNLOCK:'Hoàn Coin', PAYMENT:'Thanh toán' };
function delta(value: string) { return (BigInt(value)>0n?'+':'')+formatCoin(value); }
export default function WalletPage() {
 const { user, loading, failure } = useAuth();
 if(loading) return <main className="guest-home"><p role="status">Đang kiểm tra phiên đăng nhập…</p></main>;
 if(!user) return <Navigate to="/login" replace />;
 if(user.role!=='USER') return <Navigate to="/admin" replace />;
 if(failure) return <main className="guest-home"><p role="alert">Chưa thể xác minh phiên. Hãy thử lại ở thanh bên.</p></main>;
 return <WalletContent key={user.id}/>;
}
function WalletContent() {
 const [wallet,setWallet]=useState<Wallet|null>(null);
 const [items,setItems]=useState<Entry[]>([]);
 const [cursor,setCursor]=useState<string|null>(null);
 const [type,setType]=useState('');
 const [walletError,setWalletError]=useState('');
 const [historyError,setHistoryError]=useState('');
 const [busy,setBusy]=useState(false);
 const [loadingHistory,setLoadingHistory]=useState(false);
 const [amount,setAmount]=useState('');
 const [depositError,setDepositError]=useState('');
 const [notice,setNotice]=useState('');
 const [uncertain,setUncertain]=useState(false);
 const [open,setOpen]=useState(false);
 const dialog=useRef<HTMLDialogElement>(null);
 const trigger=useRef<HTMLButtonElement>(null);
 const input=useRef<HTMLInputElement>(null);
 const sending=useRef(false);
 const alive=useRef(true);
 const historyVersion=useRef(0);
 const walletVersion=useRef(0);
 const loadBalance=useCallback(async()=>{
  const version=++walletVersion.current;
  try{const data=await getWallet();if(alive.current&&version===walletVersion.current){setWallet(data);setWalletError('');}}
  catch{if(alive.current&&version===walletVersion.current)setWalletError('Chưa thể tải ví. Vui lòng thử lại.');}
 },[]);
 const loadHistory=useCallback(async(next?:string)=>{
  const version=++historyVersion.current;setLoadingHistory(true);
  try{const data=await getHistory(type,next);if(alive.current&&version===historyVersion.current){
   setItems(current=>next?[...current,...data.items.filter(e=>!current.some(old=>old.id===e.id))]:data.items);setCursor(data.nextCursor);setHistoryError('');
  }}catch{if(alive.current&&version===historyVersion.current)setHistoryError('Chưa thể tải lịch sử giao dịch.');}
  finally{if(alive.current&&version===historyVersion.current)setLoadingHistory(false);}
 },[type]);
 useEffect(()=>{alive.current=true;void loadBalance();const focus=()=>{if(!sending.current)void loadBalance();};window.addEventListener('focus',focus);
  return()=>{alive.current=false;++walletVersion.current;++historyVersion.current;window.removeEventListener('focus',focus);};},[loadBalance]);
 useEffect(()=>{setItems([]);setCursor(null);void loadHistory();},[loadHistory]);
 useEffect(()=>{const focus=()=>{if(!sending.current)void loadHistory();};window.addEventListener('focus',focus);
  return()=>window.removeEventListener('focus',focus);},[loadHistory]);
 useEffect(()=>{if(open){dialog.current?.showModal();input.current?.focus();}else if(dialog.current?.open){dialog.current.close();trigger.current?.focus();}},[open]);
 function close(){if(sending.current)return;setOpen(false);trigger.current?.focus();}
 async function submit(event:FormEvent){
  event.preventDefault();if(sending.current||uncertain)return;
  const invalid=validateAmount(amount);if(invalid){setDepositError(invalid);input.current?.focus();return;}
  sending.current=true;setBusy(true);setDepositError('');++walletVersion.current;
  try{
   const data=await deposit(amount);
   if(alive.current){setWallet(data);setWalletError('');setNotice('Đã nạp '+formatCoin(amount)+' Coin vào ví.');setOpen(false);setAmount('');void loadHistory();trigger.current?.focus();}
  }catch(error){
   if(!alive.current)return;
   const status=axios.isAxiosError(error)?error.response?.status:undefined;
   if(!status||status>=500){setUncertain(true);setDepositError('Chưa xác định kết quả nạp. Kiểm tra số dư và lịch sử trước khi nạp tiếp.');}
   else setDepositError(status===429?'Bạn đã nạp quá nhiều lần. Vui lòng thử lại sau một phút.':status===409?'Số dư vượt giới hạn cho phép.':status===403?'Phiên xác thực đã thay đổi. Đóng hộp thoại và thử lại.':status===401?'Phiên đăng nhập đã hết hạn.':'Số Coin không hợp lệ. Vui lòng kiểm tra lại.');
  }finally{sending.current=false;if(alive.current)setBusy(false);}
 }
 return <main id="main-content" className="guest-home wallet-page" tabIndex={-1}>
  <header className="guest-topbar"><span>Ví Coin</span><span className="guest-topnote">Sẵn sàng cho lựa chọn tiếp theo.</span></header>
  <section className="wallet-heading"><div><p className="guest-kicker">VÍ CỦA BẠN</p><h1>Coin cho điều bạn thích.</h1><p>Coin giả lập, chỉ có giá trị trong hệ thống.</p></div>
   <button ref={trigger} className="wallet-button" onClick={()=>{setDepositError('');setUncertain(false);setOpen(true);}}>＋ Nạp Coin</button></section>
  {notice&&<p className="wallet-notice" role="status">{notice}</p>}
  {walletError&&<p role="alert">{walletError} <button onClick={()=>void loadBalance()}>Thử lại</button></p>}
  <section className="wallet-balances" aria-label="Số dư ví">
   <article className="wallet-available"><p>Coin khả dụng</p><strong>{wallet?formatCoin(wallet.availableBalance):'—'} <small>Coin</small></strong><span>Sẵn sàng để tham gia đấu giá</span></article>
   <article><p>Coin đang khóa</p><strong>{wallet?formatCoin(wallet.lockedBalance):'—'} <small>Coin</small></strong><span>Đang được giữ cho các phiên đấu giá</span></article>
  </section>
  <section className="wallet-history" aria-labelledby="history-title">
   <div className="wallet-history-heading"><h2 id="history-title">Lịch sử giao dịch</h2><label>Lọc giao dịch <select value={type} onChange={e=>setType(e.target.value)}>
    <option value="">Tất cả</option>{Object.entries(labels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></div>
   {historyError&&<p role="alert">{historyError} <button onClick={()=>void loadHistory()}>Thử lại</button></p>}
   <div className="wallet-table-scroll"><table><thead><tr><th>Giao dịch</th><th>Thời gian</th><th>Phiên</th><th>Khả dụng</th><th>Đang khóa</th></tr></thead><tbody>
    {items.map(item=><tr key={item.id}><td><strong>{labels[item.type]}</strong><small>#{item.id}</small></td><td>{new Date(item.createdAt).toLocaleString('vi-VN')}</td><td>{item.auctionId?'#'+item.auctionId:'—'}</td><td>{delta(item.availableDelta)}</td><td>{delta(item.lockedDelta)}</td></tr>)}
   </tbody></table></div>
   {!items.length&&!loadingHistory&&!historyError&&<div className="wallet-empty"><span aria-hidden="true">◇</span><h3>Chưa có giao dịch</h3><p>Các lần nạp, khóa và thanh toán Coin sẽ xuất hiện tại đây.</p></div>}
   {loadingHistory&&<p role="status">Đang tải lịch sử…</p>}
   {cursor&&<button className="wallet-more" disabled={loadingHistory} onClick={()=>void loadHistory(cursor)}>Tải thêm</button>}
  </section>
  <footer className="guest-footer"><span>OnlineBidFlow · Ví Coin của bạn</span><span>Số dư chỉ cập nhật sau xác nhận từ server.</span></footer>
  <dialog ref={dialog} className="wallet-dialog" aria-labelledby="deposit-title" onCancel={event=>{event.preventDefault();close();}}>
   <form onSubmit={submit} aria-busy={busy} noValidate>
    <div className="wallet-dialog-heading"><h2 id="deposit-title">Nạp Coin vào ví</h2><button type="button" aria-label="Đóng" disabled={busy} onClick={close}>×</button></div>
    <p>Đây là nạp giả lập, không phát sinh thanh toán tiền thật.</p>
    <label htmlFor="deposit-amount">Số Coin muốn nạp</label>
    <input ref={input} id="deposit-amount" inputMode="numeric" autoComplete="off" value={amount} maxLength={19} disabled={busy||uncertain} onChange={e=>{setAmount(e.target.value);setDepositError('');}} aria-invalid={!!depositError} aria-describedby={depositError?'deposit-error':undefined} placeholder="Ví dụ: 1000"/>
    <div className="wallet-presets">{['500','1000','5000'].map(value=><button type="button" key={value} disabled={busy||uncertain} onClick={()=>{setAmount(value);setDepositError('');}}>{formatCoin(value)}</button>)}</div>
    {depositError&&<p id="deposit-error" className="wallet-error" role="alert">{depositError}</p>}
    {uncertain?<button type="button" className="wallet-button" onClick={()=>{close();void loadBalance();void loadHistory();}}>Kiểm tra ví và lịch sử</button>
     :<button className="wallet-button" type="submit" disabled={busy}>{busy?'Đang nạp…':'Xác nhận nạp'}</button>}
   </form>
  </dialog>
 </main>;
}
