import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import ProductPicker from '../auctions/configuration/ProductPicker';
import type { Product } from '../products/productApi';

export default function LiveProductCatalog({
  addedIds,
  notice,
  disabled,
  onAdd,
  onClose
}: {
  addedIds: string[];
  notice: string;
  disabled: boolean;
  onAdd: (product: Product) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    const overflow = document.body.style.overflow;
    const scroll = { left: window.scrollX, top: window.scrollY };
    document.body.style.overflow = 'hidden';
    element.showModal();
    element.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      window.scrollTo({ ...scroll, behavior: 'instant' });
    };
  }, []);
  return createPortal(
    <dialog
      ref={dialog}
      className="live-product-catalog live-page"
      aria-labelledby="live-catalog-title"
      aria-describedby="live-catalog-help"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="live-catalog-header">
        <div>
          <p className="live-catalog-kicker">CHỌN HÀNG CHO PHIÊN LIVE</p>
          <h2 id="live-catalog-title">Thêm sản phẩm từ danh mục</h2>
          <p id="live-catalog-help">
            Bấm vào sản phẩm để thêm. Bạn có thể chọn nhiều món liên tiếp.
          </p>
        </div>
        <button
          type="button"
          className="live-secondary"
          aria-label="Đóng danh mục"
          onClick={onClose}
        >
          ✕
        </button>
      </header>
      <div className="live-catalog-body">
        <ProductPicker
          selected={null}
          onSelect={onAdd}
          disabled={disabled || addedIds.length >= 30}
          addedIds={addedIds}
        />
      </div>
      <footer className="live-catalog-footer">
        <div>
          <strong>Đã thêm {addedIds.length}/30 sản phẩm</strong>
          <p role="status">
            {addedIds.length >= 30
              ? 'Đã đủ 30 món cho phiên này.'
              : notice || 'Chỉ hiển thị hàng còn số lượng khả dụng.'}
          </p>
        </div>
        <button type="button" className="live-primary" onClick={onClose}>
          Xong, xem danh sách
        </button>
      </footer>
    </dialog>,
    document.body
  );
}
