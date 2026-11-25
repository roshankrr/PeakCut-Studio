'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Instagram,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Check,
  Share2,
} from 'lucide-react';
import { Clip } from '@/lib/types';

interface InstagramPublishModalProps {
  clip: Clip;
  jobId: string;
  sourceTitle?: string;
  sourceUrl?: string;
  onClose: () => void;
  onPublished?: (permalink: string) => void;
}

interface InstagramStatus {
  hasCredentials: boolean;
  isConnected: boolean;
  username?: string | null;
  avatar?: string | null;
  pageName?: string | null;
}

export default function InstagramPublishModal({
  clip,
  jobId,
  sourceTitle,
  sourceUrl,
  onClose,
  onPublished,
}: InstagramPublishModalProps) {
  const [status, setStatus] = useState<InstagramStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const initialCredit = sourceUrl
    ? `\n\n📌 Credit / Original: ${sourceTitle || 'Original Streamer'}\n🔗 ${sourceUrl}`
    : sourceTitle
    ? `\n\n📌 Credit: ${sourceTitle}`
    : '';

  const initialCaption = `${clip.hook ? `🔥 ${clip.hook}\n\n` : ''}${clip.description}\n\n${(clip.hashtags || []).join(' ')}${initialCredit}\n\n#reels #viral #shorts #trending`;

  const [caption, setCaption] = useState(initialCaption);
  const [shareToFeed, setShareToFeed] = useState(true);

  const [publishing, setPublishing] = useState(false);
  const [publishProgress, setPublishProgress] = useState(0);
  const [publishStep, setPublishStep] = useState<string>('');
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [directToken, setDirectToken] = useState('');
  const [submittingToken, setSubmittingToken] = useState(false);

  // Check Instagram connection status
  const fetchStatus = async () => {
    try {
      setLoadingStatus(true);
      const res = await fetch('/api/auth/instagram/status');
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus({ hasCredentials: false, isConnected: false });
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    // Listen for OAuth success message from popup window
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'INSTAGRAM_AUTH_SUCCESS') {
        fetchStatus();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleConnect = async () => {
    try {
      const res = await fetch('/api/auth/instagram/url');
      const data = await res.json();
      if (!data.configured) {
        setPublishError(
          'Meta App ID and App Secret are not configured yet. Paste your Graph API Explorer token below for instant connection!'
        );
        return;
      }
      if (data.authUrl) {
        const width = 600;
        const height = 700;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;
        window.open(
          data.authUrl,
          'InstagramAuth',
          `width=${width},height=${height},top=${top},left=${left},resizable,scrollbars=yes`
        );
      }
    } catch (err: any) {
      setPublishError(err.message || 'Failed to start Instagram connection');
    }
  };

  const handleDirectTokenConnect = async () => {
    if (!directToken.trim()) return;
    setSubmittingToken(true);
    setPublishError(null);
    try {
      const res = await fetch('/api/auth/instagram/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: directToken.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to connect Instagram account');

      setDirectToken('');
      fetchStatus();
    } catch (err: any) {
      setPublishError(err.message || 'Failed to link Instagram account');
    } finally {
      setSubmittingToken(false);
    }
  };

  const handlePublish = async () => {
    if (!status?.isConnected) return;
    setPublishing(true);
    setPublishError(null);
    setPublishProgress(15);
    setPublishStep('Initializing Instagram Reels upload session...');

    try {
      // Smooth progress animation while Meta processes
      const progTimer = setInterval(() => {
        setPublishProgress((prev) => {
          if (prev >= 85) return prev;
          return prev + Math.floor(Math.random() * 8) + 4;
        });
      }, 1200);

      const res = await fetch('/api/instagram/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clipId: clip.id,
          jobId,
          caption,
          shareToFeed,
        }),
      });

      clearInterval(progTimer);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to publish Reel to Instagram');
      }

      setPublishProgress(100);
      setPublishStep('Reel successfully published!');
      setPublishedUrl(data.permalink);
      onPublished?.(data.permalink);
    } catch (err: any) {
      setPublishError(err.message || 'Error occurred while publishing Reel');
    } finally {
      setPublishing(false);
    }
  };

  const handleCopyLink = () => {
    if (!publishedUrl) return;
    navigator.clipboard.writeText(publishedUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#0D1017] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-[#121622]/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] flex items-center justify-center shadow-lg shadow-[#dc2743]/20">
              <Instagram className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Publish to Instagram Reels
              </h2>
              <p className="text-xs text-stone-400">
                Post this viral vertical short directly to your Instagram profile
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {/* Account Connection Status Banner */}
          {loadingStatus ? (
            <div className="flex items-center gap-2 text-xs text-stone-400 py-3 px-4 bg-white/[0.02] rounded-xl border border-white/[0.06]">
              <Loader2 className="w-4 h-4 animate-spin text-brand" />
              <span>Checking Instagram account connection...</span>
            </div>
          ) : status?.isConnected ? (
            <div className="flex items-center justify-between p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <div className="flex items-center gap-3">
                {status.avatar ? (
                  <img
                    src={status.avatar}
                    alt={status.username || 'IG'}
                    className="w-9 h-9 rounded-full border border-emerald-500/40 object-cover"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-sm">
                    IG
                  </div>
                )}
                <div>
                  <div className="text-sm font-semibold text-white flex items-center gap-1.5">
                    <span>@{status.username}</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-medium">
                      Connected
                    </span>
                  </div>
                  {status.pageName && (
                    <div className="text-xs text-stone-400">Page: {status.pageName}</div>
                  )}
                </div>
              </div>
              <button
                onClick={handleConnect}
                className="text-xs text-stone-400 hover:text-white underline transition-colors"
              >
                Switch Account
              </button>
            </div>
          ) : (
            <div className="p-4 bg-gradient-to-r from-[#dc2743]/10 to-[#bc1888]/10 border border-[#dc2743]/30 rounded-xl space-y-3.5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-[#f09433] shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-white">Instagram Not Connected</h4>
                  <p className="text-xs text-stone-300 mt-1 leading-relaxed">
                    Connect your Instagram Professional account to publish vertical Reels directly from PeakCut Studio with one click.
                  </p>
                </div>
              </div>

              {/* Instant Token Paste */}
              <div className="p-3 bg-black/40 border border-white/[0.08] rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-white">
                    Paste Graph API Explorer Access Token:
                  </span>
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded font-medium">
                    Fastest
                  </span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={directToken}
                    onChange={(e) => setDirectToken(e.target.value)}
                    placeholder="EAA..."
                    className="flex-1 bg-[#141824] border border-white/[0.08] focus:border-[#dc2743] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-stone-600 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleDirectTokenConnect}
                    disabled={submittingToken || !directToken.trim()}
                    className="px-3 py-1.5 bg-gradient-to-r from-[#f09433] via-[#dc2743] to-[#bc1888] hover:opacity-95 disabled:opacity-40 text-white font-bold text-xs rounded-lg transition-all shrink-0 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {submittingToken ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Link Account'}
                  </button>
                </div>
              </div>

              <div className="relative flex py-0.5 items-center">
                <div className="flex-grow border-t border-white/[0.06]"></div>
                <span className="flex-shrink mx-2 text-[10px] text-stone-500 uppercase tracking-wider">or</span>
                <div className="flex-grow border-t border-white/[0.06]"></div>
              </div>

              <button
                onClick={handleConnect}
                className="w-full py-2.5 px-4 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Instagram className="w-4 h-4 text-[#dc2743]" />
                <span>Authorize with Meta App (OAuth)</span>
              </button>
            </div>
          )}

          {/* Success Screen */}
          {publishedUrl && (
            <div className="p-5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-center space-y-4 animate-in zoom-in-95 duration-200">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto text-emerald-400">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Reel Published to Instagram!</h3>
                <p className="text-xs text-stone-400 mt-1">
                  Your vertical video is live and processing on your Instagram profile.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <a
                  href={publishedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-[#f09433] via-[#dc2743] to-[#bc1888] hover:opacity-95 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-[#dc2743]/20 transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>View Reel on Instagram</span>
                </a>
                <button
                  onClick={handleCopyLink}
                  className="w-full sm:w-auto px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
                  <span>{copiedLink ? 'Copied URL!' : 'Copy Reel Link'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Progress / Publishing State */}
          {publishing && (
            <div className="p-4 bg-[#141824] border border-white/10 rounded-xl space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-stone-300 font-medium flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#dc2743]" />
                  {publishStep || 'Publishing Reel...'}
                </span>
                <span className="font-mono font-bold text-white">{publishProgress}%</span>
              </div>
              <div className="w-full bg-black/40 h-2 rounded-full overflow-hidden border border-white/5">
                <div
                  className="h-full bg-gradient-to-r from-[#f09433] via-[#dc2743] to-[#bc1888] transition-all duration-300"
                  style={{ width: `${publishProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Message */}
          {publishError && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-2.5 text-xs text-rose-300">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{publishError}</div>
            </div>
          )}

          {/* Reel Caption & Options Editor */}
          {!publishedUrl && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1.5 flex items-center justify-between">
                  <span>Reel Caption & Hashtags</span>
                  <span className="text-[11px] font-normal text-stone-500">
                    {caption.length} / 2,200 chars
                  </span>
                </label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={6}
                  className="w-full px-3.5 py-2.5 bg-[#090B10] border border-white/10 rounded-xl text-xs text-white placeholder-stone-600 focus:outline-none focus:border-[#dc2743] transition-colors leading-relaxed resize-none"
                  placeholder="Write a catchy caption with hashtags for your reel..."
                />
              </div>

              {/* Feed Grid toggle */}
              <label className="flex items-center gap-3 p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl cursor-pointer hover:bg-white/[0.04] transition-colors">
                <input
                  type="checkbox"
                  checked={shareToFeed}
                  onChange={(e) => setShareToFeed(e.target.checked)}
                  className="rounded border-white/20 text-[#dc2743] focus:ring-0 bg-black/40 w-4 h-4"
                />
                <div className="flex-1 text-xs">
                  <div className="text-white font-medium">Share to Profile Grid & Feed</div>
                  <div className="text-stone-400 text-[11px]">
                    Display this Reel on both your main Instagram feed grid and the Reels tab
                  </div>
                </div>
              </label>

              {/* Clip Details Info */}
              <div className="p-3 bg-black/40 border border-white/[0.04] rounded-xl flex items-center justify-between text-xs text-stone-400">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">{clip.duration}s</span>
                  <span>·</span>
                  <span>9:16 Vertical</span>
                  <span>·</span>
                  <span className="capitalize">{clip.style || 'Subtitled'}</span>
                </div>
                <div className="font-mono text-stone-500 text-[11px]">{clip.id}</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.08] bg-[#121622]/60">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-stone-400 hover:text-white transition-colors"
          >
            {publishedUrl ? 'Close' : 'Cancel'}
          </button>
          {!publishedUrl && (
            <button
              onClick={handlePublish}
              disabled={publishing || !status?.isConnected}
              className="px-5 py-2.5 bg-gradient-to-r from-[#f09433] via-[#dc2743] to-[#bc1888] hover:opacity-95 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-[#dc2743]/20 flex items-center gap-2 transition-all disabled:cursor-not-allowed"
            >
              {publishing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Publishing...</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>Publish Reel Now</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
