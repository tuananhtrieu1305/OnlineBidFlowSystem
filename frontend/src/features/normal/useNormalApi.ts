import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { apiError, normalApi, type LiveAuction, type Me, type Summary } from './api';

export function useNormalApi(initialId?: number) {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<Me['wallet']>(null);
  const me: Me | null = user ? { userId: user.id, username: user.username, role: user.role, wallet } : null;
  const [auctions, setAuctions] = useState<Summary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(initialId ?? null);
  const [auction, setAuction] = useState<LiveAuction | null>(null);
  const [busy, setBusy] = useState(false);
  const [stale, setStale] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [clockOffset, setClockOffset] = useState(0);
  const generation = useRef(0);
  const readGeneration = useRef(0);
  const action = useRef(false);
  const selected = auctions.find(value => value.id === selectedId);
  const apply = useCallback((value: LiveAuction) => {
    setAuction(value); setClockOffset(value.serverTime - Date.now());
    setAuctions(items => items.map(item => item.id === value.id ? { ...item, status: value.status, joined: value.joined } : item));
    setStale(false);
  }, []);
  useEffect(() => {
    generation.current++; action.current = false;
    setAuction(null); setAuctions([]); setWallet(null); setStale(true); setBusy(false); setError(null); setActionError(null);
    setSelectedId(initialId ?? null);
  }, [user?.id, initialId]);
  function select(id: number) {
    if (action.current || id === selectedId) return;
    generation.current++; setSelectedId(id); setAuction(null); setStale(true); setError(null); setActionError(null);
  }
  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (!user || action.current) return;
    const version = generation.current;
    const read = ++readGeneration.current;
    try {
      const [nextWallet, items] = await Promise.all([user.role === 'USER' ? normalApi.wallet() : Promise.resolve(null), normalApi.list(signal)]);
      const nextId = selectedId ?? (items.find(item => item.joined && item.status === 'RUNNING') ?? items[0])?.id ?? null;
      const item = items.find(value => value.id === nextId);
      const detail = nextId !== null && item && (item.access === 'PUBLIC' || item.joined || user.role === 'ADMIN') ? await normalApi.detail(nextId, signal) : null;
      if (signal?.aborted || version !== generation.current || read !== readGeneration.current || action.current) return;
      setWallet(nextWallet); setAuctions(items); setError(null); setActionError(null); setStale(false);
      if (nextId !== selectedId) setSelectedId(nextId);
      if (detail) apply(detail); else setAuction(null);
    } catch (err) {
      if (!signal?.aborted && version === generation.current && read === readGeneration.current && !action.current) { setError(apiError(err)); setStale(true); }
    }
  }, [user?.id, user?.role, selectedId, apply]);
  useEffect(() => {
    const controller = new AbortController(); let timer: number | undefined;
    async function poll() { await refresh(controller.signal); if (!controller.signal.aborted) timer = window.setTimeout(() => void poll(), 5000); }
    void poll(); return () => { controller.abort(); window.clearTimeout(timer); };
  }, [refresh]);
  async function mutate(kind: 'join' | 'bid', value: string | number) {
    if (!user || selectedId === null || action.current) return null;
    action.current = true; const version = ++generation.current;
    setBusy(true); setError(null); setActionError(null);
    let succeeded = false;
    try {
      if (kind === 'join') {
        const next = await normalApi.join(selectedId, String(value));
        if (version === generation.current) { succeeded = true; apply(next); return next; }
      } else {
        const response = await normalApi.bid(selectedId, Number(value));
        if (version === generation.current) { succeeded = true; apply(response.auction); setWallet(response.wallet); return response.auction; }
      }
      return null;
    } catch (err) { if (version === generation.current) { setActionError(apiError(err)); setStale(true); } return null; }
    finally { if (version === generation.current) { action.current = false; setBusy(false); if (succeeded) void refresh(); } }
  }
  return { me, auctions, auction, selected, selectedId, busy, stale, error: actionError ?? error, clockOffset,
    select, refresh, join: (code: string) => mutate('join', code), bid: (amount: number) => mutate('bid', amount) };
}
