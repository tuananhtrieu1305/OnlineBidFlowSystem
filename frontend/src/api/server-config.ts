export function createServerConfig(value = 'http://localhost:8080') {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash) {
    throw new Error('VITE_API_BASE_URL must be an HTTP(S) origin without credentials, path, query or fragment.');
  }
  return {
    apiUrl: url.origin,
    websocketUrl: `${url.protocol === 'https:' ? 'wss:' : 'ws:'}//${url.host}/ws/health`
  };
}
