import { NextRequest } from 'next/server';
import { handleInstagramCallback } from '@/lib/instagram';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description') || error;

  if (error) {
    return new Response(
      `<!DOCTYPE html>
<html>
<head>
  <title>Instagram Authorization Failed</title>
  <style>
    body { background: #080A0F; color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
    .box { background: #0E1118; border: 1px solid rgba(255,255,255,0.1); padding: 32px; border-radius: 16px; max-width: 440px; }
    h2 { color: #f43f5e; margin-bottom: 8px; }
    p { color: #94a3b8; font-size: 14px; line-height: 1.5; }
    button { margin-top: 16px; background: #E1306C; color: #fff; border: 0; padding: 10px 20px; font-weight: bold; border-radius: 8px; cursor: pointer; }
  </style>
</head>
<body>
  <div class="box">
    <h2>Instagram Connection Denied</h2>
    <p>Meta returned error: <strong>${errorDescription || 'Access denied'}</strong></p>
    <button onclick="window.close()">Close Window</button>
  </div>
</body>
</html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 400 }
    );
  }

  if (!code) {
    return new Response('Missing authorization code', { status: 400 });
  }

  try {
    const tokens = await handleInstagramCallback(code);

    return new Response(
      `<!DOCTYPE html>
<html>
<head>
  <title>Instagram Connected</title>
  <style>
    body { background: #080A0F; color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
    .box { background: #0E1118; border: 1px solid rgba(255,255,255,0.1); padding: 32px; border-radius: 16px; max-width: 440px; box-shadow: 0 20px 40px rgba(0,0,0,0.6); }
    .badge { width: 64px; height: 64px; border-radius: 50%; background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 28px; }
    h2 { color: #10b981; margin: 0 0 8px; font-size: 20px; }
    .handle { font-size: 18px; font-weight: bold; color: #fff; margin-bottom: 6px; }
    p { color: #94a3b8; font-size: 14px; margin: 0 0 16px; }
    .hint { font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="box">
    <div class="badge">📸</div>
    <h2>Instagram Connected!</h2>
    <div class="handle">@${tokens.igUsername}</div>
    <p>Linked Page: <strong>${tokens.pageName || 'Connected'}</strong></p>
    <div class="hint">This window will close automatically...</div>
  </div>
  <script>
    if (window.opener) {
      window.opener.postMessage({ type: 'INSTAGRAM_AUTH_SUCCESS', username: '${tokens.igUsername}' }, '*');
      setTimeout(() => window.close(), 1200);
    } else {
      setTimeout(() => window.close(), 2500);
    }
  </script>
</body>
</html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  } catch (err: any) {
    console.error('Instagram OAuth Callback Error:', err);
    return new Response(
      `<!DOCTYPE html>
<html>
<head>
  <title>Connection Error</title>
  <style>
    body { background: #080A0F; color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
    .box { background: #0E1118; border: 1px solid rgba(255,255,255,0.1); padding: 32px; border-radius: 16px; max-width: 480px; }
    h2 { color: #f43f5e; margin-bottom: 12px; font-size: 18px; }
    p { color: #94a3b8; font-size: 14px; line-height: 1.5; margin-bottom: 20px; }
    button { background: #334155; color: #fff; border: 0; padding: 10px 20px; font-weight: bold; border-radius: 8px; cursor: pointer; }
  </style>
</head>
<body>
  <div class="box">
    <h2>Instagram Setup Notice</h2>
    <p>${err.message || 'Failed to link Instagram account.'}</p>
    <button onclick="window.close()">Close</button>
  </div>
</body>
</html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 500 }
    );
  }
}
