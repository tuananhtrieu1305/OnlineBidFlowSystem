import { useEffect, useRef, type ReactNode } from 'react';

/** A modeless drawer keeps bidding and media controls accessible while browsing. */
export default function LiveRoomDrawer({
  title,
  onClose,
  children
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    close.current?.focus();
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !document.querySelector('dialog[open]')) {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    }
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('keydown', escape);
      if (previous?.isConnected) previous.focus();
    };
  }, [onClose]);
  return (
    <section className="live-room-drawer" role="region" aria-label={title}>
      <header>
        <div>
          <span>ONLINEBIDFLOW / LIVE</span>
          <h2>{title}</h2>
        </div>
        <button
          ref={close}
          className="live-secondary"
          type="button"
          aria-label={'Đóng ' + title}
          onClick={onClose}
        >
          ✕
        </button>
      </header>
      <div className="live-room-drawer-body">{children}</div>
    </section>
  );
}
