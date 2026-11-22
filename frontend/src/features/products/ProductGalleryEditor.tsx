import { useEffect, useRef, useState, type FormEvent } from 'react';
import axios from 'axios';
import { getProductGallery, imageSource, uploadProductGallery, type Product } from './productApi';

const maxImages = 8;
const mib = 1024 * 1024;

export default function ProductGalleryEditor({ product }: { product: Product }) {
  const [urls, setUrls] = useState<string[] | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const sending = useRef(false);
  const remaining = maxImages - (urls?.length ?? 0);

  useEffect(() => {
    const controller = new AbortController();
    void getProductGallery(product.id, controller.signal)
      .then(images => { if (!controller.signal.aborted) setUrls(images); })
      .catch(() => { if (!controller.signal.aborted) setError('Chưa tải được danh sách ảnh phụ.'); });
    return () => controller.abort();
  }, [product.id, reload]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current || !urls || !files.length || files.length > remaining) return;
    sending.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      setUrls(await uploadProductGallery(product.id, files));
      setNotice(`Đã thêm ${files.length} ảnh phụ.`);
      setFiles([]);
      if (input.current) input.current.value = '';
    } catch (failure) {
      const status = axios.isAxiosError(failure) ? failure.response?.status : undefined;
      if (!status || status >= 500 || status === 409) {
        setUrls(null);
        setFiles([]);
        if (input.current) input.current.value = '';
        setReload(value => value + 1);
      }
      setError(status === 409 ? 'Sản phẩm đã đủ 8 ảnh phụ.'
        : status === 413 ? 'Mỗi ảnh tối đa 5 MiB và mỗi lần tải tối đa 20 MiB.'
        : status === 415 ? 'Có ảnh không đọc được. Hãy chọn ảnh JPEG hoặc PNG hợp lệ.'
        : status === 403 ? 'Bạn cần quyền quản trị để tải ảnh.'
        : 'Chưa xác nhận được kết quả tải. Hãy kiểm tra danh sách ảnh trước khi tải lại.');
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  return <section className="product-gallery-editor" aria-labelledby="product-gallery-heading">
    <h2 id="product-gallery-heading">Ảnh phụ</h2>
    {urls?.length ? <ul className="product-gallery-thumbnails">{urls.map((url, index) =>
      <li key={url}><img src={imageSource(url)} alt={`Ảnh phụ ${index + 1} của ${product.name}`} loading="lazy" /></li>
    )}</ul> : null}
    <form onSubmit={event => void submit(event)} aria-busy={busy}>
      <label className="product-file-label">Chọn ảnh phụ
        <input ref={input} type="file" multiple accept="image/jpeg,image/png" disabled={busy || urls === null || remaining <= 0}
          aria-describedby="product-gallery-help" onChange={event => {
            const next = Array.from(event.target.files ?? []);
            setNotice('');
            const invalid = next.length > remaining ? `Còn chỗ cho ${remaining} ảnh phụ.`
              : next.some(file => !['image/jpeg', 'image/png'].includes(file.type) || file.size > 5 * mib)
                ? 'Chọn ảnh JPEG hoặc PNG, mỗi ảnh tối đa 5 MiB.'
                : next.reduce((total, file) => total + file.size, 0) > 20 * mib ? 'Mỗi lần tải tối đa 20 MiB.' : '';
            setError(invalid);
            setFiles(invalid ? [] : next);
            if (invalid) event.target.value = '';
          }} />
      </label>
      <p id="product-gallery-help">{urls === null ? 'Đang tải danh sách…' : `${urls.length}/${maxImages} ảnh phụ · JPEG hoặc PNG · 5 MiB mỗi ảnh`}</p>
      {files.length > 0 && <p>{files.length} ảnh đã chọn</p>}
      <button className="product-primary" type="submit" disabled={busy || urls === null || !files.length}>{busy ? 'Đang tải lên…' : 'Tải ảnh lên'}</button>
    </form>
    {error && <p role="alert" className="product-field-error">{error}</p>}
    {urls === null && error && <button type="button" onClick={() => { setError(''); setReload(value => value + 1); }}>Tải lại danh sách</button>}
    {notice && <p role="status">{notice}</p>}
  </section>;
}
