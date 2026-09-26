import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

interface RouterApi { path: string; go: (path: string) => void }
const Ctx = createContext<RouterApi>({ path: '/', go: () => undefined });

export function RouterProvider({ children }: { children: ReactNode }) {
  const [path, setPath] = useState(() => window.location.pathname || '/');
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname || '/');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const go = useCallback((next: string) => {
    if (next === window.location.pathname) return;
    window.history.pushState({}, '', next);
    setPath(next);
    window.scrollTo({ top: 0 });
  }, []);
  return <Ctx.Provider value={{ path, go }}>{children}</Ctx.Provider>;
}

export function useRouter() { return useContext(Ctx); }

/** "/receteler/:id" gibi basit desen eşleştirme */
export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split('/').filter(Boolean);
  const a = path.split('/').filter(Boolean);
  if (p.length !== a.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(a[i]);
    else if (p[i] !== a[i]) return null;
  }
  return params;
}

export function Link({ to, className, children }: { to: string; className?: string; children: ReactNode }) {
  const { go } = useRouter();
  return (
    <a href={to} className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        go(to);
      }}>
      {children}
    </a>
  );
}
