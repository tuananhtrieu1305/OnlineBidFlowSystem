import { describe, expect, it } from 'vitest';
import { createServerConfig } from '../src/api/server-config';

describe('server configuration', () => {
  it('defaults to local Spring Boot and derives the WebSocket endpoint', () => {
    expect(createServerConfig()).toEqual({ apiUrl: 'http://localhost:8080', websocketUrl: 'ws://localhost:8080/ws/health' });
  });
  it('supports a LAN server', () => {
    expect(createServerConfig('http://192.168.1.10:8080/').apiUrl).toBe('http://192.168.1.10:8080');
  });
  it('uses encrypted WebSockets for HTTPS servers', () => {
    expect(createServerConfig('https://auction.example').websocketUrl).toBe('wss://auction.example/ws/health');
  });
  it.each(['file:///tmp/test', 'javascript:alert(1)', 'ftp://example.com', 'invalid', 'http://user:pass@example.com', 'http://example.com/api', 'http://example.com?token=x', 'http://example.com#x'])('rejects invalid server origin %s', (url) => {
    expect(() => createServerConfig(url)).toThrow();
  });
});
