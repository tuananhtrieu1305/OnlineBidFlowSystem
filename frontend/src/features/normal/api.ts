import axiosClient from '../../api/axiosClient';
import { isAxiosError } from 'axios';
import type { NormalAuction } from './types';
import { csrfHeaders } from '../auth/api/sessionApi';
import { getWallet, type Wallet } from '../wallet/walletApi';

export type Me = { userId: number; username: string; role: 'USER' | 'ADMIN'; wallet: { available: string; locked: string } | null };
export const balance = (value: Wallet) => ({ available: value.availableBalance, locked: value.lockedBalance });
export type Summary = Pick<NormalAuction, 'id' | 'product' | 'access' | 'status' | 'startsAt' | 'endsAt'> & { joined: boolean };
type ApiProduct = { id: number; name: string; description: string | null; quantity: number; imageUrl: string | null };
type ApiSummary = { id: number; product: ApiProduct; access: 'PUBLIC' | 'PRIVATE'; status: NormalAuction['status']; startsAt: string; endsAt: string; joined: boolean };
type ApiAuction = ApiSummary & { scheduledEndsAt?: string; normalTiming?: NormalAuction['normalTiming']; startingPrice: number; increment: number; bids: NormalAuction['bids']; winner: string | null; winningPrice: number | null; serverTime: string };
export type LiveAuction = NormalAuction & { joined: boolean; serverTime: number };
function product(value: ApiProduct): NormalAuction['product'] {
  return { name: value.name, description: value.description ?? '', quantity: value.quantity, imageUrl: value.imageUrl };
}
function auction(value: ApiAuction): LiveAuction {
  return { ...value, product: product(value.product), startsAt: Date.parse(value.startsAt), endsAt: Date.parse(value.endsAt),
    scheduledEndsAt: value.scheduledEndsAt ? Date.parse(value.scheduledEndsAt) : Date.parse(value.endsAt),
    winner: value.winner ?? undefined, winningPrice: value.winningPrice ?? undefined, serverTime: Date.parse(value.serverTime) };
}

export const normalApi = {
  async wallet() { return balance(await getWallet()); },
  async list(signal?: AbortSignal): Promise<Summary[]> {
    return (await axiosClient.get<ApiSummary[]>('/api/normal/auctions', { signal })).data.map((value) => ({ ...value, product: product(value.product), startsAt: Date.parse(value.startsAt), endsAt: Date.parse(value.endsAt) }));
  },
  async detail(id: number, signal?: AbortSignal) {
    return auction((await axiosClient.get<ApiAuction>(`/api/normal/auctions/${id}`, { signal })).data);
  },
  async join(id: number, roomCode: string) {
    return auction((await axiosClient.post<ApiAuction>(`/api/normal/auctions/${id}/join`, { roomCode: roomCode || null }, { headers: await csrfHeaders() })).data);
  },
  async bid(id: number, amount: number) {
    const response = (await axiosClient.post<{ auction: ApiAuction; wallet: Wallet }>(`/api/normal/auctions/${id}/bids`, { amount }, { headers: await csrfHeaders() })).data;
    return { auction: auction(response.auction), wallet: balance(response.wallet) };
  }
};
export function apiError(error: unknown): string {
  if (isAxiosError(error)) {
    const code = error.response?.data?.code;
    if (code === 'ROOM_CODE_INVALID') return 'Mã phòng không đúng.';
    if (code === 'ROOM_CODE_REQUIRED') return 'Vui lòng nhập mã phòng.';
    if (code === 'ROOM_FULL') return 'Phòng đã đủ số người tham gia.';
    return error.response?.data?.message ?? (error.response?.status === 401 ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' : error.response?.status === 403 ? 'Phiên xác thực hoặc quyền truy cập không còn hợp lệ. Tải lại trang để kiểm tra.' : 'Không thể tải dữ liệu. Kiểm tra server và kết nối mạng, rồi thử lại.');
  }
  return 'Không thể xử lý yêu cầu. Vui lòng thử lại.';
}
