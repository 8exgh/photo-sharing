import Link from 'next/link';
import RegisterForm from './RegisterForm';
import { registrationOpen } from '@/lib/site-mode';

// Reads the tenant registry on every request so a single-tenant site closes
// registration the moment its first account is created.
export const dynamic = 'force-dynamic';

export default function Register() {
  if (!registrationOpen()) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-800">
        <div className="max-w-md w-full space-y-6 text-center">
          <h2 className="text-3xl font-extrabold text-slate-100">Registration is closed</h2>
          <p className="text-slate-300">
            This site already has an owner. If you were given an access key, use
            the link you received to view the albums.
          </p>
          <Link href="/admin/login" className="text-blue-400 hover:text-blue-300">
            Admin sign in
          </Link>
        </div>
      </div>
    );
  }

  return <RegisterForm />;
}
