import AdminLoginForm from './AdminLoginForm';
import { registrationOpen } from '@/lib/site-mode';

// Reads the tenant registry per request: on a claimed single-tenant site the
// login page stops offering registration.
export const dynamic = 'force-dynamic';

export default function AdminLogin() {
  return <AdminLoginForm showRegister={registrationOpen()} />;
}
