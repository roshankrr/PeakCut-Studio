'use client';

import React, { useState } from 'react';
import {
  Download,
  Copy,
  Check,
  Flame,
  Clock,
  PencilLine,
  Sparkles,
  Youtube,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  Brain,
  Award,
  Instagram,
} from 'lucide-react';
import { Clip } from '@/lib/types';
import EditModePanel from './EditModePanel';
import YouTubePublishModal from './YouTubePublishModal';
import InstagramPublishModal from './InstagramPublishModal';

interface ClipCardProps {
  clip: Clip;
  jobId: string;
  sourceTitle?: string;
  sourceUrl?: string;
}

export default function ClipCard({ clip: initialClip, jobId, sourceTitle, sourceUrl }: ClipCardProps) {
  const [clip, setClip] = useState<Clip>(initialClip);
  const [copied, setCopied] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [instagramPublishOpen, setInstagramPublishOpen] = useState(false);
  const [feedback, setFeedback] = useState<'like' | 'dislike' | null>(initialClip.feedback || null);
  const [feedbackMsg, setFeedbackMsg] = useState<string>('');
  const [showDislikeMenu, setShowDislikeMenu] = useState(false);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  async function handleSendFeedback(type: 'like' | 'dislike', note?: string) {
    setSubmittingFeedback(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clipId: clip.id,
          jobId,
          type,
          userPrompt: clip.hook,
          clipTitle: clip.title,
          clipHook: clip.hook,
          reason: clip.description,
          userNote: note,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback(type);
        setShowDislikeMenu(false);
        setFeedbackMsg(
          type === 'like'
            ? '🧠 Liked! AI learned this positive context pattern.'
            : '🧠 Disliked! AI updated system prompt constraints.'
        );
        setClip((prev) => ({ ...prev, feedback: type, feedbackNote: note }));
        setTimeout(() => setFeedbackMsg(''), 4500);
      }
    } catch (err) {
      console.error('Failed submitting feedback:', err);
    } finally {
      setSubmittingFeedback(false);
    }
  }

  function handleCopyText() {
    const text = `${clip.title}\n\n${clip.description}\n\n${clip.hashtags.join(' ')}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <div className="bg-[#0E1118] border border-white/[0.08] rounded-2xl overflow-hidden shadow-2xl flex flex-col card-lift group hover:border-brand/40 transition-all duration-200">
        {/* 9:16 Video Container */}
        <div className="relative aspect-[9/16] bg-[#050608] overflow-hidden flex items-center justify-center">
          <video
            key={clip.publicUrl}
            src={clip.publicUrl}
            controls
            playsInline
            preload="metadata"
            className="w-full h-full object-cover"
          />

          {/* Viral Score Badge */}
          <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#080A0F]/90 backdrop-blur-md border border-brand/40 text-brand text-[11px] font-bold shadow-lg">
            <Flame className="w-3.5 h-3.5 fill-brand" />
            <span>{clip.score}/100</span>
          </div>

          {/* Requested Scene Badge */}
          {clip.matchedUserPrompt && (
            <div className="absolute top-12 left-3 z-10 flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-brand to-amber-400 text-[#080A0F] text-[10px] font-black uppercase tracking-wider shadow-lg shadow-brand/30 border border-brand/50">
              <Sparkles className="w-3 h-3 fill-current" />
              <span>Requested Scene</span>
            </div>
          )}

          {/* Duration Badge */}
          <div className="absolute top-3 right-3 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#080A0F]/80 backdrop-blur-md text-stone-300 text-[10px] font-mono font-medium border border-white/[0.08]">
            <Clock className="w-3 h-3 text-stone-400" />
            <span>{clip.duration.toFixed(0)}s</span>
          </div>

          {/* Fast Edit Trigger floating pill */}
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            title="Open Studio Editor"
            className="absolute top-12 right-3 z-10 px-2.5 py-1 rounded-full bg-brand/90 hover:bg-brand text-[#080A0F] font-bold text-[10px] uppercase tracking-wider shadow-lg shadow-brand/20 backdrop-blur-md flex items-center gap-1 cursor-pointer transition-all hover:scale-105 active:scale-95"
          >
            <PencilLine className="w-3 h-3" />
            <span>Edit</span>
          </button>
        </div>

        {/* Info & Actions */}
        <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              {clip.partNumber && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/[0.08] text-brand border border-brand/30 inline-flex items-center gap-1 font-mono">
                  Part {clip.partNumber} {clip.chunkRange ? `(${clip.chunkRange})` : ''}
                </span>
              )}

              {clip.matchedUserPrompt && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-brand/15 text-brand border border-brand/30 inline-flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Matched Your Comment
                </span>
              )}

              {clip.logoOverlay && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 inline-flex items-center gap-1 font-mono">
                  <Award className="w-3 h-3 text-amber-400" /> Logo ({clip.logoOverlay.position})
                </span>
              )}

              {/* Hook Badge */}
              {clip.hook && (
                <span className="text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-md bg-white/[0.05] text-stone-300 border border-white/[0.08] line-clamp-1 inline-block">
                  Hook: {clip.hook}
                </span>
              )}
            </div>

            <h4 className="text-sm font-bold text-white line-clamp-1">{clip.title}</h4>
            <p className="text-xs text-stone-400 mt-1 line-clamp-2 leading-relaxed">{clip.description}</p>

            <div className="flex flex-wrap gap-1 mt-3">
              {clip.hashtags.slice(0, 3).map((tag, idx) => (
                <span key={idx} className="text-[10px] text-stone-500 font-mono">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-2 border-t border-white/[0.06]">
            {/* Social 1-Click Publish Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* YouTube Shorts Button */}
              {clip.youtubeUrl ? (
                <a
                  href={clip.youtubeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-xs font-bold transition-all cursor-pointer active:scale-98"
                >
                  <Youtube className="w-3.5 h-3.5 fill-emerald-400 stroke-0 shrink-0" />
                  <span className="truncate">Live on YouTube</span>
                  <ExternalLink className="w-3 h-3 opacity-70 shrink-0" />
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => setPublishOpen(true)}
                  className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg bg-red-600/15 hover:bg-red-600/25 border border-red-500/40 text-red-400 hover:text-red-300 text-xs font-bold transition-all cursor-pointer active:scale-98 shadow-sm"
                >
                  <Youtube className="w-3.5 h-3.5 fill-current stroke-0 shrink-0" />
                  <span className="truncate">YouTube Shorts</span>
                </button>
              )}

              {/* Instagram Reels Button */}
              {clip.instagramUrl ? (
                <a
                  href={clip.instagramUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg bg-gradient-to-r from-[#f09433]/20 via-[#dc2743]/20 to-[#bc1888]/20 hover:opacity-90 border border-[#dc2743]/40 text-[#f43f5e] text-xs font-bold transition-all cursor-pointer active:scale-98"
                >
                  <Instagram className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Live on Reel</span>
                  <ExternalLink className="w-3 h-3 opacity-70 shrink-0" />
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => setInstagramPublishOpen(true)}
                  className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg bg-gradient-to-r from-[#f09433]/15 via-[#dc2743]/15 to-[#bc1888]/15 hover:from-[#f09433]/25 hover:via-[#dc2743]/25 hover:to-[#bc1888]/25 border border-[#dc2743]/40 text-[#f43f5e] hover:text-white text-xs font-bold transition-all cursor-pointer active:scale-98 shadow-sm"
                >
                  <Instagram className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Instagram Reel</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleCopyText}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-semibold text-stone-300 transition-all cursor-pointer active:scale-98"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-stone-400" />
                    <span>Copy Text</span>
                  </>
                )}
              </button>

              <a
                href={clip.publicUrl}
                download={`${clip.title.replace(/[^a-zA-Z0-9]/g, '_')}.mp4`}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-stone-200 text-xs font-bold transition-all cursor-pointer active:scale-98"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Save MP4</span>
              </a>
            </div>

            {/* Studio Editor Button */}
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-brand/10 hover:bg-brand/20 border border-brand/30 text-brand text-xs font-bold transition-all cursor-pointer active:scale-98"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Studio Editor (Crop, Text, Subtitles, Trim)</span>
            </button>

            {/* AI Learning & Self-Improvement Review Bar */}
            <div className="pt-2 border-t border-white/[0.06] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-stone-400 flex items-center gap-1 font-medium">
                  <Brain className="w-3.5 h-3.5 text-brand" />
                  <span>Scene Accuracy:</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleSendFeedback('like')}
                    disabled={submittingFeedback}
                    title="Accurate scene / good cut (Reinforces this pattern)"
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      feedback === 'like'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm'
                        : 'bg-white/[0.03] hover:bg-emerald-500/10 text-stone-400 hover:text-emerald-400 border border-white/[0.08]'
                    }`}
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span>Good</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDislikeMenu(!showDislikeMenu)}
                    disabled={submittingFeedback}
                    title="Wrong scene / missed context (AI will learn from this)"
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      feedback === 'dislike'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-sm'
                        : 'bg-white/[0.03] hover:bg-rose-500/10 text-stone-400 hover:text-rose-400 border border-white/[0.08]'
                    }`}
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                    <span>Wrong Scene</span>
                  </button>
                </div>
              </div>

              {/* Learning notification message */}
              {feedbackMsg && (
                <div className="p-2 rounded-lg bg-brand/10 border border-brand/25 text-brand text-[11px] font-medium leading-relaxed">
                  {feedbackMsg}
                </div>
              )}

              {/* Interactive dislike reason drawer */}
              {showDislikeMenu && (
                <div className="p-2.5 rounded-xl bg-[#141824] border border-rose-500/30 space-y-2 text-xs">
                  <p className="text-[11px] text-stone-300 font-medium">
                    What was wrong? (AI updates its system prompt):
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {[
                      'Caught only 1 word, missed context',
                      'Wrong topic completely',
                      'Cut started too early / too late',
                      'Missed the punchline / reaction',
                    ].map((reason) => (
                      <button
                        key={reason}
                        type="button"
                        onClick={() => handleSendFeedback('dislike', reason)}
                        className="px-2 py-1 rounded-md bg-white/[0.04] hover:bg-rose-500/15 hover:text-rose-300 border border-white/[0.08] text-[10px] text-stone-300 transition-colors text-left cursor-pointer"
                      >
                        ✕ {reason}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Mode Panel */}
      {editOpen && (
        <EditModePanel
          clip={clip}
          jobId={jobId}
          onClose={() => setEditOpen(false)}
          onClipUpdated={(updated) => setClip(updated)}
        />
      )}

      {/* YouTube Publish Modal */}
      {publishOpen && (
        <YouTubePublishModal
          clip={clip}
          jobId={jobId}
          sourceTitle={sourceTitle}
          sourceUrl={sourceUrl}
          onClose={() => setPublishOpen(false)}
          onPublished={(url) => setClip((prev) => ({ ...prev, youtubeUrl: url }))}
        />
      )}

      {/* Instagram Reels Publish Modal */}
      {instagramPublishOpen && (
        <InstagramPublishModal
          clip={clip}
          jobId={jobId}
          sourceTitle={sourceTitle}
          sourceUrl={sourceUrl}
          onClose={() => setInstagramPublishOpen(false)}
          onPublished={(permalink) => setClip((prev) => ({ ...prev, instagramUrl: permalink }))}
        />
      )}
    </>
  );
}
