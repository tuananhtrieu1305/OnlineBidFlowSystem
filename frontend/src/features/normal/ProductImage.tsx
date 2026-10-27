import { useEffect, useState } from 'react';
import type { NormalAuction } from './types';
import { imageSource } from '../products/productApi';

export default function ProductImage({ product }: { product: NormalAuction['product'] }) {
  const [failed, setFailed] = useState(false);
  const uploaded = imageSource(product.imageUrl ?? null);
  let source = uploaded;
  if (!source && product.imageUrl) {
    try {
      const url = new URL(product.imageUrl);
      if (url.protocol === 'https:' && url.hostname === 'images.unsplash.com' && !url.username && !url.password) source = url.href;
    } catch { /* Invalid image URLs use the placeholder. */ }
  }
  useEffect(() => setFailed(false), [source]);
  return source && !failed ? <img src={source} referrerPolicy="no-referrer" alt={product.name} onError={() => setFailed(true)} className="normal-product-image" />
    : <div className="normal-product-image normal-placeholder" aria-label="Chưa có ảnh sản phẩm">◇<span>Chưa có ảnh sản phẩm</span></div>;
}
