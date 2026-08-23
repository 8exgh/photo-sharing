export default function SiteFooter() {
  return (
    <footer className="py-4 border-t border-slate-600 text-center text-xs text-slate-500">
      <span className="inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4">
        <span>
          Created by{' '}
          <a
            href="https://8examples.com"
            target="_blank"
            rel="noopener"
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            8examples.com
          </a>
        </span>
        <span className="text-slate-600" aria-hidden="true">
          •
        </span>
        <span>
          Hosted by{' '}
          <a
            href="https://swiftgrid.net"
            target="_blank"
            rel="noopener"
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            SwiftGrid.net
          </a>
        </span>
      </span>
    </footer>
  );
}
