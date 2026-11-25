import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { CONFIG, getSettings } from './config';

export interface InstagramTokens {
  accessToken: string; // Long-lived (60 days) User Access Token
  expiresAt?: number; // Unix timestamp
  igUserId: string; // Instagram Professional Account ID
  igUsername: string; // @handle
  igProfilePicture?: string;
  pageId?: string; // Linked Facebook Page ID
  pageName?: string;
}

const REDIRECT_URI = 'http://localhost:3000/api/auth/instagram/callback';

export function getInstagramCredentials(): { appId: string; appSecret: string } {
  const settings = getSettings();
  const appId =
    process.env.INSTAGRAM_APP_ID ||
    process.env.META_APP_ID ||
    process.env.FACEBOOK_APP_ID ||
    settings.instagramAppId ||
    '';
  const appSecret =
    process.env.INSTAGRAM_APP_SECRET ||
    process.env.META_APP_SECRET ||
    process.env.FACEBOOK_APP_SECRET ||
    settings.instagramAppSecret ||
    '';
  return { appId: appId.trim(), appSecret: appSecret.trim() };
}

export function getSavedInstagramTokens(): InstagramTokens | null {
  try {
    if (fs.existsSync(CONFIG.INSTAGRAM_AUTH_FILE)) {
      const raw = fs.readFileSync(CONFIG.INSTAGRAM_AUTH_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Failed to read Instagram tokens:', err);
  }
  return null;
}

export function saveInstagramTokens(tokens: InstagramTokens): void {
  if (!fs.existsSync(CONFIG.STORAGE_DIR)) {
    fs.mkdirSync(CONFIG.STORAGE_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG.INSTAGRAM_AUTH_FILE, JSON.stringify(tokens, null, 2), 'utf-8');
}

export function clearInstagramTokens(): void {
  try {
    if (fs.existsSync(CONFIG.INSTAGRAM_AUTH_FILE)) {
      fs.unlinkSync(CONFIG.INSTAGRAM_AUTH_FILE);
    }
  } catch (err) {
    console.error('Failed to clear Instagram tokens:', err);
  }
}

/**
 * Generates the Meta / Instagram OAuth2 Authorization URL
 */
export function getInstagramAuthUrl(): string {
  const { appId } = getInstagramCredentials();
  if (!appId) {
    throw new Error('Meta App ID is missing. Add it in Settings or your .env file.');
  }

  const scopes = [
    'instagram_basic',
    'instagram_content_publish',
    'pages_show_list',
    'pages_read_engagement',
  ].join(',');

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: scopes,
    state: `ig_${Date.now()}`,
  });

  return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
}

/**
 * Handles the OAuth code redirect:
 * 1. Exchanges code for short-lived User token
 * 2. Exchanges short-lived token for 60-day long-lived User token
 * 3. Inspects linked Facebook Pages & Instagram Professional accounts
 * 4. Saves active Instagram credentials
 */
export async function handleInstagramCallback(code: string): Promise<InstagramTokens> {
  const { appId, appSecret } = getInstagramCredentials();
  if (!appId || !appSecret) {
    throw new Error('Missing Meta App ID or App Secret');
  }

  // 1. Exchange authorization code for short-lived user access token
  const tokenUrl = new URL('https://graph.facebook.com/v21.0/oauth/access_token');
  tokenUrl.searchParams.set('client_id', appId);
  tokenUrl.searchParams.set('client_secret', appSecret);
  tokenUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  tokenUrl.searchParams.set('code', code);

  const tokenRes = await fetch(tokenUrl.toString(), { method: 'GET' });
  const tokenData = await tokenRes.json();

  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(
      tokenData.error?.message || 'Failed to exchange authorization code for Meta access token'
    );
  }

  const shortLivedToken = tokenData.access_token;

  // 2. Exchange short-lived token for 60-day Long-Lived User Access Token
  const longLivedUrl = new URL('https://graph.facebook.com/v21.0/oauth/access_token');
  longLivedUrl.searchParams.set('grant_type', 'fb_exchange_token');
  longLivedUrl.searchParams.set('client_id', appId);
  longLivedUrl.searchParams.set('client_secret', appSecret);
  longLivedUrl.searchParams.set('fb_exchange_token', shortLivedToken);

  const longLivedRes = await fetch(longLivedUrl.toString(), { method: 'GET' });
  const longLivedData = await longLivedRes.json();

  const accessToken = longLivedData.access_token || shortLivedToken;
  const expiresIn = longLivedData.expires_in || 5184000; // 60 days
  const expiresAt = Date.now() + expiresIn * 1000;

  // 3. Find connected Facebook Page and linked Instagram Business Account
  const accountsUrl = new URL('https://graph.facebook.com/v21.0/me/accounts');
  accountsUrl.searchParams.set(
    'fields',
    'id,name,access_token,instagram_business_account{id,username,profile_picture_url}'
  );
  accountsUrl.searchParams.set('access_token', accessToken);

  const accountsRes = await fetch(accountsUrl.toString());
  const accountsData = await accountsRes.json();

  if (!accountsRes.ok || !accountsData.data || accountsData.data.length === 0) {
    throw new Error(
      'No Facebook Pages found. Please ensure your Facebook account has a Facebook Page linked to your Instagram Professional Account.'
    );
  }

  // Find the page that has an active Instagram Business/Creator account connected
  const pageWithIg = accountsData.data.find(
    (page: any) => page.instagram_business_account && page.instagram_business_account.id
  );

  if (!pageWithIg || !pageWithIg.instagram_business_account) {
    throw new Error(
      `Found Facebook Page "${accountsData.data[0]?.name}", but no Instagram Professional account is connected to it. In your Instagram App, go to Settings -> Creator/Business tools -> Connect a Facebook Page.`
    );
  }

  const igAccount = pageWithIg.instagram_business_account;

  const tokens: InstagramTokens = {
    accessToken,
    expiresAt,
    igUserId: igAccount.id,
    igUsername: igAccount.username,
    igProfilePicture: igAccount.profile_picture_url,
    pageId: pageWithIg.id,
    pageName: pageWithIg.name,
  };

  saveInstagramTokens(tokens);
  return tokens;
}

/**
 * Connects directly using a Meta Access Token (e.g. from Graph API Explorer).
 * Automatically resolves the linked Instagram Business account and saves the session.
 */
export async function connectWithDirectToken(token: string): Promise<InstagramTokens> {
  const accessToken = token.trim();
  if (!accessToken) throw new Error('Access Token cannot be empty');

  // Find connected Facebook Page and linked Instagram Business Account
  const accountsUrl = new URL('https://graph.facebook.com/v21.0/me/accounts');
  accountsUrl.searchParams.set(
    'fields',
    'id,name,access_token,instagram_business_account{id,username,profile_picture_url}'
  );
  accountsUrl.searchParams.set('access_token', accessToken);

  const accountsRes = await fetch(accountsUrl.toString());
  const accountsData = await accountsRes.json();

  if (!accountsRes.ok || !accountsData.data || accountsData.data.length === 0) {
    throw new Error(
      accountsData.error?.message ||
        'No Facebook Pages found for this token. Make sure your token has permissions: instagram_basic, instagram_content_publish, pages_show_list, pages_read_engagement'
    );
  }

  const pageWithIg = accountsData.data.find(
    (page: any) => page.instagram_business_account && page.instagram_business_account.id
  );

  if (!pageWithIg || !pageWithIg.instagram_business_account) {
    throw new Error(
      `Found Facebook Page "${accountsData.data[0]?.name}", but no Instagram Professional account is connected to it. In your Instagram App: Settings -> Creator/Business tools -> Connect a Facebook Page.`
    );
  }

  const igAccount = pageWithIg.instagram_business_account;

  const tokens: InstagramTokens = {
    accessToken,
    expiresAt: Date.now() + 60 * 24 * 3600 * 1000,
    igUserId: igAccount.id,
    igUsername: igAccount.username,
    igProfilePicture: igAccount.profile_picture_url,
    pageId: pageWithIg.id,
    pageName: pageWithIg.name,
  };

  saveInstagramTokens(tokens);
  return tokens;
}

export interface PublishReelParams {
  videoPath: string; // Absolute path to local MP4
  caption: string;
  shareToFeed?: boolean;
  onProgress?: (progress: number, message: string) => void;
}

export interface PublishReelResult {
  mediaId: string;
  permalink: string;
}

/**
 * Publishes a vertical video clip to Instagram Reels using direct binary resumable upload.
 * No public cloud bucket or web server required!
 */
export async function publishReelToInstagram(
  params: PublishReelParams
): Promise<PublishReelResult> {
  const tokens = getSavedInstagramTokens();
  if (!tokens || !tokens.accessToken || !tokens.igUserId) {
    throw new Error('Instagram account is not connected. Connect in Settings or the publish modal.');
  }

  if (!fs.existsSync(params.videoPath)) {
    throw new Error(`Video file not found at ${params.videoPath}`);
  }

  const fileStats = fs.statSync(params.videoPath);
  const fileSize = fileStats.size;

  params.onProgress?.(10, 'Initializing Instagram Reels upload session...');

  // Step 1: Create Resumable Reels Media Container on Meta Graph API
  const createContainerUrl = `https://graph.facebook.com/v21.0/${tokens.igUserId}/media`;
  const containerRes = await fetch(createContainerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      media_type: 'REELS',
      upload_type: 'resumable',
      caption: params.caption,
      share_to_feed: params.shareToFeed ?? true,
      access_token: tokens.accessToken,
    }),
  });

  const containerData = await containerRes.json();
  if (!containerRes.ok || !containerData.id || !containerData.uri) {
    throw new Error(
      containerData.error?.message || 'Failed to initialize Instagram Reels container session'
    );
  }

  const containerId = containerData.id;
  const uploadUri = containerData.uri;

  params.onProgress?.(30, 'Uploading vertical video directly to Meta servers...');

  // Step 2: Upload local binary MP4 to rupload.facebook.com
  let uploadSuccess = false;
  let uploadErrorMsg = '';

  // Primary: curl with --data-binary (exact standard documented by Meta)
  try {
    const curlArgs = [
      '-s',
      '-S',
      '-X',
      'POST',
      uploadUri,
      '-H',
      `Authorization: OAuth ${tokens.accessToken}`,
      '-H',
      'offset: 0',
      '-H',
      `file_size: ${fileSize}`,
      '-H',
      `Content-Length: ${fileSize}`,
      '-H',
      'Content-Type: application/octet-stream',
      '--data-binary',
      `@${params.videoPath}`,
    ];

    const curlResult = await new Promise<{ code: number; stdout: string; stderr: string }>(
      (resolve) => {
        const proc = spawn('curl', curlArgs);
        let stdout = '';
        let stderr = '';
        proc.stdout.on('data', (d) => (stdout += d.toString()));
        proc.stderr.on('data', (d) => (stderr += d.toString()));
        proc.on('close', (code) => resolve({ code: code || 0, stdout, stderr }));
      }
    );

    if (curlResult.code === 0 && curlResult.stdout) {
      try {
        const json = JSON.parse(curlResult.stdout);
        if (json.success || json.id) {
          uploadSuccess = true;
        } else if (json.error) {
          uploadErrorMsg = json.error.message || JSON.stringify(json.error);
        }
      } catch {
        if (curlResult.stdout.includes('success')) {
          uploadSuccess = true;
        } else {
          uploadErrorMsg = curlResult.stdout.slice(0, 300);
        }
      }
    } else {
      uploadErrorMsg = curlResult.stderr || `curl exit code ${curlResult.code}`;
    }
  } catch (err: any) {
    uploadErrorMsg = err.message;
  }

  // Fallback: Node.js fetch with Content-Length & Uint8Array
  if (!uploadSuccess) {
    try {
      const videoBuffer = fs.readFileSync(params.videoPath);
      const uploadRes = await fetch(uploadUri, {
        method: 'POST',
        headers: {
          Authorization: `OAuth ${tokens.accessToken}`,
          offset: '0',
          file_size: String(fileSize),
          'Content-Length': String(fileSize),
          'Content-Type': 'application/octet-stream',
        },
        body: new Uint8Array(videoBuffer),
      });

      const responseText = await uploadRes.text();
      try {
        const uploadData = JSON.parse(responseText);
        if (uploadRes.ok && (uploadData.success || uploadData.id)) {
          uploadSuccess = true;
        } else {
          uploadErrorMsg = uploadData.error?.message || responseText;
        }
      } catch {
        if (uploadRes.ok) {
          uploadSuccess = true;
        } else {
          uploadErrorMsg = responseText || `HTTP ${uploadRes.status}`;
        }
      }
    } catch (err: any) {
      uploadErrorMsg = err.message;
    }
  }

  if (!uploadSuccess) {
    throw new Error(`Meta rupload error: ${uploadErrorMsg || 'Failed to upload video binary data'}`);
  }

  params.onProgress?.(65, 'Meta is transcoding and processing your Reel...');

  // Step 3: Poll Container Processing Status until FINISHED
  const maxPolls = 35; // ~100 seconds
  let isReady = false;

  for (let poll = 1; poll <= maxPolls; poll++) {
    await new Promise((r) => setTimeout(r, 3000));

    const statusUrl = `https://graph.facebook.com/v21.0/${containerId}?fields=status_code,status&access_token=${tokens.accessToken}`;
    const statusRes = await fetch(statusUrl);
    const statusData = await statusRes.json();

    const statusCode = statusData.status_code;

    if (statusCode === 'FINISHED') {
      isReady = true;
      break;
    } else if (statusCode === 'ERROR') {
      throw new Error(`Meta transcoding failed: ${statusData.status || 'Internal error'}`);
    } else if (statusCode === 'EXPIRED') {
      throw new Error('Meta container expired before processing completed. Please try again.');
    }

    const currentProgress = Math.min(88, 65 + Math.round((poll / maxPolls) * 23));
    params.onProgress?.(currentProgress, `Processing Reel on Instagram servers (${poll * 3}s)...`);
  }

  if (!isReady) {
    throw new Error('Reel processing timed out on Meta servers. Please retry in a few moments.');
  }

  params.onProgress?.(92, 'Publishing Reel to your Instagram profile...');

  // Step 4: Publish Container
  const publishUrl = `https://graph.facebook.com/v21.0/${tokens.igUserId}/media_publish`;
  const publishRes = await fetch(publishUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_id: containerId,
      access_token: tokens.accessToken,
    }),
  });

  const publishData = await publishRes.json();
  if (!publishRes.ok || !publishData.id) {
    throw new Error(publishData.error?.message || 'Failed to publish Reel to Instagram');
  }

  const mediaId = publishData.id;

  // Step 5: Fetch published permalink
  let permalink = `https://www.instagram.com/${tokens.igUsername}/`;
  try {
    const permalinkUrl = `https://graph.facebook.com/v21.0/${mediaId}?fields=permalink,id&access_token=${tokens.accessToken}`;
    const permalinkRes = await fetch(permalinkUrl);
    const permalinkData = await permalinkRes.json();
    if (permalinkData.permalink) {
      permalink = permalinkData.permalink;
    }
  } catch {}

  params.onProgress?.(100, 'Reel published successfully to Instagram!');

  return { mediaId, permalink };
}
