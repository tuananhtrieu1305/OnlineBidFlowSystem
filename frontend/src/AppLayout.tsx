import { NavLink, Outlet } from 'react-router-dom';

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-8 py-5">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-6">
          <NavLink to="/" className="text-xl font-bold tracking-tight">OnlineBidFlow</NavLink>
          <nav className="flex gap-5 text-sm" aria-label="Main navigation">
            {['/', '/api-test', '/routing-test', '/about'].map((to, index) => (
              <NavLink key={to} to={to} end className={({ isActive }) => isActive ? 'font-semibold text-indigo-700' : 'text-slate-600 hover:text-indigo-700'}>
                {['Home', 'Connection test', 'Routing test', 'About'][index]}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <Outlet />
      <footer className="mx-auto max-w-5xl px-8 py-6 text-xs text-slate-500">
        {window.desktop ? `Desktop · ${window.desktop.platform} · Electron ${window.desktop.electronVersion}` : 'Browser preview'}
      </footer>
    </div>
  );
}
