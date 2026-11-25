'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Key,
  Check,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Youtube,
  Instagram,
  Trash2,
  Loader2,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

interface YouTubeStatus {
  hasCredentials: boolean;
  isConnected: boolean;
  channelTitle?: string | null;
  channelCustomUrl?: string | null;
  channelAvatar?: string | null;
}

interface InstagramStatus {
  hasCredentials: boolean;
  isConnected: boolean;
  username?: string | null;
  avatar?: string | null;
  pageName?: string | null;
}

export default function SettingsModal({ isOpen, onClose, onSaved }: SettingsModalProps) {
  const [groqKey, setGroqKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [instagramAppId, setInstagramAppId] = useState('');
  const [instagramAppSecret, setInstagramAppSecret] = useState('');
  const [directTokenInput, setDirectTokenInput] = useState('');
  const [submittingDirectToken, setSubmittingDirectToken] = useState(false);
  const [directTokenError, setDirectTokenError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [hasExistingGroq, setHasExistingGroq] = useState(false);
  const [hasExistingGemini, setHasExistingGemini] = useState(false);
  const [hasExistingIgId, setHasExistingIgId] = useState(false);
  const [hasExistingIgSecret, setHasExistingIgSecret] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const [ytStatus, setYtStatus] = useState<YouTubeStatus | null>(null);
  const [ytLoading, setYtLoading] = useState(false);

  const [igStatus, setIgStatus] = useState<InstagramStatus | null>(null);
  const [igLoading, setIgLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setGroqKey('');
      setGeminiKey('');
      setInstagramAppId('');
      setInstagramAppSecret('');
      fetch('/api/settings')
        .then((r) => r.json())
        .then((data) => {
          setHasExistingGroq(data.hasGroqKey);
          setHasExistingGemini(data.hasGeminiKey);
          setHasExistingIgId(data.hasInstagramAppId);
          setHasExistingIgSecret(data.hasInstagramAppSecret);
        })
        .catch(console.error);

      fetchYouTubeStatus();
      fetchInstagramStatus();
    }

    function handleMessage(e: MessageEvent) {
      if (e.data?.type === 'YOUTUBE_AUTH_SUCCESS') {
        fetchYouTubeStatus();
      }
      if (e.data?.type === 'INSTAGRAM_AUTH_SUCCESS') {
        fetchInstagramStatus();
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isOpen]);

  async function fetchYouTubeStatus() {
    setYtLoading(true);
    try {
      const res = await fetch('/api/auth/youtube/status');
      const data = await res.json();
      setYtStatus(data);
    } catch (err) {
      console.error('Failed to fetch YouTube status:', err);
    } finally {
      setYtLoading(false);
    }
  }

  async function fetchInstagramStatus() {
    setIgLoading(true);
    try {
      const res = await fetch('/api/auth/instagram/status');
      const data = await res.json();
      setIgStatus(data);
    } catch (err) {
      console.error('Failed to fetch Instagram status:', err);
    } finally {
      setIgLoading(false);
    }
  }

  async function handleConnectYouTube() {
    try {
      const res = await fetch('/api/auth/youtube/url');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to get YouTube auth URL');

      const width = 520;
      const height = 650;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      window.open(
        data.url,
        'YouTubeAuth',
        `width=${width},height=${height},left=${left},top=${top},status=no,menubar=no`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg);
    }
  }

  async function handleDisconnectYouTube() {
    if (!window.confirm('Disconnect your YouTube channel?')) return;
    try {
      await fetch('/api/auth/youtube/status', { method: 'DELETE' });
      fetchYouTubeStatus();
    } catch (err) {
      console.error('Failed to disconnect YouTube:', err);
    }
  }

  async function handleConnectInstagram() {
    try {
      const res = await fetch('/api/auth/instagram/url');
      const data = await res.json();
      if (!data.configured) {
        alert('Please save your Meta App ID and App Secret below first before authorizing.');
        return;
      }
      if (data.authUrl) {
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;

        window.open(
          data.authUrl,
          'InstagramAuth',
          `width=${width},height=${height},left=${left},top=${top},status=no,menubar=no`
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg);
    }
  }

  async function handleConnectWithDirectToken() {
    if (!directTokenInput.trim()) return;
    setSubmittingDirectToken(true);
    setDirectTokenError(null);
    try {
      const res = await fetch('/api/auth/instagram/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: directTokenInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to connect Instagram account');

      setDirectTokenInput('');
      fetchInstagramStatus();
    } catch (err: any) {
      setDirectTokenError(err.message || 'Failed to connect Instagram account');
    } finally {
      setSubmittingDirectToken(false);
    }
  }

  async function handleDisconnectInstagram() {
    if (!window.confirm('Disconnect your Instagram account?')) return;
    try {
      await fetch('/api/auth/instagram/status', { method: 'DELETE' });
      fetchInstagramStatus();
    } catch (err) {
      console.error('Failed to disconnect Instagram:', err);
    }
  }

  if (!isOpen) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groqApiKey: groqKey.trim() || undefined,
          geminiApiKey: geminiKey.trim() || undefined,
          instagramAppId: instagramAppId.trim() || undefined,
          instagramAppSecret: instagramAppSecret.trim() || undefined,
        }),
      });

      if (res.ok) {
        setSavedSuccess(true);
        setTimeout(() => {
          setSavedSuccess(false);
          onSaved();
          onClose();
        }, 800);
      }
    } finally {
      setLoading(false);
    }
  }

  const hasFormChanges = Boolean(
    groqKey.trim() || geminiKey.trim() || instagramAppId.trim() || instagramAppSecret.trim()
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-[#0E1118] border border-white/[0.1] rounded-2xl w-full max-w-lg p-6 sm:p-7 shadow-2xl relative max-h-[92vh] overflow-y-auto custom-scrollbar">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-stone-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-brand/15 border border-brand/30 flex items-center justify-center text-brand">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Studio Configuration</h3>
            <p className="text-xs text-stone-400 mt-0.5">
              Saved strictly on the local backend server. Never returned or leaked to the client.
            </p>
          </div>
        </div>

        {/* ── Social Publishing Integrations ─────────────────────────── */}
        <div className="space-y-3 mb-6">
          {/* YouTube Section */}
          <div className="p-4 rounded-xl bg-[#141824] border border-white/[0.08] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Youtube className="w-4 h-4 text-red-500 fill-red-500 stroke-0" />
                <span className="text-xs font-bold uppercase tracking-wider text-white">
                  YouTube Shorts Publishing
                </span>
              </div>
              {ytStatus?.isConnected ? (
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 font-semibold">
                  <CheckCircle2 className="w-3 h-3" /> Channel Linked
                </span>
              ) : null}
            </div>

            {ytLoading ? (
              <div className="flex items-center gap-2 text-xs text-stone-400 py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-brand" />
                <span>Checking YouTube connection...</span>
              </div>
            ) : ytStatus?.isConnected ? (
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2.5">
                  {ytStatus.channelAvatar ? (
                    <img
                      src={ytStatus.channelAvatar}
                      alt={ytStatus.channelTitle || 'Channel'}
                      className="w-8 h-8 rounded-full border border-red-500/40 object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center text-red-500 text-xs font-bold">
                      YT
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-bold text-white leading-none">{ytStatus.channelTitle}</p>
                    <p className="text-[10px] text-stone-400 mt-1">
                      {ytStatus.channelCustomUrl || 'Authorized for 1-click publishing'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDisconnectYouTube}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-stone-400 hover:text-rose-400 hover:bg-rose-500/10 border border-white/[0.08] transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Disconnect</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2 pt-1">
                <p className="text-xs text-stone-400 leading-relaxed">
                  Connect your YouTube channel using Google Cloud OAuth credentials to unlock 1-click direct publishing.
                </p>
                <button
                  type="button"
                  onClick={handleConnectYouTube}
                  className="btn-primary w-full py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm font-bold"
                >
                  <Youtube className="w-4 h-4 fill-[#080A0F]" />
                  <span>Authorize &amp; Link YouTube Channel</span>
                </button>
              </div>
            )}
          </div>

          {/* Instagram Reels Section */}
          <div className="p-4 rounded-xl bg-[#141824] border border-white/[0.08] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Instagram className="w-4 h-4 text-[#dc2743]" />
                <span className="text-xs font-bold uppercase tracking-wider text-white">
                  Instagram Reels Publishing
                </span>
              </div>
              {igStatus?.isConnected ? (
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 font-semibold">
                  <CheckCircle2 className="w-3 h-3" /> Connected
                </span>
              ) : hasExistingIgId ? (
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-brand/15 text-brand border border-brand/30 font-semibold">
                  Keys Saved
                </span>
              ) : null}
            </div>

            {igLoading ? (
              <div className="flex items-center gap-2 text-xs text-stone-400 py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#dc2743]" />
                <span>Checking Instagram connection...</span>
              </div>
            ) : igStatus?.isConnected ? (
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2.5">
                  {igStatus.avatar ? (
                    <img
                      src={igStatus.avatar}
                      alt={igStatus.username || 'IG'}
                      className="w-8 h-8 rounded-full border border-[#dc2743]/40 object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#f09433] to-[#bc1888] flex items-center justify-center text-white text-xs font-bold">
                      IG
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-bold text-white leading-none">@{igStatus.username}</p>
                    <p className="text-[10px] text-stone-400 mt-1">
                      {igStatus.pageName ? `Page: ${igStatus.pageName}` : 'Reels publishing enabled'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDisconnectInstagram}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-stone-400 hover:text-rose-400 hover:bg-rose-500/10 border border-white/[0.08] transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Disconnect</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                <p className="text-xs text-stone-400 leading-relaxed">
                  Publish vertical 9:16 Reels directly into Instagram using Meta Graph API with direct binary uploads.
                </p>

                {/* Instant Token Paste */}
                <div className="p-3 bg-black/40 border border-white/[0.08] rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
                      <Key className="w-3 h-3 text-[#dc2743]" />
                      <span>Paste Graph API Explorer Access Token</span>
                    </span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded font-medium">
                      Fastest Setup
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={directTokenInput}
                      onChange={(e) => setDirectTokenInput(e.target.value)}
                      placeholder="EAA..."
                      className="flex-1 bg-[#141824] border border-white/[0.08] focus:border-[#dc2743] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-stone-600 font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleConnectWithDirectToken}
                      disabled={submittingDirectToken || !directTokenInput.trim()}
                      className="px-3 py-1.5 bg-gradient-to-r from-[#f09433] via-[#dc2743] to-[#bc1888] hover:opacity-95 disabled:opacity-40 text-white font-bold text-xs rounded-lg transition-all shrink-0 cursor-pointer disabled:cursor-not-allowed"
                    >
                      {submittingDirectToken ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        'Link Account'
                      )}
                    </button>
                  </div>
                  {directTokenError && (
                    <p className="text-[11px] text-rose-400 leading-snug">{directTokenError}</p>
                  )}
                  <p className="text-[10px] text-stone-500">
                    Paste your User Token from Graph API Explorer to connect instantly without setting up OAuth redirect.
                  </p>
                </div>

                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-white/[0.06]"></div>
                  <span className="flex-shrink mx-2 text-[10px] text-stone-500 uppercase tracking-wider">or OAuth App</span>
                  <div className="flex-grow border-t border-white/[0.06]"></div>
                </div>

                <button
                  type="button"
                  onClick={handleConnectInstagram}
                  className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Instagram className="w-4 h-4 text-[#dc2743]" />
                  <span>Authorize with Meta App (OAuth Popup)</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── API Keys Configuration Form ─────────────────────────────── */}
        <form onSubmit={handleSave} className="space-y-5">
          {/* Groq Key */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-stone-300 uppercase tracking-wider flex items-center gap-2">
                <span>Groq API Key</span>
                {hasExistingGroq ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 font-medium">
                    <CheckCircle2 className="w-3 h-3" /> Configured
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-brand/15 text-brand border border-brand/30">
                    Required
                  </span>
                )}
              </label>
              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-brand hover:underline flex items-center gap-1 font-medium"
              >
                Get Free Key <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <input
              type="password"
              value={groqKey}
              onChange={(e) => setGroqKey(e.target.value)}
              placeholder={hasExistingGroq ? '•••••••••••••••••••••••••••••••• (Leave blank to keep current)' : 'gsk_...'}
              className="w-full bg-[#141824] border border-white/[0.08] focus:border-brand/70 focus:ring-1 focus:ring-brand/30 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-stone-500 transition-colors"
            />
          </div>

          {/* Gemini Key */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-stone-300 uppercase tracking-wider flex items-center gap-2">
                <span>Google Gemini API Key</span>
                {hasExistingGemini && (
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 font-medium">
                    <CheckCircle2 className="w-3 h-3" /> Configured
                  </span>
                )}
              </label>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-brand hover:underline flex items-center gap-1 font-medium"
              >
                Get Free Key <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <input
              type="password"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              placeholder={hasExistingGemini ? '•••••••••••••••••••••••••••••••• (Leave blank to keep current)' : 'AIzaSy... (Optional)'}
              className="w-full bg-[#141824] border border-white/[0.08] focus:border-brand/70 focus:ring-1 focus:ring-brand/30 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-stone-500 transition-colors"
            />
          </div>

          {/* Meta App Credentials for Instagram */}
          <div className="pt-2 border-t border-white/[0.08] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Instagram className="w-3.5 h-3.5 text-[#dc2743]" />
                <span>Meta Developer Credentials (Instagram)</span>
              </span>
              <a
                href="https://developers.facebook.com/apps"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-[#dc2743] hover:underline flex items-center gap-1 font-medium"
              >
                Meta App Dashboard <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-stone-400">Meta App ID</span>
                  {hasExistingIgId && (
                    <span className="text-[9px] text-emerald-400 font-medium">Saved</span>
                  )}
                </div>
                <input
                  type="text"
                  value={instagramAppId}
                  onChange={(e) => setInstagramAppId(e.target.value)}
                  placeholder={hasExistingIgId ? '•••••••••••• (Saved)' : 'e.g. 18492049182...'}
                  className="w-full bg-[#141824] border border-white/[0.08] focus:border-[#dc2743] focus:ring-1 focus:ring-[#dc2743]/30 rounded-xl px-3 py-2 text-xs text-white placeholder-stone-500 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-stone-400">Meta App Secret</span>
                  {hasExistingIgSecret && (
                    <span className="text-[9px] text-emerald-400 font-medium">Saved</span>
                  )}
                </div>
                <input
                  type="password"
                  value={instagramAppSecret}
                  onChange={(e) => setInstagramAppSecret(e.target.value)}
                  placeholder={hasExistingIgSecret ? '•••••••••••• (Saved)' : 'App secret from Basic Settings'}
                  className="w-full bg-[#141824] border border-white/[0.08] focus:border-[#dc2743] focus:ring-1 focus:ring-[#dc2743]/30 rounded-xl px-3 py-2 text-xs text-white placeholder-stone-500 transition-colors"
                />
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#141824] border border-white/[0.08] flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs text-stone-300 space-y-0.5">
              <p className="font-semibold text-white">Local Storage &amp; Zero Exposure</p>
              <p className="text-stone-400 text-[11px] leading-relaxed">
                Stored locally in <code className="text-stone-300">storage/settings.json</code>. Requests execute entirely on your backend; credentials are never transmitted to browser clients.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-400 hover:text-white transition-colors"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={loading || !hasFormChanges}
              className="btn-primary px-5 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4" /> Saved
                </>
              ) : (
                'Save Settings'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
