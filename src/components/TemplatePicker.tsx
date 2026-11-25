'use client';

import React from 'react';
import { Zap, Swords, Gamepad2, FastForward, Award } from 'lucide-react';
import { TemplateId } from '@/lib/types';

interface Template {
  id: TemplateId;
  icon: React.ElementType;
  badge: string;
  title: string;
  subtitle: string;
  description: string;
}

const TEMPLATES: Template[] = [
  {
    id: 'viral-clipper',
    icon: Zap,
    badge: 'Auto Highlights',
    title: 'Viral Clipper',
    subtitle: 'Stream to Vertical Shorts',
    description:
      'Analyzes chat replay heatmaps and audio energy across 1–3 hr VODs to extract the top 3 moments with dynamic word captions.',
  },
  {
    id: 'versus-comparison',
    icon: Swords,
    badge: 'Dual Video',
    title: 'Versus Studio',
    subtitle: 'Stacked Alternating Focus',
    description:
      'Splits two versions vertically with automatic freeze & black-and-white blur when the other is speaking. Built for game evolutions and remakes.',
  },
  {
    id: 'gaming-split',
    icon: Gamepad2,
    badge: 'Wide Action',
    title: 'Gaming Studio',
    subtitle: '9:14 Stream Composition',
    description:
      'Preserves streamer facecam and core gameplay simultaneously in a balanced 9:14 vertical format without cutting into room or UI.',
  },
  {
    id: 'stream-stepper',
    icon: FastForward,
    badge: '4-6h Long VODs',
    title: 'Stream Stepper',
    subtitle: 'Chunk-by-Chunk Long Clipper',
    description:
      'For 3–6+ hour VODs & podcasts. Clips 20-30m chunks on demand without downloading the full massive file. Review Part 1, then click Next Chunk!',
  },
  {
    id: 'brand-campaign',
    icon: Award,
    badge: 'Campaign & Sponsor',
    title: 'Campaign Studio',
    subtitle: 'Logo Watermark & Brand Placement',
    description:
      'Upload your sponsor or brand logo and place it anywhere on your vertical clips (bottom-left, bottom-right, corners, or custom coordinates).',
  },
];

interface TemplatePickerProps {
  selected: TemplateId;
  onChange: (id: TemplateId) => void;
}

export default function TemplatePicker({ selected, onChange }: TemplatePickerProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold tracking-wider uppercase text-stone-400">
          Select Template Format
        </span>
        <span className="text-[11px] text-stone-500 font-mono">
          {TEMPLATES.findIndex((t) => t.id === selected) + 1} / {TEMPLATES.length}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {TEMPLATES.map((tpl) => {
          const Icon = tpl.icon;
          const isSelected = selected === tpl.id;

          return (
            <button
              key={tpl.id}
              type="button"
              onClick={() => onChange(tpl.id)}
              className={`relative text-left p-4 rounded-xl border transition-all card-lift cursor-pointer ${
                isSelected
                  ? 'bg-gradient-to-b from-brand/[0.08] to-transparent border-brand/60 shadow-[0_0_24px_-6px_rgba(255,107,0,0.25)]'
                  : 'bg-[#0E1118] border-white/[0.08] hover:border-white/[0.18] hover:bg-[#141824]'
              }`}
            >
              {/* Selected indicator dot */}
              {isSelected && (
                <div className="absolute top-3 right-3 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand shadow-[0_0_8px_#FF6B00]" />
                </div>
              )}

              {/* Icon & Badge */}
              <div className="flex items-center gap-2 mb-3">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    isSelected
                      ? 'bg-brand/20 text-brand'
                      : 'bg-white/[0.05] text-stone-400 group-hover:text-stone-200'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                    isSelected
                      ? 'bg-brand/15 text-brand border border-brand/30'
                      : 'bg-white/[0.04] text-stone-400 border border-white/[0.06]'
                  }`}
                >
                  {tpl.badge}
                </span>
              </div>

              {/* Title & Copy */}
              <h4 className={`text-sm font-bold tracking-tight mb-0.5 ${isSelected ? 'text-white' : 'text-stone-200'}`}>
                {tpl.title}
              </h4>
              <p className="text-[11px] text-stone-400 font-medium mb-2">{tpl.subtitle}</p>
              <p className="text-[11px] text-stone-400 leading-relaxed line-clamp-3">
                {tpl.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
