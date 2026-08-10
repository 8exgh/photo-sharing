import { queryPendingVerificationEmails } from '../queries';
import { markVerificationEmailSent } from '../commands';
import { getAppBaseUrl, sendVerificationEmail } from '../mailer';
import { log, logError } from '../logger';

// Background job, inventory-shopify style: ask a query for outstanding work,
// perform it, then record completion through a command so the next query no
// longer returns it. A failed send stays pending and is retried next cycle.
export async function runVerificationEmailJob(): Promise<void> {
  const TAG = 'jobs:verification-emails';
  const pending = queryPendingVerificationEmails();
  if (pending.length === 0) return;

  log(TAG, 'Pending verification emails found', { count: pending.length });
  const baseUrl = getAppBaseUrl();

  for (const item of pending) {
    try {
      const verifyUrl = `${baseUrl}/api/auth/verify?username=${encodeURIComponent(item.tenantId)}&token=${item.token}`;
      await sendVerificationEmail(item.email, item.tenantId, verifyUrl);
      markVerificationEmailSent(item.tenantId, item.token);
      log(TAG, 'Verification email processed', { tenantId: item.tenantId });
    } catch (error) {
      logError(TAG, `Failed to send verification email for ${item.tenantId} - will retry`, error);
    }
  }
}
