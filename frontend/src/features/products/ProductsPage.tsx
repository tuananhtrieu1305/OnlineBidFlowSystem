import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useBlocker, useLocation, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../auth/AuthProvider';
import { getProduct, imageSource, listProducts, saveProduct, type Product, type ProductPage } from './productApi';
import { validateProduct, type Fields } from './validation';
import './products.css';

const price=(value:string|null)=>value===null?'Chưa đặt':new Intl.NumberFormat('vi-VN').format(BigInt(value))+' Coin';
function Photo({src,name}:{src:string|null;name:string}) {
 const [failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[src]);
 const url=imageSource(src);
 return url&&!failed?<img src={url} alt={name} onError={()=>setFailed(true)}/>:<div className="product-placeholder" aria-label="Chưa có ảnh">◇</div>;
}
function errorText(error:unknown){
 const status=axios.isAxiosError(error)?error.response?.status:0;
 return status===403?'Bạn không có quyền quản lý sản phẩm hoặc phiên xác thực đã thay đổi.':status===404?'Không tìm thấy sản phẩm.':status===409?'Sản phẩm đã được dùng trong phiên đấu giá nên không thể chỉnh sửa.':status===412?'Sản phẩm đã được người khác cập nhật. Tải bản mới trước khi lưu tiếp.':status===413?'Ảnh quá lớn. Chọn ảnh tối đa 5 MiB và 16 triệu pixel.':status===415?'Không đọc được ảnh. Hãy chọn ảnh JPEG hoặc PNG hợp lệ.':status===400?'Thông tin chưa hợp lệ. Kiểm tra lại các trường và ảnh.':'Chưa thể hoàn tất yêu cầu. Vui lòng kiểm tra kết nối.';
}
export default function ProductsPage(){
 const {user,loading,failure}=useAuth();const location=useLocation();const {id}=useParams();
 if(loading)return <main className="guest-home"><p role="status">Đang kiểm tra phiên…</p></main>;
 if(failure)return <main className="guest-home"><p role="alert">Chưa thể xác minh quyền quản trị. Thử lại ở thanh bên.</p></main>;
 if(!user)return <Navigate to="/login" replace/>;
 if(user.role!=='ADMIN')return <Navigate to="/" replace/>;
 return <main className="guest-home products-page" id="main-content"><header className="guest-topbar">Không gian quản trị <span className="guest-topnote">Sản phẩm cho phiên đấu giá tiếp theo.</span></header>
  {id?<ProductDetail key={id+location.pathname} id={id} edit={location.pathname.endsWith('/edit')}/>:location.pathname.endsWith('/new')?<ProductForm key="new"/>:<ProductList/>}
 </main>;
}
function ProductList(){
 const [q,setQ]=useState(''),[page,setPage]=useState(0),[data,setData]=useState<ProductPage|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0);
 useEffect(()=>{const abort=new AbortController();setLoading(true);setData(null);setError('');
  const timer=setTimeout(()=>{void listProducts(q,page,abort.signal).then(result=>{if(!abort.signal.aborted)setData(result);}).catch(e=>{if(!abort.signal.aborted)setError(errorText(e));}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});},300);
  return()=>{clearTimeout(timer);abort.abort();};},[q,page,retry]);
 return <><div className="products-heading"><div><p className="guest-kicker">DANH MỤC QUẢN TRỊ</p><h1>Sản phẩm</h1><p>Chuẩn bị thông tin rõ ràng cho mỗi phiên đấu giá.</p></div><Link className="product-primary" to="/admin/products/new">＋ Thêm sản phẩm</Link></div>
  <label className="product-search">Tìm sản phẩm<input value={q} maxLength={255} placeholder="Tên hoặc mã sản phẩm" onChange={e=>{setQ(e.target.value);setPage(0);}}/></label>
  {loading?<p role="status">Đang tải sản phẩm…</p>:error?<p role="alert">{error} <button onClick={()=>setRetry(v=>v+1)}>Thử lại</button></p>:<>
   <div className="product-table-wrap"><table className="product-table"><thead><tr><th>Sản phẩm</th><th>Số lượng</th><th>Giá ước tính · Admin</th><th>Trạng thái</th></tr></thead><tbody>{data?.items.map(p=><tr key={p.id}><td><Link to={'/admin/products/'+p.id}><Photo src={p.imageUrl} name={p.name}/><span><strong>{p.name}</strong><small>#{p.id}</small></span></Link></td><td>{p.quantity}</td><td>{price(p.estimatedPrice)}</td><td><span className="product-badge">{p.editable?'Có thể chỉnh sửa':'Đã dùng trong phiên'}</span></td></tr>)}</tbody></table></div>
   {!data?.items.length&&<div className="product-empty"><h2>{q?'Không tìm thấy sản phẩm':'Chưa có sản phẩm'}</h2><p>{q?'Thử tìm bằng tên hoặc mã khác.':'Thêm sản phẩm đầu tiên để chuẩn bị tạo phiên đấu giá.'}</p></div>}
   <div className="product-pagination"><button disabled={page===0} onClick={()=>setPage(v=>v-1)}>Trang trước</button><span>Trang {page+1} / {Math.max(data?.totalPages??1,1)}</span><button disabled={!data||page+1>=data.totalPages} onClick={()=>setPage(v=>v+1)}>Trang sau</button></div>
  </>}
 </>;
}
function ProductDetail({id,edit}:{id:string;edit:boolean}){
 const [product,setProduct]=useState<Product|null>(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 useEffect(()=>{let alive=true;setError('');setProduct(null);void getProduct(id).then(p=>{if(alive)setProduct(p);}).catch(e=>{if(alive)setError(errorText(e));});return()=>{alive=false;};},[id,attempt]);
 if(error)return <><Link to="/admin/products">← Sản phẩm</Link><p role="alert">{error}</p><button onClick={()=>setAttempt(v=>v+1)}>Thử lại</button></>;
 if(!product)return <p role="status">Đang tải sản phẩm…</p>;
 if(edit&&product.editable)return <ProductForm product={product} reload={()=>setAttempt(v=>v+1)}/>;
 return <><div className="products-heading"><div><Link to="/admin/products">← Sản phẩm</Link><h1>{product.name}</h1><p>Mã sản phẩm #{product.id}</p></div>{product.editable&&<Link className="product-primary" to={'/admin/products/'+id+'/edit'}>Chỉnh sửa</Link>}</div>
  {!product.editable&&<p className="product-info">Sản phẩm đã được dùng trong phiên đấu giá nên không thể chỉnh sửa.</p>}
  <section className="product-detail"><div className="product-large-photo"><Photo src={product.imageUrl} name={product.name}/></div><div><h2>Thông tin sản phẩm</h2><dl><dt>Số lượng</dt><dd>{product.quantity}</dd><dt>Giá ước tính · Chỉ Admin thấy</dt><dd>{price(product.estimatedPrice)}</dd></dl><h2>Mô tả</h2><p className="product-description">{product.description||'Chưa có mô tả.'}</p></div></section>
 </>;
}
function ProductForm({product,reload}:{product?:Product;reload?:()=>void}){
 const navigate=useNavigate();const initial:Fields={name:product?.name??'',description:product?.description??'',quantity:String(product?.quantity??1),estimatedPrice:product?.estimatedPrice??''};
 const [fields,setFields]=useState(initial),[image,setImage]=useState<File|null>(null),[remove,setRemove]=useState(false),[preview,setPreview]=useState(''),[errors,setErrors]=useState<Partial<Record<keyof Fields,string>>>({}),[error,setError]=useState(''),[busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false),[forbidden,setForbidden]=useState(false),[conflict,setConflict]=useState(false),[saved,setSaved]=useState(false);
 const sending=useRef(false),alive=useRef(true);useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const dirty=!saved&&(JSON.stringify(fields)!==JSON.stringify(initial)||!!image||remove);
 const blocker=useBlocker(dirty);
 useEffect(()=>{if(!image){setPreview('');return;}const url=URL.createObjectURL(image);setPreview(url);return()=>URL.revokeObjectURL(url);},[image]);
 function field(key:keyof Fields,value:string){setFields(f=>({...f,[key]:value}));setErrors(e=>({...e,[key]:undefined}));}
 async function submit(e:React.FormEvent){e.preventDefault();if(sending.current||uncertain||forbidden||conflict)return;
  const validation=validateProduct(fields);setErrors(validation);const first=Object.keys(validation)[0];if(first){document.getElementById('product-'+first)?.focus();return;}
  sending.current=true;setBusy(true);setError('');
  try{const result=await saveProduct(product?.id,{name:fields.name.trim(),description:fields.description.trim()||null,quantity:Number(fields.quantity),estimatedPrice:fields.estimatedPrice||null,...(product?{imageAction:image?'REPLACE':remove?'REMOVE':'KEEP'}:{})},image,product?.version);
   if(alive.current){setSaved(true);setDestination('/admin/products/'+result.id);}
  }catch(ex){if(alive.current){const status=axios.isAxiosError(ex)?ex.response?.status:undefined;
   setForbidden(status===403);setConflict(status===409||status===412);setUncertain(!status||status>=500);setError(!status||status>=500?'Chưa xác định kết quả lưu. Kiểm tra danh sách trước khi gửi lại để tránh tạo trùng.':errorText(ex));
  }}finally{sending.current=false;if(alive.current)setBusy(false);}
 }
 const [destination,setDestination]=useState('');useEffect(()=>{if(saved&&destination)navigate(destination,{replace:true});},[saved,destination,navigate]);
 if(forbidden)return <p role="alert">{error} <Link to="/admin">Về quản trị</Link></p>;
 return <><div className="products-heading"><div><Link to="/admin/products">← Sản phẩm</Link><h1>{product?'Chỉnh sửa sản phẩm':'Thêm sản phẩm'}</h1><p>Thông tin này sẽ được dùng trong các phiên đấu giá.</p></div></div>
  {blocker.state==='blocked'&&<div className="product-info" role="alert"><p>Bạn có thay đổi chưa lưu. Rời trang?</p><button type="button" disabled={busy} onClick={()=>blocker.proceed()}>Rời trang</button><button type="button" onClick={()=>blocker.reset()}>Tiếp tục chỉnh sửa</button></div>}
  <form className="product-form" onSubmit={submit} noValidate aria-busy={busy}>
   <fieldset disabled={busy||uncertain||conflict}><div className="product-fields">
    {(['name','description','quantity','estimatedPrice'] as const).map(key=><label key={key} htmlFor={'product-'+key}>{({name:'Tên sản phẩm',description:'Mô tả',quantity:'Số lượng',estimatedPrice:'Giá ước tính (Coin) — chỉ Admin thấy'})[key]}
     {key==='description'?<textarea id={'product-'+key} rows={7} value={fields[key]} onChange={e=>field(key,e.target.value)}/>:<input id={'product-'+key} value={fields[key]} inputMode={key==='name'?'text':'numeric'} onChange={e=>field(key,e.target.value)} aria-invalid={!!errors[key]} aria-describedby={errors[key]?'error-'+key:undefined}/>}
     {errors[key]&&<span className="product-field-error" id={'error-'+key}>{errors[key]}</span>}</label>)}
   </div><div className="product-image-input"><h2>Ảnh sản phẩm</h2><div className="product-large-photo">{preview?<img src={preview} alt="Ảnh xem trước"/>:<Photo src={remove?null:product?.imageUrl??null} name="Ảnh sản phẩm"/>}</div><label className="product-file-label">Chọn ảnh JPEG/PNG<input type="file" accept="image/jpeg,image/png" onChange={e=>{const file=e.target.files?.[0];if(!file)return;if(!['image/jpeg','image/png'].includes(file.type)||file.size>5*1024*1024){setError('Chọn ảnh JPEG/PNG tối đa 5 MiB.');e.target.value='';return;}setImage(file);setRemove(false);setError('');}}/></label><p>Tối đa 5 MiB · 16 triệu pixel. Không bắt buộc.</p>{(image||product?.imageUrl)&&<button type="button" onClick={()=>{setImage(null);setRemove(true);}}>Bỏ ảnh</button>}</div></fieldset>
   {error&&<p role="alert">{error}</p>}{conflict&&reload&&<button type="button" onClick={()=>{if(window.confirm('Bỏ các thay đổi đang nhập và tải bản mới?'))reload();}}>Tải bản mới</button>}
   <div className="product-actions"><Link to="/admin/products">{uncertain?'Kiểm tra danh sách':'Hủy'}</Link><button className="product-primary" disabled={busy||uncertain||conflict} type="submit">{busy?'Đang lưu…':'Lưu sản phẩm'}</button></div>
  </form>
 </>;
}
