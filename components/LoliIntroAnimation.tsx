import React from 'react';
import { LOLI_INTRO_EXIT_MS, LOLI_INTRO_VISIBLE_MS } from '../utils/assistantIntro';

const LoliIntroAnimation: React.FC = () => {
  const [phase, setPhase] = React.useState<'visible' | 'leaving' | 'hidden'>('visible');

  React.useEffect(() => {
    const exitTimer = window.setTimeout(() => setPhase('leaving'), LOLI_INTRO_VISIBLE_MS);
    const removeTimer = window.setTimeout(
      () => setPhase('hidden'),
      LOLI_INTRO_VISIBLE_MS + LOLI_INTRO_EXIT_MS
    );

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(removeTimer);
    };
  }, []);

  if (phase === 'hidden') return null;

  return (
    <section
      className={`loli-intro-scene relative mx-auto mb-5 w-full max-w-4xl overflow-hidden rounded-[1.75rem] border border-slate-800 bg-slate-950 shadow-[0_24px_65px_-38px_rgba(15,23,42,0.9)] ${phase === 'leaving' ? 'loli-intro-scene--leaving' : ''}`}
      aria-label="Loli clinical assistant is online"
      aria-hidden={phase === 'leaving' ? true : undefined}
    >
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_20%,rgba(99,102,241,0.22),transparent_34%),radial-gradient(circle_at_18%_90%,rgba(6,182,212,0.14),transparent_32%)]" />
    <svg
      className="relative block h-auto w-full"
      viewBox="0 0 720 238"
      role="img"
      aria-labelledby="loli-intro-title loli-intro-description"
    >
      <title id="loli-intro-title">Loli is ready</title>
      <desc id="loli-intro-description">A clinical signal travels through a tooth outline and wakes Loli, the dental AI assistant.</desc>
      <defs>
        <linearGradient id="loli-signal-gradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset="0.55" stopColor="#818cf8" />
          <stop offset="1" stopColor="#c084fc" />
        </linearGradient>
        <radialGradient id="loli-avatar-halo">
          <stop offset="0" stopColor="#818cf8" stopOpacity="0.5" />
          <stop offset="1" stopColor="#818cf8" stopOpacity="0" />
        </radialGradient>
        <filter id="loli-signal-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <clipPath id="loli-avatar-clip"><circle cx="603" cy="113" r="56" /></clipPath>
      </defs>

      <g aria-hidden="true">
        <path className="loli-intro-grid" d="M0 54H720M0 113H720M0 172H720M88 0V238M176 0V238M264 0V238M352 0V238M440 0V238M528 0V238M616 0V238" />

        <text x="34" y="35" fill="#67e8f9" fontSize="10" fontWeight="700" letterSpacing="2.4">CLINICAL SIGNAL</text>
        <circle cx="166" cy="31" r="4" fill="#34d399" className="loli-intro-online-dot" />
        <text x="178" y="35" fill="#94a3b8" fontSize="10" fontWeight="600" letterSpacing="1.6">LOLI ONLINE</text>

        <g className="loli-intro-tooth">
          <path
            d="M116 72C99 60 78 65 68 83c-9 17-2 34 7 49 8 13 8 44 20 55 5 5 11 2 14-5l12-32c3-8 14-8 17 0l12 32c3 7 9 10 14 5 12-11 12-42 20-55 9-15 16-32 7-49-10-18-31-23-48-11-8 6-19 6-27 0Z"
            fill="rgba(15,23,42,0.72)"
            stroke="url(#loli-signal-gradient)"
            strokeWidth="3"
          />
          <path d="M93 99c15-11 31-13 48-4" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" />
          <circle cx="103" cy="116" r="3" fill="#22d3ee" />
          <circle cx="145" cy="116" r="3" fill="#818cf8" />
        </g>

        <path className="loli-intro-signal-shadow" d="M42 139h70l10-20 13 43 18-77 18 54h73l12-24 17 48 18-91 20 67h72l12-28 16 51 20-88 20 65h72" />
        <path className="loli-intro-signal" d="M42 139h70l10-20 13 43 18-77 18 54h73l12-24 17 48 18-91 20 67h72l12-28 16 51 20-88 20 65h72" />
        <circle className="loli-intro-signal-head" cx="526" cy="139" r="5" fill="#c084fc" filter="url(#loli-signal-glow)" />

        <circle cx="603" cy="113" r="88" fill="url(#loli-avatar-halo)" className="loli-intro-halo" />
        <circle cx="603" cy="113" r="63" fill="#eef2ff" stroke="#818cf8" strokeWidth="2" className="loli-intro-avatar-ring" />
        <image href="/loliAiAssistant.svg" x="547" y="57" width="112" height="112" clipPath="url(#loli-avatar-clip)" className="loli-intro-avatar" />
        <path d="M665 105h21l9 8-9 8h-21" fill="none" stroke="#a5b4fc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="loli-intro-handoff" />

        <text x="603" y="196" textAnchor="middle" fill="#f8fafc" fontSize="15" fontWeight="800" letterSpacing="0.1">Ready when you are.</text>
        <text x="603" y="215" textAnchor="middle" fill="#94a3b8" fontSize="9" fontWeight="600" letterSpacing="1">CLINICAL COPILOT · v2.0</text>
      </g>
    </svg>
    </section>
  );
};

export default LoliIntroAnimation;