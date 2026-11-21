import { describe, expect, it } from 'vitest';
import { resolveProductImage } from '../src/features/products/imageSource';
const api = 'http://localhost:8080';
describe('product image sources', () => {
  it('accepts uploaded images and the public image CDN used by existing products', () => {
    expect(resolveProductImage('/api/product-images/lamp.png', api)).toBe(
      api + '/api/product-images/lamp.png'
    );
    const seeded = 'https://images.unsplash.com/photo-lamp?auto=format&fit=crop&w=1200';
    expect(resolveProductImage(seeded, api)).toBe(seeded);
    expect(
      resolveProductImage(
        'https://auction.example/api/product-images/lamp.png',
        'https://auction.example'
      )
    ).toBe('https://auction.example/api/product-images/lamp.png');
  });
  it.each([
    null,
    '',
    'invalid',
    'data:image/png;base64,abc',
    'javascript:alert(1)',
    'https://evil.example/image.png',
    'http://images.unsplash.com/photo-lamp',
    'https://images.unsplash.com.evil.example/photo-lamp',
    'https://user:pass@images.unsplash.com/photo-lamp',
    'http://user:pass@localhost:8080/api/product-images/x.png',
    'https://images.unsplash.com:8443/photo-lamp',
    'http://localhost:8080/api/auth/me',
    'http://[broken'
  ])('rejects untrusted image source %s', (value) => {
    expect(resolveProductImage(value, api)).toBeUndefined();
  });
});
