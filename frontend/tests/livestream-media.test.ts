import { describe, expect, it } from 'vitest';
import { allowsHostMedia } from '../electron/livestream-media';

describe('livestream camera permissions', () => {
  it('only allows media from a trusted main-frame host room', () => {
    expect(
      allowsHostMedia('app://auction/#/admin/livestream/demo-live', 'app://auction/', true, false)
    ).toBe(true);
    expect(
      allowsHostMedia(
        'http://localhost:5173/#/admin/livestream/demo-live',
        'http://localhost:5173/',
        true,
        true
      )
    ).toBe(true);
    for (const url of [
      'https://evil.example/#/admin/livestream/demo-live',
      'app://auction/#/livestream/demo-live/room',
      'app://auction/#/admin/livestream',
      'http://localhost:5173/#/admin/livestream/demo-live'
    ]) {
      expect(allowsHostMedia(url, url, true, false)).toBe(false);
    }
    expect(
      allowsHostMedia(
        'app://auction/#/admin/livestream/demo-live',
        'https://evil.example',
        true,
        false
      )
    ).toBe(false);
    expect(
      allowsHostMedia('app://auction/#/admin/livestream/demo-live', 'app://auction/', false, false)
    ).toBe(false);
  });
});
