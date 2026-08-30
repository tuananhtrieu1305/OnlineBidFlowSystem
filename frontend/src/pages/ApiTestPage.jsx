import { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';

export default function ApiTestPage() {
  const [response, setResponse] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    axiosClient
      .get('/api/health')
      .then((result) => {
        if (active) {
          setResponse(result.data);
        }
      })
      .catch((requestError) => {
        if (active) {
          setError(
            requestError.response?.data?.message ||
              requestError.message ||
              'Backend is not reachable.'
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">API Test</h1>
      {loading && <p className="mt-4 text-slate-700">Checking backend health...</p>}
      {!loading && response && (
        <pre className="mt-4 overflow-auto rounded border border-slate-200 bg-slate-50 p-4 text-sm text-slate-900">
          {JSON.stringify(response, null, 2)}
        </pre>
      )}
      {!loading && error && (
        <p className="mt-4 rounded border border-red-200 bg-red-50 p-4 text-red-700">
          Cannot reach backend: {error}
        </p>
      )}
    </main>
  );
}
