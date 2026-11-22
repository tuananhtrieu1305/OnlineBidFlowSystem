import { describe, expect, it } from 'vitest';
import { allowsHostMedia, allowsRoomFullscreen } from '../electron/livestream-media';

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

describe('livestream fullscreen permission', () => {
  it('permits trusted viewer and host rooms only in the main frame', () => {
    expect(
      allowsRoomFullscreen('app://auction/#/livestream/12/room', 'app://auction/', true, false)
    ).toBe(true);
    expect(
      allowsRoomFullscreen('app://auction/#/admin/livestream/12', 'app://auction/', true, false)
    ).toBe(true);
    expect(
      allowsRoomFullscreen(
        'http://localhost:5173/#/livestream/12/room',
        'http://localhost:5173/',
        true,
        true
      )
    ).toBe(true);
    expect(
      allowsRoomFullscreen('app://auction/#/livestream/12/room', 'app://auction/', false, false)
    ).toBe(false);
  });
  it('rejects other routes, origins, credentials and packaged access to the dev origin', () => {
    for (const route of [
      '#/',
      '#/admin/livestream/new',
      '#/livestream/12',
      '#/admin/livestream/12/results'
    ])
      expect(allowsRoomFullscreen('app://auction/' + route, 'app://auction/', true, false)).toBe(
        false
      );
    for (const request of ['https://evil.test/', 'app://evil/', 'app://user@auction/'])
      expect(allowsRoomFullscreen('app://auction/#/livestream/12/room', request, true, false)).toBe(
        false
      );
    expect(
      allowsRoomFullscreen(
        'http://localhost:5173/#/livestream/12/room',
        'http://localhost:5173/',
        true,
        false
      )
    ).toBe(false);
    expect(allowsRoomFullscreen('invalid', 'invalid', true, false)).toBe(false);
  });
});
