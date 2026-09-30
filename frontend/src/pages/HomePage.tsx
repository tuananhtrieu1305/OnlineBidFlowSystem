import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-8 py-16">
      <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">Online auction system</p>
      <h1 className="mt-4 text-4xl font-bold tracking-tight">OnlineBidFlow Desktop</h1>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">
        The desktop foundation is ready. Check your server connection before building auction rooms, bidding and chat.
      </p>
      <Link to="/api-test" className="mt-8 inline-flex rounded-lg bg-indigo-600 px-5 py-3 font-medium text-white hover:bg-indigo-700">
        Check server connection
      </Link>
      <Link to="/register" className="ml-4 inline-flex rounded-lg bg-[#145C53] px-5 py-3 font-medium text-white hover:bg-[#104b44]">Tạo tài khoản</Link>
      <div className="mt-12 grid grid-cols-3 gap-5">
        {[
          ['Desktop', 'Electron + React', 'TypeScript and Tailwind CSS'],
          ['Server', 'Spring Boot', 'REST API and WebSocket'],
          ['Database', 'MySQL', 'Managed by the server']
        ].map(([label, title, detail]) => (
          <section key={label} className="rounded-xl border border-slate-200 bg-white p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
            <h2 className="mt-3 text-lg font-semibold">{title}</h2>
            <p className="mt-2 text-sm text-slate-600">{detail}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
