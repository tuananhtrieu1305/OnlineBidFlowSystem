import type { ReactNode } from 'react';

export default function LiveNotice({
  tone = 'info',
  title,
  children,
  action
}: {
  tone?: 'info' | 'warning' | 'success' | 'error';
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={'live-banner live-banner-' + tone} role={tone === 'error' ? 'alert' : 'status'}>
      <span className="live-banner-icon" aria-hidden="true">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="9" />
          {tone === 'success' ? (
            <path d="m8 12 3 3 5-6" />
          ) : tone === 'info' ? (
            <>
              <path d="M12 11v5" />
              <path d="M12 7.5h.01" />
            </>
          ) : (
            <>
              <path d="M12 7v6" />
              <path d="M12 16.5h.01" />
            </>
          )}
        </svg>
      </span>
      <div className="live-banner-content">
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
      {action && <div className="live-banner-action">{action}</div>}
    </div>
  );
}
