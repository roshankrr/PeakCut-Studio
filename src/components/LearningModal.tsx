'use client';

import React, { useState, useEffect } from 'react';
import { X, Brain, ThumbsUp, ThumbsDown, ShieldCheck, Sparkles, RefreshCw } from 'lucide-react';
import { LearningMemory } from '@/lib/types';

interface LearningModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LearningModal({ isOpen, onClose }: LearningModalProps) {
  const [memory, setMemory] = useState<LearningMemory | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadMemory();
    }
  }, [isOpen]);

  async function loadMemory() {
    setLoading(true);
    try {
      const res = await fetch('/api/feedback');
      const data = await res.json();
      if (data.memory) {
        setMemory(data.memory);
      }
    } catch (err) {
      console.error('Failed loading learning memory:', err);
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#0E1118] border border-white/[0.1] rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand/15 border border-brand/30 flex items-center justify-center text-brand">
              <Brain className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-white font-bold text-sm">Self-Improving AI Engine</h3>
              <p className="text-[11px] text-stone-400">Learns from your Likes &amp; Dislikes with every clip</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/[0.06] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-[#141824] border border-white/[0.08] text-center">
              <div className="flex items-center justify-center gap-1 text-emerald-400 text-xs font-semibold mb-1">
                <ThumbsUp className="w-3.5 h-3.5" />
                <span>Likes</span>
              </div>
              <p className="text-xl font-bold font-mono text-white">{memory?.totalLikes ?? 0}</p>
            </div>
            <div className="p-3 rounded-xl bg-[#141824] border border-white/[0.08] text-center">
              <div className="flex items-center justify-center gap-1 text-rose-400 text-xs font-semibold mb-1">
                <ThumbsDown className="w-3.5 h-3.5" />
                <span>Dislikes</span>
              </div>
              <p className="text-xl font-bold font-mono text-white">{memory?.totalDislikes ?? 0}</p>
            </div>
            <div className="p-3 rounded-xl bg-[#141824] border border-white/[0.08] text-center">
              <div className="flex items-center justify-center gap-1 text-brand text-xs font-semibold mb-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Active Rules</span>
              </div>
              <p className="text-xl font-bold font-mono text-white">
                {memory?.learnedRules?.length ?? 0}
              </p>
            </div>
          </div>

          {/* Persistent storage note */}
          <div className="p-3.5 rounded-xl bg-brand/5 border border-brand/20 flex items-start gap-2.5 text-xs text-stone-300">
            <ShieldCheck className="w-4 h-4 text-brand shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Persistent Memory:</strong> Your learned prompt rules are preserved safely in{' '}
              <code className="text-brand font-mono text-[11px]">storage/learning_memory.json</code>.
              Clearing storage will <strong>never</strong> erase what the AI has learned!
            </p>
          </div>

          {/* Dynamic Lessons from Dislikes */}
          {memory?.promptAdditions && memory.promptAdditions.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-300 flex items-center gap-1.5">
                <ThumbsDown className="w-3.5 h-3.5 text-rose-400" />
                <span>Lessons Learned from Dislikes (Injected in System Prompt)</span>
              </h4>
              <div className="space-y-1.5">
                {memory.promptAdditions.map((addition, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-200 text-xs leading-relaxed"
                  >
                    {addition}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Rules List */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-300 flex items-center gap-1.5">
              <Brain className="w-3.5 h-3.5 text-brand" />
              <span>Active System Prompt Constraints</span>
            </h4>
            <div className="space-y-2">
              {memory?.learnedRules.map((rule, idx) => (
                <div
                  key={rule.id || idx}
                  className="p-3 rounded-xl bg-[#141824] border border-white/[0.08] space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between text-[10px] text-stone-400">
                    <span className="font-mono uppercase font-bold text-brand">
                      {rule.category.replace('_', ' ')}
                    </span>
                    <span className="bg-white/[0.05] px-1.5 py-0.5 rounded border border-white/[0.08]">
                      Weight: {rule.weight}
                    </span>
                  </div>
                  <p className="text-stone-200 font-medium leading-relaxed">{rule.rule}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/[0.08] flex items-center justify-between bg-[#141824]/50">
          <button
            type="button"
            onClick={loadMemory}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-white transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Rules</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.14] text-xs font-bold text-white transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
