'use client';

import React, { useState } from 'react';
import { Settings, Scissors, Trash2, CheckCircle2, ShieldCheck, Brain } from 'lucide-react';

interface NavbarProps {
  onOpenSettings: () => void;
  onOpenLearning?: () => void;
  hasApiKey: boolean;
  onStorageCleared?: () => void;
}

export default function Navbar({ onOpenSettings, onOpenLearning, hasApiKey, onStorageCleared }: NavbarProps) {
  const [clearing, setClearing] = useState(false);
  const [clearedNotice, setClearedNotice] = useState(false);

  async function handleClearStorage() {
    const ok = window.confirm(
      'Clean temporary storage? This clears downloaded audio, source video slices, and cached render files.'
    );
    if (!ok) return;

    setClearing(true);
    try {
      const res = await fetch('/api/storage', { method: 'DELETE' });
      if (res.ok) {
        setClearedNotice(true);
        onStorageCleared?.();
        setTimeout(() => setClearedNotice(false), 3000);
      }
    } catch (err) {
      console.error('Failed to clear storage:', err);
    } finally {
      setClearing(false);
    }
  }

  return (
    <header className="sticky top-0 z-40 bg-[#080A0F]/80 backdrop-blur-xl border-b border-white/[0.08]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center text-[#080A0F] font-bold shadow-lg shadow-brand/20 transition-transform hover:scale-105 active:scale-95">
            <Scissors className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-lg font-bold tracking-tight text-white font-sans">
              PeakCut<span className="text-brand">.</span>
            </span>
            <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-md bg-white/[0.06] text-stone-300 border border-white/[0.08]">
              Studio 2.5
            </span>
          </div>
        </div>

        {/* Status & Actions */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Engine indicator */}
          <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.08] text-[11px] text-stone-300">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-medium text-stone-300">Local Engine Active</span>
            <span className="text-stone-500">·</span>
            <span className="text-stone-400">100% Free</span>
          </div>

          {/* Clear Storage Button */}
          <button
            onClick={handleClearStorage}
            disabled={clearing}
            title="Clean cached stream audio, video slices, and rendered files"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.03] hover:bg-red-500/10 hover:border-red-500/30 text-stone-400 hover:text-red-400 border border-white/[0.08] transition-all active:scale-[0.98]"
          >
            {clearedNotice ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-semibold">Cleaned</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{clearing ? 'Cleaning...' : 'Clear Storage'}</span>
              </>
            )}
          </button>

          {/* AI Self-Improvement Memory Button */}
          {onOpenLearning && (
            <button
              onClick={onOpenLearning}
              title="View self-improving AI prompt rules and feedback memory"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/[0.03] hover:bg-brand/10 hover:border-brand/40 text-stone-300 hover:text-brand border border-white/[0.08] transition-all cursor-pointer"
            >
              <Brain className="w-3.5 h-3.5 text-brand" />
              <span className="hidden sm:inline">AI Memory</span>
            </button>
          )}

          {/* Settings Button */}
          <button
            onClick={onOpenSettings}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-[0.98] ${
              hasApiKey
                ? 'bg-white/[0.05] hover:bg-white/[0.1] text-stone-200 border border-white/[0.1]'
                : 'btn-primary'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>{hasApiKey ? 'Settings' : 'Set Free API Key'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
