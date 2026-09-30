import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveAsset } from '../electron/asset-path';

describe('desktop asset serving', () => {
  const root = path.resolve('dist');
  it('serves the app entry and built assets', () => {
    expect(resolveAsset('app://auction/', root)).toBe(path.join(root, 'index.html'));
    expect(resolveAsset('app://auction/assets/index.js', root)).toBe(path.join(root, 'assets/index.js'));
  });
  it.each(['https://auction/index.html', 'app://other/index.html', 'app://auction/%2e%2e%2fsecret', 'app://auction/%2e%2e%5csecret', 'app://auction/C:%5csecret', 'app://auction/%00', 'app://auction/%zz', 'app://user@auction/'])('blocks unexpected origins and unsafe paths %s', (url) => {
    expect(resolveAsset(url, root)).toBeNull();
  });
});
