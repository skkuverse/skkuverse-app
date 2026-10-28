import type { WebToAppMessage } from './types';

declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage(message: string): void;
    };
  }
}

export function postToApp(msg: WebToAppMessage): void {
  window.ReactNativeWebView?.postMessage(JSON.stringify(msg));
}
