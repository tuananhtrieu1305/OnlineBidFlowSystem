import { useEffect, useState, useSyncExternalStore } from 'react';
import { useAuth } from '../auth/AuthProvider';
import client, { serverConfig } from '../../api/axiosClient';
import { csrfHeaders } from '../auth/api/sessionApi';
import { mergeLiveState, type LiveAction, type LiveState, type LiveSession } from './liveState';

const empty = (): LiveState => ({
  sessions: [],
  orders: [],
  wallet: null,
  registrations: {},
  mission: null
});
let snapshot = empty();
let actorId = '';
let authEpoch = 0;
let socket: WebSocket | null = null;
let roomId: string | null = null;
let joined = false;
let connectionId = '';
let status = 'Đang kết nối máy chủ…';
let anchor = { time: Date.now(), local: performance.now() };
const listeners = new Set<() => void>();
const saleEffects = new Set<string>();
const retryRequests = new Map<string, string>();
export function liveSaleEffect(sessionId: string, lotId: string) {
  const id = sessionId + ':' + lotId;
  return saleEffects.has(id) ? id : null;
}
const signals = new Set<(value: Signal) => void>();
export type Signal = { sender: string; generation: string; kind: string; epoch: string; data: any };
function emit() {
  listeners.forEach((fn) => fn());
}
function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
function apply(data: any, _full = false) {
  const next = mergeLiveState(snapshot, data, actorId, roomId);
  if (next !== snapshot) {
    snapshot = next;
    if (data.serverNow) anchor = { time: data.serverNow, local: performance.now() };
  }
  emit();
}
export async function refreshLive() {
  const epoch = authEpoch;
  const data = (await client.get(actorId ? '/api/livestreams/state' : '/api/livestreams')).data;
  if (epoch !== authEpoch) return;
  apply(Array.isArray(data) ? { sessions: data } : data, true);
  if (actorId && roomId && joined) {
    const response = await client.get('/api/livestreams/' + roomId + '/snapshot');
    if (epoch === authEpoch) apply(response.data);
  }
}
export function sendLive(value: object) {
  if (socket?.readyState !== WebSocket.OPEN) return false;
  socket.send(JSON.stringify(value));
  return true;
}
export function listenLiveSignal(fn: (value: Signal) => void) {
  signals.add(fn);
  return () => {
    signals.delete(fn);
  };
}
export function liveConnectionId() {
  return connectionId;
}
export function useLiveSession(id?: string) {
  useEffect(() => {
    if (!id) return;
    let disposed = false;
    const epoch = authEpoch;
    void client
      .get('/api/livestreams/' + id)
      .then((r) => {
        if (!disposed && epoch === authEpoch && roomId !== id) apply({ session: r.data });
      })
      .catch(() => {});
    return () => {
      disposed = true;
    };
  }, [id]);
}
export function useLiveRoom(id?: string) {
  useEffect(() => {
    if (!id) return;
    roomId = id;
    snapshot = { ...snapshot, mission: null };
    emit();
    joined = false;
    sendLive({ type: 'JOIN', sessionId: id });
    return () => {
      sendLive({ type: 'LEAVE' });
      roomId = null;
      snapshot = { ...snapshot, mission: null };
      emit();
      joined = false;
    };
  }, [id]);
}
export function LivestreamConnection() {
  const { user, loading } = useAuth();
  useEffect(() => {
    if (loading) return;
    let disposed = false,
      retries = 0;
    let retry: ReturnType<typeof setTimeout>;
    authEpoch++;
    actorId = user ? String(user.id) : '';
    snapshot = empty();
    saleEffects.clear();
    retryRequests.clear();
    joined = false;
    emit();
    const refresh = () =>
      refreshLive().catch(() => {
        status = 'Chưa kết nối được máy chủ. Đang thử lại…';
        emit();
      });
    void refresh();
    function connect() {
      if (disposed || !user) return;
      const ws = new WebSocket(serverConfig.websocketUrl.replace('/ws/health', '/ws/livestream'));
      socket = ws;
      ws.onopen = () => {
        retries = 0;
        status = 'Đã kết nối máy chủ';
        emit();
      };
      ws.onmessage = (event) => {
        if (disposed) return;
        const value = JSON.parse(event.data);
        if (value.type === 'WELCOME') {
          connectionId = value.connectionId;
          if (roomId) sendLive({ type: 'JOIN', sessionId: roomId });
        }
        if (value.type === 'STATE') {
          if (value.data.session.id !== roomId) return;
          if (value.reason === 'LOT_SOLD') {
            const s: LiveSession = value.data.session;
            const lot = s.lots[s.currentLotIndex];
            if (lot.status === 'SOLD') saleEffects.add(s.id + ':' + lot.id);
          }
          joined = true;
          status = 'Đã đồng bộ phòng';
          apply(value.data);
        }
        if (value.type === 'REFRESH') void refresh();
        if (value.type === 'SIGNAL') signals.forEach((fn) => fn(value));
        if (value.type === 'ERROR') {
          status = value.message;
          emit();
        }
      };
      ws.onclose = () => {
        if (disposed) return;
        joined = false;
        connectionId = '';
        status = 'Mất kết nối. Đang kết nối lại…';
        emit();
        retry = setTimeout(connect, Math.min(10000, 500 * 2 ** retries++));
      };
      ws.onerror = () => ws.close();
    }
    connect();
    const poll = setInterval(() => {
      void refresh();
    }, 15000);
    const heartbeat = setInterval(() => {
      const s = snapshot.sessions.find((v) => v.id === roomId);
      if (joined && s?.hostId === actorId) sendLive({ type: 'HEARTBEAT' });
    }, 1000);
    return () => {
      disposed = true;
      clearTimeout(retry);
      clearInterval(poll);
      clearInterval(heartbeat);
      socket?.close();
      socket = null;
    };
  }, [user?.id, loading]);
  return null;
}
export function useLivestream() {
  const state = useSyncExternalStore(subscribe, () => snapshot);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  async function act(action: LiveAction): Promise<string | boolean> {
    const epoch = authEpoch;
    const retryKey = actorId + ':' + JSON.stringify(action);
    const requestId = retryRequests.get(retryKey) ?? crypto.randomUUID();
    retryRequests.set(retryKey, requestId);
    setPending(true);
    setError('');
    try {
      let url = '',
        body: object = { requestId };
      if (action.type === 'CREATE') {
        url = '/api/admin/livestreams';
        body = {
          ...action,
          requestId,
          mystery: action.mystery ? {
            secretLot: { productId: action.mystery.secretLot.productId, productVersion: action.mystery.secretLot.productVersion, startingPrice: action.mystery.secretLot.startingPrice },
            missions: action.mystery.missions
          } : undefined,
          lots: action.lots.map((l) => ({
            productId: l.productId,
            productVersion: l.productVersion,
            startingPrice: l.startingPrice
          }))
        };
      } else if ('sessionId' in action) {
        const s = state.sessions.find((v) => v.id === action.sessionId);
        url = '/api/livestreams/' + action.sessionId;
        if (action.type === 'REGISTER') {
          url += '/registration';
          body = { registered: !state.registrations[actorId]?.includes(action.sessionId) };
        } else if (action.type === 'CHAT') {
          url += '/chat';
          body = { requestId, text: action.text };
        } else if (action.type === 'BID') {
          if (!joined) throw new Error('Đợi kết nối lại phòng trước khi đặt giá.');
          url += '/lots/' + s?.lots[s.currentLotIndex].id + '/bids';
          body = { requestId, amount: action.amount };
        } else {
          url = '/api/admin/livestreams/' + action.sessionId + '/' + action.type.toLowerCase();
          body = {
            requestId,
            lotId:
              action.type === 'REOPEN' || action.type === 'SELECT'
                ? action.lotId
                : s?.lots[s.currentLotIndex].id
          };
        }
      } else throw new Error('Thao tác không được hỗ trợ.');
      const headers = await csrfHeaders();
      // A transport retry reuses the same request id so a committed command is never repeated.
      const post = () => client.post(url, body, { headers });
      let response;
      try {
        response = await post();
      } catch (e: any) {
        if (!e.response) response = await post();
        else throw e;
      }
      if (epoch !== authEpoch) return false;
      retryRequests.delete(retryKey);
      if (action.type === 'CREATE') {
        await refreshLive();
        return response.data.id;
      }
      apply(response.data);
      return true;
    } catch (e: any) {
      if (e.response?.status >= 400 && e.response?.status < 500) retryRequests.delete(retryKey);
      setError(
        e.response?.data?.message ??
          e.response?.data?.code ??
          e.message ??
          'Chưa thực hiện được thao tác.'
      );
      return false;
    } finally {
      setPending(false);
    }
  }
  return { state, act, error, pending, connected: joined, connectionStatus: status };
}
export function useLiveNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(anchor.time + performance.now() - anchor.local), 100);
    return () => clearInterval(timer);
  }, []);
  return now;
}
