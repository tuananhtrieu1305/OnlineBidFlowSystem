export type NormalBid = { id: number; username: string; amount: number; createdAt: string };
export type NormalAuction = {
  id: number;
  product: { name: string; description: string; quantity: number; imageUrl: string | null };
  access: 'PUBLIC' | 'PRIVATE';
  status: 'RUNNING' | 'UPCOMING' | 'SOLD' | 'UNSOLD';
  startingPrice: number;
  increment: number;
  normalTiming?: { closingWindowSeconds: number; extensionSeconds: number; leaderboardSeconds: number };
  scheduledEndsAt?: number;
  endsAt: number;
  startsAt: number;
  bids: NormalBid[];
  winner?: string;
  winningPrice?: number;
};

export function leadingBid(auction: NormalAuction) {
  return [...auction.bids].sort((a, b) => b.amount - a.amount || a.createdAt.localeCompare(b.createdAt))[0];
}
