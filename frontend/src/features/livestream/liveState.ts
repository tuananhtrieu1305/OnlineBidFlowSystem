export type LiveBid = { id: string; userId: string; username: string; amount: string; at: number };
export type LiveLot = {
  id: string;
  productId: string;
  auctionId: string;
  name: string;
  description: string;
  imageUrl: string | null;
  startingPrice: string;
  status: 'QUEUED' | 'PRESENTING' | 'OPEN' | 'SOLD' | 'UNSOLD';
  currentPrice: string;
  leaderId: string | null;
  leaderName: string | null;
  deadline: number | null;
  bids: LiveBid[];
};
export type LiveMessage = {
  id: string;
  userId: string;
  username: string;
  text: string;
  at: number;
};
export type LiveSession = {
  id: string;
  title: string;
  description: string;
  hostId: string;
  version: string;
  serverNow: number;
  publisherReady: boolean;
  mediaGeneration: string;
  hostConnectionId: string | null;
  connections: { id: string; userId: string }[];
  remainingMs: number | null;
  pauseUntil: number | null;
  hostName: string;
  startsAt: number;
  status: 'SCHEDULED' | 'LIVE' | 'PAUSED' | 'ENDED';
  currentLotIndex: number;
  lots: LiveLot[];
  participants: { id: string; username: string }[];
  messages: LiveMessage[];
};
export type LiveOrder = {
  id: string;
  sessionId: string;
  lotId: string;
  name: string;
  userId: string;
  amount: string;
  paid: boolean;
};
export type LiveState = {
  serverNow?: number;
  wallet: { availableBalance: string; lockedBalance: string } | null;
  sessions: LiveSession[];
  notifications?: { sessionId: string; title: string }[];
  orders: LiveOrder[];
  registrations: Record<string, string[]>;
};
export type NewLiveLot = Pick<
  LiveLot,
  'id' | 'productId' | 'name' | 'description' | 'imageUrl' | 'startingPrice'
> & { productVersion: string };
export type LiveAction =
  | {
      type: 'CREATE';
      title: string;
      description: string;
      startsAt: number;
      lots: NewLiveLot[];
    }
  | {
      type: 'REGISTER' | 'START' | 'OPEN' | 'NEXT' | 'END' | 'RESUME';
      sessionId: string;
    }
  | { type: 'REOPEN' | 'SELECT'; sessionId: string; lotId: string }
  | { type: 'BID'; sessionId: string; amount: string }
  | { type: 'CHAT'; sessionId: string; text: string };

export const availableCoin = (state: LiveState, _userId: string) =>
  state.wallet?.availableBalance ?? '0';

export type LivePayload = {
  sessions?: LiveSession[];
  session?: LiveSession;
  orders?: LiveOrder[];
  wallet?: LiveState['wallet'];
  registrations?: string[];
  notifications?: LiveState['notifications'];
  serverNow?: number;
};

/** Keep room revision and wallet from the same accepted server snapshot. */
export function mergeLiveState(
  state: LiveState,
  data: LivePayload,
  actorId: string,
  roomId: string | null
): LiveState {
  const old = data.session && state.sessions.find((s) => s.id === data.session!.id);
  if (old && BigInt(data.session!.version) < BigInt(old.version)) return state;
  const current = state.sessions.find((s) => s.id === roomId);
  const catalogRoom = data.sessions?.find((s) => s.id === roomId);
  if (current && catalogRoom && BigInt(catalogRoom.version) < BigInt(current.version)) return state;
  if (data.serverNow && state.serverNow && data.serverNow < state.serverNow) return state;
  let sessions = state.sessions;
  if (data.sessions) {
    sessions = data.sessions.map((s) => {
      const previous = state.sessions.find((v) => v.id === s.id);
      return previous && (s.id === roomId || BigInt(previous.version) >= BigInt(s.version))
        ? previous
        : s;
    });
    if (current && !sessions.some((s) => s.id === current.id)) sessions.push(current);
  }
  if (data.session) sessions = [...sessions.filter((s) => s.id !== data.session!.id), data.session];
  return {
    ...state,
    sessions,
    serverNow: data.serverNow ?? state.serverNow,
    wallet: data.wallet === undefined ? state.wallet : data.wallet,
    orders: data.orders ?? state.orders,
    notifications: data.notifications ?? state.notifications,
    registrations: data.registrations ? { [actorId]: data.registrations } : state.registrations
  };
}
