import { useEffect, useState } from 'react';
import axiosClient, { serverConfig } from '../api/axiosClient';

type HealthResponse = { status: string; service: string };
type ProbeState = 'Checking...' | 'Connected' | 'Unavailable';

export default function ApiTestPage() {
  const [attempt, setAttempt] = useState(0);
  const [response, setResponse] = useState<HealthResponse | null>(null);
  const [apiState, setApiState] = useState<ProbeState>('Checking...');
  const [socketState, setSocketState] = useState<ProbeState>('Checking...');

  useEffect(() => {
    let active = true;
    let receivedPong = false;
    const controller = new AbortController();
    setResponse(null);
    setApiState('Checking...');
    setSocketState('Checking...');
    void axiosClient.get<HealthResponse>('/api/health', { signal: controller.signal })
      .then(({ data }) => {
        if (!active) return;
        if (data.status !== 'UP' || data.service !== 'auction-backend') {
          setApiState('Unavailable');
          return;
        }
        setResponse(data);
        setApiState('Connected');
      })
      .catch(() => { if (active) setApiState('Unavailable'); });

    const socket = new WebSocket(serverConfig.websocketUrl);
    const timeout = window.setTimeout(() => {
      if (active) setSocketState('Unavailable');
      socket.close();
    }, 5000);
    socket.onopen = () => { if (active) socket.send('PING'); };
    socket.onmessage = (event: MessageEvent<unknown>) => {
      receivedPong = event.data === 'PONG';
      window.clearTimeout(timeout);
      if (active) setSocketState(receivedPong ? 'Connected' : 'Unavailable');
      socket.close();
    };
    socket.onerror = () => { if (active) setSocketState('Unavailable'); };
    socket.onclose = () => {
      window.clearTimeout(timeout);
      if (active && !receivedPong) setSocketState('Unavailable');
    };
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeout);
      socket.close();
    };
  }, [attempt]);

  return (
    <main className="mx-auto max-w-5xl px-8 py-12">
      <h1 className="text-3xl font-bold">Server connection</h1>
      <p className="mt-3 text-slate-600">Check REST and WebSocket connectivity to your Spring Boot server.</p>
      <div className="mt-8 grid grid-cols-2 gap-5" aria-live="polite">
        {[
          { label: 'REST API', url: `${serverConfig.apiUrl}/api/health`, state: apiState },
          { label: 'WebSocket', url: serverConfig.websocketUrl, state: socketState }
        ].map(({ label, url, state }) => (
          <section key={label} aria-label={label} className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="font-semibold">{label}</h2>
            <p className="mt-2 break-all text-sm text-slate-500">{url}</p>
            <p className={`mt-5 text-lg font-semibold ${state === 'Connected' ? 'text-emerald-700' : state === 'Unavailable' ? 'text-red-700' : 'text-slate-600'}`}>{state}</p>
          </section>
        ))}
      </div>
      {response && <pre className="mt-6 rounded-lg bg-slate-900 p-5 text-sm text-slate-100">{JSON.stringify(response, null, 2)}</pre>}
      {(apiState === 'Unavailable' || socketState === 'Unavailable') && (
        <p className="mt-5 text-sm text-red-700">Cannot reach the server. Check that it is running and that the server address and network connection are correct.</p>
      )}
      <button type="button" onClick={() => setAttempt((value) => value + 1)} className="mt-6 rounded-lg bg-indigo-600 px-5 py-3 font-medium text-white hover:bg-indigo-700">Check again</button>
    </main>
  );
}
