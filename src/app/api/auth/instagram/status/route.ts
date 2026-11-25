import { NextResponse } from 'next/server';
import {
  getSavedInstagramTokens,
  getInstagramCredentials,
  clearInstagramTokens,
} from '@/lib/instagram';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { appId, appSecret } = getInstagramCredentials();
    const hasCredentials = Boolean(appId && appSecret);
    const tokens = getSavedInstagramTokens();

    const isConnected = Boolean(tokens && tokens.accessToken && tokens.igUserId);

    return NextResponse.json({
      hasCredentials,
      isConnected,
      username: tokens?.igUsername || null,
      avatar: tokens?.igProfilePicture || null,
      pageName: tokens?.pageName || null,
      expiresAt: tokens?.expiresAt || null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to check Instagram status' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    clearInstagramTokens();
    return NextResponse.json({ success: true, message: 'Instagram account disconnected' });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to disconnect Instagram' },
      { status: 500 }
    );
  }
}
