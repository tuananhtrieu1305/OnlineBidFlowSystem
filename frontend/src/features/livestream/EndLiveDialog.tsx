import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { LiveSession } from './liveState';

export default function EndLiveDialog({
  session,
  pending,
  error,
  onConfirm,
  onClose
}: {
  session: LiveSession;
  pending: boolean;
  error: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [attempted, setAttempted] = useState(false);
  const lot = session.lots[session.currentLotIndex];
  const waiting = lot?.status === 'OPEN' && lot.leaderId !== null;
  const sold = session.lots.filter((item) => item.status === 'SOLD').length;
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);

  return createPortal(
    <dialog
      ref={dialog}
      className="live-end-confirm"
      role="alertdialog"
      aria-labelledby="live-end-title"
      aria-describedby="live-end-description"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onClose();
      }}
    >
      <span className="live-end-icon" aria-hidden="true">
        ■
      </span>
      <p className="live-end-kicker">PHÒNG ĐIỀU KHIỂN</p>
      <h2 id="live-end-title">Kết thúc phiên live?</h2>
      <p id="live-end-description">
        Đã bán{' '}
        <strong>
          {sold}/{session.lots.length} món
        </strong>
        . Các món còn lại sẽ được ghi nhận là chưa bán. Kết quả đã chốt được giữ nguyên.
      </p>
      {waiting && (
        <p className="live-notice" role="status">
          {session.status === 'PAUSED'
            ? 'Có lượt trả giá đang tạm dừng. Hãy tiếp tục đấu và đợi chốt sản phẩm trước khi kết thúc.'
            : 'Có người đang dẫn đầu. Đợi hệ thống chốt sản phẩm sau 5 giây để kết thúc phiên.'}
        </p>
      )}
      {attempted && error && (
        <p className="live-error" role="alert">
          {error}
        </p>
      )}
      <div className="live-actions">
        <button
          className="live-secondary"
          type="button"
          autoFocus
          disabled={pending}
          onClick={onClose}
        >
          Quay lại phòng live
        </button>
        <button
          className="live-primary"
          type="button"
          disabled={pending || waiting}
          onClick={() => {
            setAttempted(true);
            void onConfirm();
          }}
        >
          {pending ? 'Đang kết thúc…' : 'Xác nhận kết thúc'}
        </button>
      </div>
    </dialog>,
    document.body
  );
}
