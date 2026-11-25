import { NextResponse } from 'next/server';
import { getInstagramAuthUrl, getInstagramCredentials } from '@/lib/instagram';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { appId, appSecret } = getInstagramCredentials();
    const isConfigured = Boolean(appId && appSecret);

    if (!isConfigured) {
      return NextResponse.json({
        configured: false,
        authUrl: null,
        message: 'Meta App ID or App Secret is missing. Please configure them in Settings.',
      });
    }

    const authUrl = getInstagramAuthUrl();
    return NextResponse.json({
      configured: true,
      authUrl,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to generate Instagram auth URL' },
      { status: 500 }
    );
  }
}
