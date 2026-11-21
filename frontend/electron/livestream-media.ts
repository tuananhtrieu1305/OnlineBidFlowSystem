export function allowsHostMedia(
  pageUrl: string,
  requestingUrl: string,
  mainFrame: boolean,
  development: boolean
): boolean {
  try {
    const page = new URL(pageUrl);
    const request = new URL(requestingUrl);
    const local = page.protocol === 'app:' && page.host === 'auction';
    const dev = development && page.protocol === 'http:' && page.host === 'localhost:5173';
    return (
      mainFrame &&
      !page.username &&
      !page.password &&
      (local || dev) &&
      page.pathname === '/' &&
      /^#\/admin\/livestream\/(?!new$)[^/?#]+$/.test(page.hash) &&
      request.protocol === page.protocol &&
      request.host === page.host &&
      !request.username &&
      !request.password
    );
  } catch {
    return false;
  }
}

/** Fullscreen is allowed only for the top-level, trusted live-room document. */
export function allowsRoomFullscreen(
  pageUrl: string,
  requestingUrl: string,
  mainFrame: boolean,
  development: boolean
): boolean {
  try {
    const page = new URL(pageUrl),
      request = new URL(requestingUrl);
    const local = page.protocol === 'app:' && page.host === 'auction';
    const dev = development && page.protocol === 'http:' && page.host === 'localhost:5173';
    return (
      mainFrame &&
      !page.username &&
      !page.password &&
      (local || dev) &&
      page.pathname === '/' &&
      (/^#\/livestream\/[^/?#]+\/room$/.test(page.hash) ||
        /^#\/admin\/livestream\/(?!new$)[^/?#]+$/.test(page.hash)) &&
      request.protocol === page.protocol &&
      request.host === page.host &&
      !request.username &&
      !request.password
    );
  } catch {
    return false;
  }
}
