import client from '../../api/axiosClient';
import { csrfHeaders } from '../auth/api/sessionApi';
export type Wallet = { walletId: string; availableBalance: string; lockedBalance: string; updatedAt: string };
export type Entry = { id: string; auctionId: string | null; type: 'DEPOSIT'|'LOCK'|'UNLOCK'|'PAYMENT'; availableDelta: string; lockedDelta: string; createdAt: string };
export type History = { items: Entry[]; nextCursor: string | null };
export async function getWallet() { return (await client.get<Wallet>('/api/wallet')).data; }
export async function getHistory(type: string, cursor?: string) {
 return (await client.get<History>('/api/wallet/transactions', { params: { ...(type ? { type } : {}), ...(cursor ? { cursor } : {}), limit: 20 } })).data;
}
export async function deposit(amount: string) {
 return (await client.post<Wallet>('/api/wallet/deposits', { amount }, { headers: await csrfHeaders(), timeout: 15000 })).data;
}
