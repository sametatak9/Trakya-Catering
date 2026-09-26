import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './app/App';
import { RouterProvider } from './app/router';
import { SessionProvider } from './app/session';
import { ToastProvider } from './ui/toast';
import { ConfirmHost } from './ui/confirm';
import { ErrorBoundary } from './ui/ErrorBoundary';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: true, retry: 1 },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <RouterProvider>
          <ToastProvider>
            <App />
            <ConfirmHost />
          </ToastProvider>
        </RouterProvider>
      </SessionProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
