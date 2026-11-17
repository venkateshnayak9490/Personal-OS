import '@fontsource-variable/inter';
import './index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { listenForInstallPrompt } from '@/app/pwa-install';
import { routes } from '@/app/routes';
import { db } from '@/core/db';
import { getDeviceId } from '@/core/device';
import { requestPersistentStorage } from '@/core/storage';

listenForInstallPrompt();

// Open the local database early and make sure this device has an id.
void getDeviceId(db).catch((err: unknown) => console.error('Could not open local database', err));
// Ask the browser to keep our data (silently granted in Chrome for installed/engaged apps).
void requestPersistentStorage();

const router = createBrowserRouter(routes);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
