import { useEffect, useRef, useState } from 'react';
import { serverConfig } from '../../api/axiosClient';
export type ChatMessage = { messageId: number; auctionId: number; username: string; content: string; sentAt: string };
type SocketState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'room-code-required' | 'offline';

export function useNormalRealtime(id: number | null, enabled: boolean, roomCode: string, refresh: () => Promise<void>) {
  const [state, setState] = useState<SocketState>('idle');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const refreshRef = useRef(refresh); refreshRef.current = refresh;
  const previousRoom = useRef(id);
  const pendingChat = useRef<string | null>(null);
  const chatTimeout = useRef<number | undefined>(undefined);
  useEffect(() => {
    window.clearTimeout(chatTimeout.current);
    if (previousRoom.current !== id) { setMessages([]); previousRoom.current = id; }
    setError(''); setSending(false); pendingChat.current = null;
    if (id === null || !enabled) { setState('idle'); return; }
    let active = true, retry = 0, socket: WebSocket | null = null;
    let timer: number | undefined, heartbeat: number | undefined, joinTimeout: number | undefined;
    let requiresCode = false;
    function connect() {
      if (!active) return;
      setState(retry ? 'reconnecting' : 'connecting');
      socket = new WebSocket(serverConfig.websocketUrl.replace('/ws/health', '/ws/auction'));
      socketRef.current = socket;
      joinTimeout = window.setTimeout(() => socket?.close(), 10_000);
      socket.onopen = () => {
        socket?.send(JSON.stringify({ type: 'JOIN_ROOM', requestId: crypto.randomUUID(), payload: { auctionId: id, roomCode: roomCode || null } }));
        heartbeat = window.setInterval(() => { if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'PING', payload: {} })); }, 20_000);
      };
      socket.onmessage = event => {
        if (!active) return;
        let value: { type: string; auctionId?: number; requestId?: string; payload?: Record<string, unknown> };
        try { value = JSON.parse(event.data); } catch { return; }
        if (value.type === 'ERROR') {
          const code = String(value.payload?.code ?? '');
          setError(String(value.payload?.message ?? 'Không thể xử lý yêu cầu realtime.'));
          if (['ROOM_CODE_REQUIRED', 'ROOM_CODE_INVALID'].includes(code)) {
            requiresCode = true; setState('room-code-required'); window.clearTimeout(joinTimeout); socket?.close();
          }
          if (value.requestId === pendingChat.current) { window.clearTimeout(chatTimeout.current); pendingChat.current = null; setSending(false); }
          return;
        }
        if (value.auctionId !== id) return;
        if (value.type === 'AUCTION_STATE') {
          window.clearTimeout(joinTimeout); setState('connected'); setError(''); retry = 0;
          const history = value.payload?.chatHistory;
          if (Array.isArray(history)) setMessages(history as ChatMessage[]);
          void refreshRef.current();
        } else if (value.type === 'CHAT_MESSAGE') {
          const message = value.payload as unknown as ChatMessage;
          if (message && typeof message.content === 'string') setMessages(items => items.some(item => item.messageId === message.messageId) ? items : [...items, message].slice(-100));
          if (value.requestId === pendingChat.current) { window.clearTimeout(chatTimeout.current); pendingChat.current = null; setSending(false); }
        } else if (['NORMAL_PRICE_UPDATED', 'AUCTION_FINISHED', 'USER_JOINED', 'USER_LEFT'].includes(value.type)) void refreshRef.current();
      };
      socket.onerror = () => { if (active) setError('Mất kết nối realtime. Giá và ví vẫn được tải lại từ server.'); };
      socket.onclose = event => {
        window.clearTimeout(joinTimeout); window.clearInterval(heartbeat);
        window.clearTimeout(chatTimeout.current); pendingChat.current = null; if (active) setSending(false);
        if (!active || requiresCode) return;
        if (event.code === 1008) { setState('offline'); setError('Phiên realtime không còn hợp lệ. Kiểm tra đăng nhập hoặc tải lại trang.'); return; }
        setState('reconnecting'); retry++;
        timer = window.setTimeout(connect, Math.min(1000 * 2 ** Math.min(retry, 4), 15_000));
      };
    }
    connect();
    return () => {
      active = false; window.clearTimeout(chatTimeout.current); window.clearTimeout(timer); window.clearTimeout(joinTimeout); window.clearInterval(heartbeat);
      socketRef.current = null; socket?.close();
    };
  }, [id, enabled, roomCode]);
  function sendChat(content: string) {
    const socket = socketRef.current;
    if (!content.trim() || pendingChat.current || state !== 'connected' || socket?.readyState !== WebSocket.OPEN) return false;
    const requestId = crypto.randomUUID();
    pendingChat.current = requestId; setSending(true); setError('');
    chatTimeout.current = window.setTimeout(() => {
      if (pendingChat.current === requestId) {
        pendingChat.current = null; setSending(false);
        setError('Chưa nhận được xác nhận tin nhắn. Kiểm tra lịch sử chat trước khi gửi lại.');
      }
    }, 10_000);
    socket.send(JSON.stringify({ type: 'SEND_CHAT_MESSAGE', requestId, payload: { auctionId: id, content: content.trim() } }));
    return true;
  }
  return { state, messages, error, sending, sendChat };
}
