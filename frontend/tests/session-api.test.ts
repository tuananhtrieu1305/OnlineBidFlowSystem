import { beforeEach, expect, it, vi } from 'vitest';
const client = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../src/api/axiosClient', () => ({ default: client }));
import { currentUser, loginAccount, logoutAccount } from '../src/features/auth/api/sessionApi';
const user = { id: 1, username: 'batien', role: 'USER' };
beforeEach(() => vi.resetAllMocks());

it('distinguishes an expired session from network failure', async () => {
  client.get.mockResolvedValueOnce({ data: user });
  expect(await currentUser()).toEqual(user);
  client.get.mockRejectedValueOnce({ isAxiosError: true, response: { status: 401 } });
  expect(await currentUser()).toBeNull();
  client.get.mockRejectedValueOnce(new Error('offline'));
  await expect(currentUser()).rejects.toThrow('offline');
});
it('normalizes username without modifying password and sends CSRF', async () => {
  client.get.mockResolvedValueOnce({ data: { token: 'csrf-value' } });
  client.post.mockResolvedValueOnce({ data: user });
  expect(await loginAccount(' BATIEN ', ' pass word ')).toEqual(user);
  expect(client.post).toHaveBeenCalledWith('/api/auth/login', { username: 'batien', password: ' pass word ' },
    { headers: { 'X-CSRF-TOKEN': 'csrf-value' }, timeout: 15000 });
});
it('refuses an invalid CSRF response without sending credentials', async () => {
  client.get.mockResolvedValueOnce({ data: {} });
  await expect(loginAccount('batien', 'password')).rejects.toThrow('Missing CSRF');
  expect(client.post).not.toHaveBeenCalled();
});
it('rejects malformed identity data and unrecognized roles', async () => {
  for (const data of [null, { ...user, id: '1' }, { ...user, username: null }, { ...user, role: 'ROOT' }]) {
    client.get.mockResolvedValueOnce({ data });
    await expect(currentUser()).rejects.toThrow('Unexpected session');
  }
  client.get.mockResolvedValueOnce({ data: { ...user, role: 'ADMIN' } });
  expect((await currentUser())?.role).toBe('ADMIN');
});
it('logout treats an expired session as complete but propagates network/server errors', async () => {
  client.get.mockResolvedValue({ data: { token: 'csrf-value' } });
  client.post.mockResolvedValueOnce({ status: 204 });
  await logoutAccount();
  client.post.mockRejectedValueOnce({ isAxiosError: true, response: { status: 401 } });
  await logoutAccount();
  client.post.mockRejectedValueOnce({ isAxiosError: true, response: { status: 500 } });
  await expect(logoutAccount()).rejects.toEqual({ isAxiosError: true, response: { status: 500 } });
  client.post.mockRejectedValueOnce(new Error('offline'));
  await expect(logoutAccount()).rejects.toThrow('offline');
});
