import { describe, expect, it } from 'vitest';
import {
  availableCoin,
  mergeLiveState,
  type LiveState,
  type LiveSession
} from '../src/features/livestream/liveState';
const session = (id: string, version: string): LiveSession => ({
  id,
  version,
  title: 'Live',
  description: '',
  hostId: '1',
  hostName: 'Host',
  serverNow: 100,
  startsAt: 100,
  status: 'LIVE',
  currentLotIndex: 0,
  lots: [],
  participants: [],
  messages: [],
  publisherReady: true,
  mediaGeneration: '1',
  hostConnectionId: 'host',
  connections: [],
  remainingMs: null,
  pauseUntil: null
});
const empty = (): LiveState => ({ sessions: [], orders: [], wallet: null, registrations: {} });
describe('server snapshots for livestream', () => {
  it('uses exact server Coin without a simulated starting balance', () => {
    const state = empty();
    expect(availableCoin(state, '1')).toBe('0');
    state.wallet = { availableBalance: '9007199254740993', lockedBalance: '101' };
    expect(availableCoin(state, '1')).toBe('9007199254740993');
  });
  it('rejects an old bid HTTP response after a newer WebSocket update, including its wallet', () => {
    const current = mergeLiveState(
      empty(),
      {
        session: session('5', '12'),
        wallet: { availableBalance: '1000', lockedBalance: '0' },
        serverNow: 120
      },
      '2',
      '5'
    );
    const stale = mergeLiveState(
      current,
      {
        session: session('5', '11'),
        wallet: { availableBalance: '900', lockedBalance: '100' },
        serverNow: 125
      },
      '2',
      '5'
    );
    expect(stale).toBe(current);
    expect(stale.wallet?.lockedBalance).toBe('0');
  });
  it('preserves an active room omitted from the bounded catalog and handles registration removal', () => {
    const room = session('old', '8');
    const current = { ...empty(), sessions: [room], registrations: { '2': ['old'] } };
    const next = mergeLiveState(
      current,
      { sessions: [session('new', '1')], registrations: [] },
      '2',
      'old'
    );
    expect(next.sessions).toContain(room);
    expect(next.registrations['2']).toEqual([]);
  });
  it('keeps the full room when an equal-version catalog lacks chat, and ignores older catalog/financial responses', () => {
    const room = {
      ...session('5', '8'),
      messages: [{ id: 'm', userId: '2', username: 'A', text: 'hello', at: 100 }]
    };
    const current = {
      ...empty(),
      sessions: [room],
      serverNow: 100,
      wallet: { availableBalance: '500', lockedBalance: '0' }
    };
    expect(
      mergeLiveState(current, { sessions: [session('5', '8')] }, '2', '5').sessions[0].messages
    ).toHaveLength(1);
    expect(mergeLiveState(current, { sessions: [session('5', '7')], wallet: null }, '2', '5')).toBe(
      current
    );
    expect(mergeLiveState(current, { serverNow: 99, wallet: null }, '2', null)).toBe(current);
  });
  it('accepts a newer sale and authoritative purchase without changing another session', () => {
    const other = session('other', '3');
    const current = { ...empty(), sessions: [session('5', '8'), other] };
    const sold = session('5', '9');
    const order = {
      id: 'o',
      sessionId: '5',
      lotId: 'l',
      name: 'Mouse',
      userId: '2',
      amount: '123',
      paid: true
    };
    const next = mergeLiveState(
      current,
      {
        session: sold,
        orders: [order],
        wallet: { availableBalance: '877', lockedBalance: '0' },
        notifications: [{ sessionId: '5', title: 'Live' }]
      },
      '2',
      '5'
    );
    expect(next.orders).toEqual([order]);
    expect(next.sessions).toContain(other);
    expect(next.wallet?.availableBalance).toBe('877');
    expect(
      mergeLiveState(next, { wallet: null, registrations: ['5'] }, '1', null).wallet
    ).toBeNull();
  });
});
