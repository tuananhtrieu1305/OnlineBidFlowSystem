import axiosClient from '../../../api/axiosClient';

export type RegisteredUser = { id: number; username: string; role: 'USER' };
export async function registerAccount(username: string, password: string): Promise<RegisteredUser> {
  const { data } = await axiosClient.post<RegisteredUser>('/api/auth/register', {
    username: username.trim().toLowerCase(), password
  }, { timeout: 15_000 });
  if (!data || !Number.isSafeInteger(data.id) || typeof data.username !== 'string' || data.role !== 'USER') {
    throw new Error('Unexpected registration response');
  }
  return data;
}
