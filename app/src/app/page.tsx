import Link from 'next/link';
import SiteLogo from '@/components/SiteLogo';

export default function Home() {
  return (
    <div className="flex-1 bg-slate-800 flex items-center justify-center">
      <div className="max-w-md mx-auto text-center px-4">
        <SiteLogo size="large" />

        <h1 className="text-4xl font-bold text-slate-100 mt-8 mb-6">
          Photo Album System
        </h1>

        <p className="text-lg text-slate-300 mb-12">
          This is a private photo album — access is by invitation. Contact the
          site administrator for an access key.
        </p>

        <div className="flex justify-center gap-6">
          <Link
            href="/admin/login"
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Admin
          </Link>
          <Link
            href="/register"
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Register
          </Link>
        </div>
      </div>
    </div>
  );
}
