// The legacy product catalog contains public photos from this image CDN.
// Keep this list shared with CSP instead of accepting arbitrary remote URLs.
export const productImageOrigins = ['https://images.unsplash.com'] as const;

export function resolveProductImage(value: string | null, apiOrigin: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value, apiOrigin);
    if (url.username || url.password) return undefined;
    if (
      url.origin === new URL(apiOrigin).origin &&
      url.pathname.startsWith('/api/product-images/')
    ) {
      return url.href;
    }
    return productImageOrigins.some((origin) => url.origin === origin) ? url.href : undefined;
  } catch {
    return undefined;
  }
}
