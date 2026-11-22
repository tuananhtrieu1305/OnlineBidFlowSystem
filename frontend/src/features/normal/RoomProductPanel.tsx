import { useRef, useState } from 'react';
import { imageSource } from '../products/productApi';
import ProductImage from './ProductImage';
import type { NormalAuction } from './types';

type Product = NormalAuction['product'];

export default function RoomProductPanel({ product }: { product?: Product }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [activeImage, setActiveImage] = useState(0);
  const description = product?.description.trim() || 'Chưa có mô tả.';
  const images = [...new Set([product?.imageUrl, ...(product?.imageUrls ?? [])]
    .map(url => imageSource(url ?? null))
    .filter((url): url is string => Boolean(url)))];
  const imageIndex = Math.min(activeImage, Math.max(0, images.length - 1));

  function changeImage(step: number) {
    setActiveImage((imageIndex + step + images.length) % images.length);
  }

  return <section className="room-product-column" aria-label="Ảnh và thông tin sản phẩm" data-testid="normal-product-panel">
    <div className="room-product-visual">
      {product && <div className="room-product-gallery">
        <ProductImage key={images[imageIndex]} product={{ ...product, imageUrl: images[imageIndex] ?? null }} />
        {images.length > 1 && <div className="room-gallery-controls" role="group" aria-label="Chuyển ảnh sản phẩm">
          <button type="button" aria-label="Ảnh trước" onClick={() => changeImage(-1)}>‹</button>
          <span role="status" aria-label={`Ảnh ${imageIndex + 1} trên ${images.length}`}>{imageIndex + 1}/{images.length}</span>
          <button type="button" aria-label="Ảnh tiếp theo" onClick={() => changeImage(1)}>›</button>
        </div>}
      </div>}
    </div>
    <div className="room-product-details">
      <div className="room-product-summary"><h2>Thông tin sản phẩm</h2><p>{description}</p></div>
      {product && <button className="room-primary room-product-more" type="button" aria-haspopup="dialog"
        onClick={() => dialog.current?.showModal()}>Xem thêm thông tin chi tiết</button>}
    </div>
    {product && <dialog ref={dialog} className="room-product-dialog" aria-labelledby="room-product-dialog-title">
      <header>
        <h2 id="room-product-dialog-title">{product.name}</h2>
        <button type="button" className="room-exit" aria-label="Đóng thông tin sản phẩm" onClick={() => dialog.current?.close()}>×</button>
      </header>
      <p>{description}</p>
    </dialog>}
  </section>;
}
