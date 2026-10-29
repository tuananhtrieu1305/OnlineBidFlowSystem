type IconName = 'explore' | 'leaderboard' | 'admin' | 'products' | 'users' | 'systemWallet' | 'auctions' | 'wallet' | 'blind' | 'normal';

export default function SidebarIcon({ name }: { name: IconName }) {
  const drawing = {
    explore: <><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8z"/></>,
    leaderboard: <><path d="M2 21h20"/><rect x="2.5" y="11" width="6" height="10" rx="1"/><rect x="9" y="5" width="6" height="16" rx="1"/><rect x="15.5" y="14" width="6" height="7" rx="1"/><text x="5.5" y="16.5">2</text><text x="12" y="10.5">1</text><text x="18.5" y="19.5">3</text></>,
    admin: <><rect x="3" y="3" width="7" height="7" rx="1.3"/><rect x="14" y="3" width="7" height="7" rx="1.3"/><rect x="3" y="14" width="7" height="7" rx="1.3"/><rect x="14" y="14" width="7" height="7" rx="1.3"/></>,
    products: <><path d="m12 2 9 5v10l-9 5-9-5V7zM3 7l9 5 9-5M12 12v10"/></>,
    users: <><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2zM16 5.5a3 3 0 0 1 0 5.8M18 14a5 5 0 0 1 3 4.6V20h-3"/></>,
    systemWallet: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h10M7 13h4M16 14h3v4h-3a2 2 0 0 1 0-4z"/></>,
    auctions: <><path d="m5 13 8-8M9 17l8-8M4 12l3 3M12 4l3 3M10 18h10v3H7v-3z"/></>,
    wallet: <><rect x="2" y="5" width="20" height="15" rx="2"/><path d="M2 9h16a4 4 0 0 1 4 4v3h-5a3 3 0 0 1 0-6h5M17 13h.01" strokeLinecap="round"/></>,
    blind: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" strokeLinecap="round"/></>,
    normal: <><path d="M7 3h10a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM12 16v5M9 21h6M8 8h8M8 11h5"/></>,
  } satisfies Record<IconName, React.ReactNode>;

  return <svg className="guest-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{drawing[name]}</svg>;
}
