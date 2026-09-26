import { Component, type ErrorInfo, type ReactNode } from 'react';

/** Bir ekranda hata olursa bütün uygulama boş kalmaz: anlaşılır bir mesaj ve "Yenile" gösterilir. */
export class ErrorBoundary extends Component<{ children: ReactNode; compact?: boolean }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('[Trakya Catering] ekran hatası', error, info.componentStack); }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className={this.props.compact ? 'p-6' : 'min-h-dvh grid place-items-center p-6 bg-surface'}>
        <div className="tc-card max-w-md w-full p-6 text-center">
          <div className="text-lg font-bold text-ink">Bu ekran açılırken bir sorun oldu</div>
          <p className="text-sm text-ink-3 mt-2">Sayfayı yenileyin. Sorun sürerse aşağıdaki hata metnini bize iletin.</p>
          <pre className="mt-3 text-left text-[11px] text-stop bg-stop-soft rounded-xl p-3 whitespace-pre-wrap break-words max-h-40 overflow-auto">{error.message}</pre>
          <div className="flex justify-center gap-2 mt-4">
            <button type="button" className="rounded-xl px-4 py-2 text-sm font-semibold ring-1 ring-line" onClick={() => this.setState({ error: null })}>Tekrar dene</button>
            <button type="button" className="rounded-xl px-4 py-2 text-sm font-semibold bg-brand text-on-brand" onClick={() => window.location.reload()}>Yenile</button>
          </div>
        </div>
      </div>
    );
  }
}
