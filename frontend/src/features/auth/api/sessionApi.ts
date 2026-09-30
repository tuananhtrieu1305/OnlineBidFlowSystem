import axios from 'axios';
import client from '../../../api/axiosClient';

export type SessionUser = { id: number; username: string; role: 'USER' | 'ADMIN' };
function identity(data: SessionUser): SessionUser {
  if (!data || !Number.isSafeInteger(data.id) || typeof data.username !== 'string' || !['USER', 'ADMIN'].includes(data.role)) {
    throw new Error('Unexpected session response');
  }
  return data;
}
export async function currentUser(): Promise<SessionUser | null> {
  try { return identity((await client.get<SessionUser>('/api/auth/me')).data); }
  catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) return null;
    throw error;
  }
}
async function csrfHeaders() {
  const { data } = await client.get<{ token: string }>('/api/auth/csrf');
  if (typeof data?.token !== 'string' || !data.token) throw new Error('Missing CSRF token');
  return { 'X-CSRF-TOKEN': data.token };
}
export async function loginAccount(username: string, password: string) {
  const headers = await csrfHeaders();
  const { data } = await client.post<SessionUser>('/api/auth/login',
    { username: username.trim().toLowerCase(), password }, { headers, timeout: 15_000 });
  return identity(data);
}
export async function logoutAccount() {
  try { await client.post('/api/auth/logout', {}, { headers: await csrfHeaders() }); }
  catch (error) {
    if (!axios.isAxiosError(error) || error.response?.status !== 401) throw error;
  }
}
