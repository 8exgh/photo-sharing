import { NextResponse } from 'next/server';
import { getSchemaStatus } from '@/lib/schema';

export const runtime = 'nodejs';

/**
 * Health check endpoint for container orchestration
 * Returns 200 OK if the application is healthy
 */
export async function GET() {
  try {
    // Check schema status
    const schemaStatus = await getSchemaStatus();

    // If migrations are needed, report as unhealthy
    // (migrations should run on container start, so this indicates a problem)
    if (schemaStatus.needsMigration) {
      return NextResponse.json(
        {
          status: 'unhealthy',
          reason: 'migrations_pending',
          schemaVersion: schemaStatus.currentVersion,
          appVersion: schemaStatus.appVersion,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      schemaVersion: schemaStatus.currentVersion,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        reason: 'internal_error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}
