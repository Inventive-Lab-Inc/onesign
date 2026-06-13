"use client";

/** Inline SVG product art for ad screens — no external assets */

export function BurgerArt() {
  return (
    <svg className="lm-ad-art" viewBox="0 0 200 120" aria-hidden>
      <ellipse cx="100" cy="95" rx="72" ry="12" fill="rgba(0,0,0,0.35)" />
      <path d="M35 58 Q100 38 165 58 L158 72 Q100 52 42 72 Z" fill="#fcd34d" />
      <rect x="38" y="62" width="124" height="10" rx="3" fill="#166534" />
      <rect x="42" y="72" width="116" height="14" rx="4" fill="#92400e" />
      <rect x="40" y="86" width="120" height="12" rx="4" fill="#fcd34d" />
      <circle cx="68" cy="68" r="5" fill="#dc2626" opacity="0.9" />
      <circle cx="100" cy="66" r="4" fill="#dc2626" opacity="0.85" />
      <circle cx="128" cy="69" r="4.5" fill="#dc2626" opacity="0.9" />
    </svg>
  );
}

export function CoffeeArt() {
  return (
    <svg className="lm-ad-art" viewBox="0 0 200 120" aria-hidden>
      <ellipse cx="100" cy="98" rx="40" ry="8" fill="rgba(0,0,0,0.3)" />
      <path d="M62 45 Q68 25 78 45" stroke="rgba(255,255,255,0.35)" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M72 42 Q78 22 88 42" stroke="rgba(255,255,255,0.25)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M70 55 L70 88 Q70 98 100 98 Q130 98 130 88 L130 55 Z" fill="#78350f" />
      <path d="M74 58 L74 86 Q74 92 100 92 Q126 92 126 86 L126 58 Z" fill="#451a03" />
      <ellipse cx="100" cy="58" rx="28" ry="6" fill="#92400e" />
      <path d="M130 68 L148 62 Q158 68 148 78 L130 74 Z" fill="#78350f" />
    </svg>
  );
}

export function SaleArt() {
  return (
    <svg className="lm-ad-art" viewBox="0 0 200 120" aria-hidden>
      <circle cx="100" cy="60" r="48" fill="rgba(255,255,255,0.12)" />
      <text x="100" y="72" textAnchor="middle" fill="#fff" fontSize="42" fontWeight="900" transform="rotate(-12 100 60)">50%</text>
      <path d="M30 30 L50 20 L45 40 Z" fill="#fde68a" opacity="0.8" />
      <path d="M170 90 L155 105 L165 85 Z" fill="#fde68a" opacity="0.7" />
    </svg>
  );
}

export function FashionArt() {
  return (
    <svg className="lm-ad-art" viewBox="0 0 200 120" aria-hidden>
      <ellipse cx="100" cy="105" rx="35" ry="6" fill="rgba(0,0,0,0.2)" />
      <path d="M78 35 L100 28 L122 35 L118 95 L82 95 Z" fill="#6366f1" />
      <path d="M88 35 L100 50 L112 35" fill="none" stroke="#c7d2fe" strokeWidth="2" />
      <rect x="94" y="28" width="12" height="8" rx="2" fill="#312e81" />
      <path d="M70 55 L82 50 M130 55 L118 50" stroke="#818cf8" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function DumbbellArt() {
  return (
    <svg className="lm-ad-art" viewBox="0 0 200 120" aria-hidden>
      <rect x="25" y="52" width="22" height="28" rx="4" fill="#525252" />
      <rect x="153" y="52" width="22" height="28" rx="4" fill="#525252" />
      <rect x="18" y="58" width="12" height="16" rx="2" fill="#737373" />
      <rect x="170" y="58" width="12" height="16" rx="2" fill="#737373" />
      <rect x="47" y="62" width="106" height="8" rx="2" fill="#404040" />
      <rect x="47" y="62" width="106" height="8" rx="2" fill="url(#gym-shine)" opacity="0.4" />
      <defs>
        <linearGradient id="gym-shine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="transparent" />
          <stop offset="50%" stopColor="#a3e635" />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function HiitArt() {
  return (
    <svg className="lm-ad-art" viewBox="0 0 200 120" aria-hidden>
      <polyline points="30,85 55,45 80,70 105,30 130,55 155,25 180,60" fill="none" stroke="#22d3ee" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
      <circle cx="105" cy="30" r="6" fill="#06b6d4" />
    </svg>
  );
}

export function HotelArt() {
  return (
    <svg className="lm-ad-art" viewBox="0 0 200 120" aria-hidden>
      <path d="M40 95 L100 35 L160 95 Z" fill="rgba(253,224,71,0.15)" stroke="#ca8a04" strokeWidth="2" />
      <rect x="85" y="55" width="30" height="40" fill="#57534e" />
      <rect x="92" y="62" width="16" height="12" fill="#fde68a" opacity="0.6" />
      <circle cx="100" cy="42" r="8" fill="#fde047" opacity="0.8" />
    </svg>
  );
}

export function SpaArt() {
  return (
    <svg className="lm-ad-art" viewBox="0 0 200 120" aria-hidden>
      <ellipse cx="100" cy="75" rx="55" ry="20" fill="rgba(14,165,233,0.25)" />
      <path d="M55 75 Q100 55 145 75" fill="none" stroke="#38bdf8" strokeWidth="3" opacity="0.7" />
      <path d="M65 68 Q100 50 135 68" fill="none" stroke="#7dd3fc" strokeWidth="2" opacity="0.5" />
      <circle cx="80" cy="45" r="3" fill="#bae6fd" />
      <circle cx="100" cy="38" r="4" fill="#e0f2fe" />
      <circle cx="120" cy="46" r="3" fill="#bae6fd" />
    </svg>
  );
}

export function MedicalArt() {
  return (
    <svg className="lm-ad-art" viewBox="0 0 200 120" aria-hidden>
      <rect x="70" y="30" width="60" height="60" rx="8" fill="rgba(255,255,255,0.15)" />
      <rect x="92" y="42" width="16" height="36" rx="2" fill="#fff" />
      <rect x="82" y="52" width="36" height="16" rx="2" fill="#fff" />
    </svg>
  );
}

export function HydrationArt() {
  return (
    <svg className="lm-ad-art" viewBox="0 0 200 120" aria-hidden>
      <path d="M85 35 L85 75 Q85 95 100 95 Q115 95 115 75 L115 35 Z" fill="rgba(14,165,233,0.35)" stroke="#0ea5e9" strokeWidth="2" />
      <rect x="88" y="55" width="24" height="30" fill="#38bdf8" opacity="0.6" rx="2" />
      <ellipse cx="100" cy="55" rx="14" ry="4" fill="#7dd3fc" opacity="0.5" />
    </svg>
  );
}
