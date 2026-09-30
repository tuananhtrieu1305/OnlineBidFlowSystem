export {};

declare global {
  interface Window {
    desktop?: Readonly<{ platform: string; electronVersion: string }>;
  }
}
