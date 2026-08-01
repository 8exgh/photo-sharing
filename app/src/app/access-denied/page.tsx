import SiteLogo from '@/components/SiteLogo';

export default function AccessDenied() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-800">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <SiteLogo size="large" />
          <h2 className="mt-6 text-3xl font-extrabold text-slate-100">
            Access Denied
          </h2>
          <p className="mt-2 text-sm text-slate-300">
            You need a valid access key to view albums.
          </p>
        </div>
        
        <div className="mt-8">
          <div className="bg-red-900 border border-red-700 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-200">
                  Unauthorized Access
                </h3>
                <div className="mt-2 text-sm text-red-300">
                  <p>Please contact the site administrator for access.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}