import client from '../../api/axiosClient';

export type LeaderboardType = 'ALL' | 'BLIND';
export type LeaderboardPeriod = 'ALL_TIME' | 'MONTH';
export type PlayerRank = { id: string; username: string; rank: number; wins: number; played: number };
export type LeaderboardBoard = { type: LeaderboardType; period: LeaderboardPeriod; month: string | null;
  top: PlayerRank[]; totalPlayers: number };
export type PersonalStats = { wins: number; played: number; coinSpent: string };
export type LeaderboardMine = { publicRank: PlayerRank | null; privateStats: PersonalStats; allStats: PersonalStats };

const params = (type: LeaderboardType, period: LeaderboardPeriod) => ({ type, period });
export async function getLeaderboard(type: LeaderboardType, period: LeaderboardPeriod, signal?: AbortSignal) {
  return (await client.get<LeaderboardBoard>('/api/leaderboard', { params: params(type, period), signal })).data;
}
export async function getMyLeaderboard(type: LeaderboardType, period: LeaderboardPeriod, signal?: AbortSignal) {
  return (await client.get<LeaderboardMine>('/api/leaderboard/me', { params: params(type, period), signal })).data;
}
