import { useState } from 'react';

/** Test stand-in for `virtual:pwa-register/react`. */
export function useRegisterSW() {
  return {
    needRefresh: useState(false),
    offlineReady: useState(false),
    updateServiceWorker: async () => {},
  };
}
