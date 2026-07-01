"use client";

import { motion } from "motion/react";
import {
  BurgerArt,
  CoffeeArt,
  DumbbellArt,
  FashionArt,
  HiitArt,
  HotelArt,
  HydrationArt,
  MedicalArt,
  SaleArt,
  SpaArt,
} from "./login-motion-ad-art";
import {
  AdPrice,
  AdSub,
  AdTag,
  AdTitle,
  AmbientLayer,
  MotionStage,
  SignageDisplay,
  useParallax,
  type AdContent,
  type FrameStyle,
} from "./login-motion-primitives";

function RestaurantOverlay() {
  return (
    <>
      {[140, 320, 500, 680].map((x, i) => (
        <motion.div
          key={x}
          className="lm-venue-glow lm-venue-glow--warm"
          style={{ left: `${x / 8}%`, top: "18%", width: 48, height: 48 }}
          animate={{ opacity: [0.5, 1, 0.5], scale: [0.9, 1.15, 0.9] }}
          transition={{ duration: 2.5 + i * 0.4, repeat: Infinity, ease: "easeInOut" }}
          aria-hidden
        />
      ))}
      <div className="lm-steam lm-steam--1" aria-hidden />
      <div className="lm-steam lm-steam--2" aria-hidden />
    </>
  );
}

function RetailOverlay() {
  return <div className="lm-spotlight-sweep" aria-hidden />;
}

function GymOverlay() {
  return (
    <>
      <div className="lm-neon-sign" aria-hidden>GYM</div>
      <motion.div
        className="lm-neon-glow"
        animate={{ opacity: [0.4, 0.9, 0.4] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      />
    </>
  );
}

function HotelOverlay() {
  return (
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.span
          key={i}
          className="lm-chandelier-spark"
          style={{ left: `${38 + i * 6}%`, top: `${8 + (i % 2) * 2}%` }}
          animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
          transition={{ duration: 2 + i * 0.3, repeat: Infinity, delay: i * 0.2 }}
          aria-hidden
        />
      ))}
    </>
  );
}

function ClinicOverlay() {
  return (
    <motion.div
      className="lm-clinic-pulse"
      animate={{ opacity: [0.15, 0.35, 0.15] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      aria-hidden
    />
  );
}

function RoomSvg({ variant }: { variant: "restaurant" | "retail" | "gym" | "hotel" | "clinic" }) {
  if (variant === "restaurant") {
    return (
      <svg className="lm-room-svg" viewBox="0 0 800 480" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <linearGradient id="lr-wall" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5c4033" /><stop offset="55%" stopColor="#3d2b22" /><stop offset="100%" stopColor="#1a120e" />
          </linearGradient>
          <radialGradient id="lr-warm" cx="50%" cy="25%" r="55%">
            <stop offset="0%" stopColor="rgba(251,191,36,0.4)" /><stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <linearGradient id="lr-floor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#44403c" /><stop offset="100%" stopColor="#1c1917" />
          </linearGradient>
        </defs>
        <rect width="800" height="480" fill="url(#lr-wall)" />
        <rect width="800" height="480" fill="url(#lr-warm)" />
        <rect x="0" y="318" width="800" height="162" fill="url(#lr-floor)" />
        <rect x="0" y="310" width="800" height="14" fill="#78716c" />
        <rect x="80" y="250" width="640" height="65" fill="#292524" rx="4" />
        <rect x="90" y="258" width="620" height="8" fill="#57534e" />
        <ellipse cx="180" cy="395" rx="62" ry="14" fill="#0c0a09" opacity="0.7" />
        <ellipse cx="420" cy="400" rx="58" ry="13" fill="#0c0a09" opacity="0.65" />
        <ellipse cx="640" cy="398" rx="60" ry="14" fill="#0c0a09" opacity="0.7" />
        <rect x="170" y="330" width="55" height="55" fill="#44403c" rx="4" opacity="0.8" />
        <rect x="400" y="332" width="52" height="52" fill="#44403c" rx="4" opacity="0.8" />
        <rect x="620" y="331" width="54" height="54" fill="#44403c" rx="4" opacity="0.8" />
        {[160, 340, 520, 700].map((x, i) => (
          <g key={x}>
            <line x1={x} y1="55" x2={x} y2="88" stroke="#a8a29e" strokeWidth="2" />
            <ellipse cx={x} cy="100" rx="32" ry="10" fill="#292524" />
            <ellipse cx={x} cy="98" rx="28" ry="8" fill={`rgba(251,191,36,${0.35 + i * 0.06})`} />
          </g>
        ))}
        <rect x="320" y="30" width="160" height="28" fill="#292524" rx="3" opacity="0.85" />
        <text x="400" y="50" textAnchor="middle" fill="#fde68a" fontSize="13" fontWeight="700" letterSpacing="7">CAFÉ</text>
        <rect x="30" y="120" width="120" height="90" fill="#1c1917" rx="3" opacity="0.5" stroke="#57534e" strokeWidth="1" />
        <text x="90" y="175" textAnchor="middle" fill="#78716c" fontSize="9" letterSpacing="2">MENU</text>
      </svg>
    );
  }

  if (variant === "retail") {
    return (
      <svg className="lm-room-svg" viewBox="0 0 800 480" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <linearGradient id="lrt-wall" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fafafa" /><stop offset="100%" stopColor="#e2e8f0" />
          </linearGradient>
          <linearGradient id="lrt-floor" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f1f5f9" /><stop offset="100%" stopColor="#cbd5e1" />
          </linearGradient>
        </defs>
        <rect width="800" height="480" fill="url(#lrt-wall)" />
        <rect x="0" y="340" width="800" height="140" fill="url(#lrt-floor)" />
        {[100, 260, 420, 580].map((x) => (
          <g key={x}>
            <rect x={x} y="175" width="10" height="165" fill="#e2e8f0" rx="2" />
            <line x1={x + 5} y1="190" x2={x + 5} y2="330" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 6" />
          </g>
        ))}
        <ellipse cx="130" cy="250" rx="28" ry="55" fill="#fbcfe8" opacity="0.9" />
        <circle cx="130" cy="195" r="14" fill="#fda4af" />
        <ellipse cx="290" cy="248" rx="26" ry="52" fill="#bfdbfe" opacity="0.9" />
        <circle cx="290" cy="194" r="13" fill="#93c5fd" />
        <ellipse cx="580" cy="246" rx="27" ry="54" fill="#c7d2fe" opacity="0.9" />
        <circle cx="580" cy="192" r="13" fill="#a5b4fc" />
        <rect x="50" y="195" width="75" height="95" fill="#fce7f3" rx="3" opacity="0.85" />
        <rect x="155" y="200" width="70" height="88" fill="#dbeafe" rx="3" opacity="0.85" />
        <rect x="530" y="198" width="72" height="90" fill="#e0e7ff" rx="3" opacity="0.85" />
        <rect x="650" y="205" width="68" height="82" fill="#fef3c7" rx="3" opacity="0.85" />
        <rect x="620" y="130" width="110" height="55" fill="#ec4899" rx="4" transform="rotate(-6 675 157)" />
        <text x="675" y="162" textAnchor="middle" fill="#fff" fontSize="20" fontWeight="900" transform="rotate(-6 675 157)">SALE</text>
        <rect x="310" y="28" width="180" height="32" fill="#4338ca" rx="4" opacity="0.9" />
        <text x="400" y="50" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="800" letterSpacing="5">FASHION STORE</text>
      </svg>
    );
  }

  if (variant === "gym") {
    return (
      <svg className="lm-room-svg" viewBox="0 0 800 480" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <linearGradient id="lg-floor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#262626" /><stop offset="100%" stopColor="#0a0a0a" />
          </linearGradient>
        </defs>
        <rect width="800" height="480" fill="#0a0a0a" />
        <rect x="30" y="65" width="740" height="210" fill="rgba(64,64,64,0.2)" stroke="#404040" strokeWidth="2" />
        <rect x="0" y="350" width="800" height="130" fill="url(#lg-floor)" />
        {Array.from({ length: 16 }, (_, i) => (
          <rect key={i} x={i * 50} y="352" width="25" height="128" fill={i % 2 ? "#171717" : "#1a1a1a"} />
        ))}
        <rect x="60" y="285" width="240" height="22" fill="#404040" rx="3" />
        {[85, 135, 185, 235].map((x) => (
          <rect key={x} x={x} y="270" width="32" height="10" fill="#737373" rx="2" />
        ))}
        <rect x="520" y="280" width="180" height="120" fill="#141414" stroke="#404040" strokeWidth="2" rx="2" opacity="0.7" />
        <rect x="530" y="290" width="160" height="100" fill="rgba(163,230,53,0.05)" />
        <ellipse cx="610" cy="95" rx="80" ry="25" fill="rgba(163,230,53,0.08)" />
        <rect x="680" y="100" width="90" height="45" fill="none" stroke="#a3e635" strokeWidth="2" rx="3" opacity="0.85" />
        <text x="725" y="130" textAnchor="middle" fill="#a3e635" fontSize="22" fontWeight="900">GYM</text>
        <rect x="40" y="130" width="100" height="140" fill="#171717" stroke="#333" strokeWidth="1" rx="2" opacity="0.6" />
      </svg>
    );
  }

  if (variant === "hotel") {
    return (
      <svg className="lm-room-svg" viewBox="0 0 800 480" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <linearGradient id="lh-marble" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#57534e" /><stop offset="35%" stopColor="#44403c" /><stop offset="70%" stopColor="#292524" /><stop offset="100%" stopColor="#1c1917" />
          </linearGradient>
          <linearGradient id="lh-gold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ca8a04" /><stop offset="100%" stopColor="#854d0e" />
          </linearGradient>
        </defs>
        <rect width="800" height="480" fill="url(#lh-marble)" />
        <rect x="20" y="55" width="48" height="310" fill="#78716c" opacity="0.55" />
        <rect x="732" y="55" width="48" height="310" fill="#78716c" opacity="0.55" />
        <rect x="100" y="300" width="600" height="65" fill="#57534e" />
        <rect x="100" y="294" width="600" height="10" fill="url(#lh-gold)" />
        <rect x="80" y="365" width="640" height="115" fill="#1c1917" />
        {[120, 200, 280, 360, 440, 520, 600, 680].map((x) => (
          <rect key={x} x={x} y="372" width="55" height="8" fill="#292524" rx="1" opacity="0.8" />
        ))}
        <rect x="260" y="308" width="280" height="14" fill="#991b1b" opacity="0.9" rx="2" />
        <circle cx="400" cy="48" r="38" fill="rgba(253,224,71,0.2)" />
        <line x1="400" y1="12" x2="400" y2="38" stroke="#ca8a04" strokeWidth="3" />
        {[370, 400, 430].map((x) => (
          <circle key={x} cx={x} cy="22" r="4" fill="#fde047" opacity="0.9" />
        ))}
        <rect x="340" y="35" width="120" height="24" fill="#292524" rx="3" opacity="0.9" />
        <text x="400" y="52" textAnchor="middle" fill="#fde68a" fontSize="11" fontWeight="700" letterSpacing="4">RECEPTION</text>
        <ellipse cx="400" cy="318" rx="18" ry="8" fill="#ca8a04" opacity="0.8" />
        <rect x="385" y="310" width="30" height="12" fill="#78716c" rx="2" />
      </svg>
    );
  }

  return (
    <svg className="lm-room-svg" viewBox="0 0 800 480" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id="lc-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f0fdfa" /><stop offset="100%" stopColor="#ccfbf1" />
        </linearGradient>
      </defs>
      <rect width="800" height="480" fill="url(#lc-wall)" />
      <rect x="0" y="335" width="800" height="145" fill="#99f6e4" opacity="0.5" />
      <rect x="50" y="268" width="240" height="72" fill="#5eead4" stroke="#0d9488" strokeWidth="2" rx="8" />
      <text x="170" y="310" textAnchor="middle" fill="#0f766e" fontSize="12" fontWeight="700" letterSpacing="3">RECEPTION</text>
      <rect x="310" y="278" width="55" height="48" fill="#99f6e4" rx="8" stroke="#0d9488" strokeWidth="1.5" />
      <rect x="380" y="278" width="55" height="48" fill="#99f6e4" rx="8" stroke="#0d9488" strokeWidth="1.5" />
      <rect x="450" y="278" width="55" height="48" fill="#99f6e4" rx="8" stroke="#0d9488" strokeWidth="1.5" />
      <rect x="520" y="278" width="55" height="48" fill="#99f6e4" rx="8" stroke="#0d9488" strokeWidth="1.5" />
      <rect x="590" y="278" width="55" height="48" fill="#99f6e4" rx="8" stroke="#0d9488" strokeWidth="1.5" />
      <g transform="translate(65,95)">
        <rect x="12" y="0" width="56" height="16" fill="#0d9488" rx="3" />
        <rect x="0" y="16" width="80" height="16" fill="#0d9488" rx="3" />
        <rect x="20" y="32" width="40" height="16" fill="#14b8a6" rx="3" />
      </g>
      <rect x="680" y="90" width="90" height="50" fill="#0d9488" rx="6" opacity="0.85" />
      <text x="725" y="122" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="800" letterSpacing="2">+ MEDICAL</text>
      <rect x="300" y="28" width="200" height="32" fill="#0f766e" rx="5" opacity="0.9" />
      <text x="400" y="50" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="800" letterSpacing="4">MEDICAL CENTER</text>
    </svg>
  );
}

const RESTAURANT_ADS: AdContent[] = [
  {
    id: "burger",
    background: "linear-gradient(145deg, #7c2d12 0%, #dc2626 45%, #7f1d1d 100%)",
    overlay: "radial-gradient(circle at 55% 35%, rgba(251,191,36,0.4), transparent 50%)",
    art: <BurgerArt />,
    children: <><AdTag>Today&apos;s special</AdTag><AdTitle>Signature Burger</AdTitle><AdPrice>$9.99</AdPrice></>,
  },
  {
    id: "coffee",
    background: "linear-gradient(165deg, #451a03 0%, #78350f 45%, #92400e 100%)",
    overlay: "radial-gradient(ellipse at 50% 65%, rgba(254,243,199,0.25), transparent 55%)",
    art: <CoffeeArt />,
    children: <><AdTag>Fresh brewed</AdTag><AdTitle>Premium Coffee</AdTitle><AdSub>All day · every day</AdSub></>,
  },
  {
    id: "happy",
    background: "linear-gradient(135deg, var(--theme) 0%, #065f46 100%)",
    children: <><AdTitle>Happy Hour</AdTitle><AdSub>50% off drinks · 3–6 PM</AdSub></>,
  },
];

const RETAIL_ADS: AdContent[] = [
  {
    id: "sale",
    background: "linear-gradient(140deg, #be185d 0%, #ec4899 55%, #db2777 100%)",
    art: <SaleArt />,
    children: <><AdTitle>Summer Sale</AdTitle><AdPrice>Up to 50% off</AdPrice></>,
  },
  {
    id: "new",
    background: "linear-gradient(165deg, #312e81 0%, #6366f1 100%)",
    art: <FashionArt />,
    children: <><AdTag>New arrival</AdTag><AdTitle>Spring Collection</AdTitle></>,
  },
  {
    id: "bogo",
    background: "linear-gradient(135deg, #e11d48 0%, #f43f5e 100%)",
    children: <><AdTitle>Buy 2 Get 1</AdTitle><AdSub>All accessories</AdSub></>,
  },
];

const GYM_ADS: AdContent[] = [
  {
    id: "hiit",
    background: "linear-gradient(165deg, #0e7490 0%, #164e63 100%)",
    art: <HiitArt />,
    children: <><AdTag>Today · 6 PM</AdTag><AdTitle>HIIT Class</AdTitle><AdSub>Studio B</AdSub></>,
  },
  {
    id: "join",
    background: "linear-gradient(135deg, #18181b 0%, #27272a 100%)",
    art: <DumbbellArt />,
    children: <><AdTitle>Join Now</AdTitle><AdPrice>$29/mo</AdPrice></>,
  },
  {
    id: "pt",
    background: "linear-gradient(135deg, #4d7c0f 0%, #84cc16 100%)",
    children: <><AdTitle>Personal Training</AdTitle><AdSub>First session free</AdSub></>,
  },
];

const HOTEL_ADS: AdContent[] = [
  {
    id: "welcome",
    background: "linear-gradient(165deg, #854d0e 0%, #ca8a04 50%, #eab308 100%)",
    art: <HotelArt />,
    children: <><AdTitle>Welcome</AdTitle><AdSub>Enjoy your stay</AdSub></>,
  },
  {
    id: "spa",
    background: "linear-gradient(140deg, #0f172a 0%, #1e3a5f 100%)",
    art: <SpaArt />,
    children: <><AdTag>Spa & Wellness</AdTag><AdTitle>Open 8 AM – 10 PM</AdTitle></>,
  },
  {
    id: "dining",
    background: "linear-gradient(165deg, #78350f 0%, #92400e 100%)",
    children: <><AdTitle>Rooftop Dining</AdTitle><AdSub>Reservations at desk</AdSub></>,
  },
];

const CLINIC_ADS: AdContent[] = [
  {
    id: "flu",
    background: "linear-gradient(135deg, #0369a1 0%, #0ea5e9 100%)",
    art: <MedicalArt />,
    children: <><AdTitle>Flu Shots Available</AdTitle><AdSub>Walk-ins welcome</AdSub></>,
  },
  {
    id: "hours",
    background: "linear-gradient(165deg, #0f766e 0%, #14b8a6 100%)",
    children: <><AdTag>Office hours</AdTag><AdTitle>Mon – Fri · 8–5</AdTitle></>,
  },
  {
    id: "tip",
    background: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
    art: <HydrationArt />,
    children: <><AdTitle dark>Stay Hydrated</AdTitle><AdSub>8 glasses daily</AdSub></>,
  },
];

const SCENE_EXTRAS = {
  restaurant: <RestaurantOverlay />,
  retail: <RetailOverlay />,
  gym: <GymOverlay />,
  hotel: <HotelOverlay />,
  clinic: <ClinicOverlay />,
} as const;

function SceneLayout({
  room,
  ambient,
  heroAds,
  leftAds,
  rightAds,
  frames,
}: {
  room: keyof typeof SCENE_EXTRAS;
  ambient: "warm" | "cool" | "neon" | "gold" | "clinical";
  heroAds: AdContent[];
  leftAds: AdContent[];
  rightAds: AdContent[];
  frames: { hero: FrameStyle; medium: FrameStyle; portrait: FrameStyle };
}) {
  const { mouseX, mouseY } = useParallax();

  return (
    <div className="lm-scene-inner">
      <MotionStage mouseX={mouseX} mouseY={mouseY}>
        <RoomSvg variant={room} />
        <AmbientLayer variant={ambient} extras={SCENE_EXTRAS[room]} />
      </MotionStage>
      <div className="lm-displays">
        <div className="lm-displays__slot lm-displays__slot--left">
          <SignageDisplay
            ads={leftAds}
            size="medium"
            frame={frames.medium}
            tilt={{ x: 5, y: 6 }}
            delay={0.2}
          />
        </div>
        <div className="lm-displays__slot lm-displays__slot--hero">
          <SignageDisplay
            ads={heroAds}
            size="hero"
            frame={frames.hero}
            tilt={{ x: 2, y: -3 }}
            delay={0}
          />
        </div>
        <div className="lm-displays__slot lm-displays__slot--right">
          <SignageDisplay
            ads={rightAds}
            size="portrait"
            frame={frames.portrait}
            tilt={{ x: 4, y: 8 }}
            delay={0.35}
          />
        </div>
      </div>
    </div>
  );
}

export function RestaurantScene() {
  return (
    <SceneLayout
      room="restaurant"
      ambient="warm"
      frames={{ hero: "chalkboard", medium: "wood-tablet", portrait: "a-frame" }}
      heroAds={RESTAURANT_ADS}
      leftAds={[RESTAURANT_ADS[1]!, RESTAURANT_ADS[2]!, RESTAURANT_ADS[0]!]}
      rightAds={[RESTAURANT_ADS[2]!, RESTAURANT_ADS[0]!, RESTAURANT_ADS[1]!]}
    />
  );
}

export function RetailScene() {
  return (
    <SceneLayout
      room="retail"
      ambient="cool"
      frames={{ hero: "ultrathin", medium: "shelf-strip", portrait: "kiosk" }}
      heroAds={RETAIL_ADS}
      leftAds={[RETAIL_ADS[1]!, RETAIL_ADS[2]!, RETAIL_ADS[0]!]}
      rightAds={[RETAIL_ADS[2]!, RETAIL_ADS[0]!, RETAIL_ADS[1]!]}
    />
  );
}

export function GymScene() {
  return (
    <SceneLayout
      room="gym"
      ambient="neon"
      frames={{ hero: "industrial", medium: "flush-mount", portrait: "led-column" }}
      heroAds={GYM_ADS}
      leftAds={[GYM_ADS[1]!, GYM_ADS[2]!, GYM_ADS[0]!]}
      rightAds={[GYM_ADS[2]!, GYM_ADS[0]!, GYM_ADS[1]!]}
    />
  );
}

export function HotelScene() {
  return (
    <SceneLayout
      room="hotel"
      ambient="gold"
      frames={{ hero: "luxury-gold", medium: "brass-plaque", portrait: "marble-kiosk" }}
      heroAds={HOTEL_ADS}
      leftAds={[HOTEL_ADS[1]!, HOTEL_ADS[2]!, HOTEL_ADS[0]!]}
      rightAds={[HOTEL_ADS[2]!, HOTEL_ADS[0]!, HOTEL_ADS[1]!]}
    />
  );
}

export function ClinicScene() {
  return (
    <SceneLayout
      room="clinic"
      ambient="clinical"
      frames={{ hero: "clinical-white", medium: "wall-panel", portrait: "wayfinding" }}
      heroAds={CLINIC_ADS}
      leftAds={[CLINIC_ADS[1]!, CLINIC_ADS[2]!, CLINIC_ADS[0]!]}
      rightAds={[CLINIC_ADS[2]!, CLINIC_ADS[0]!, CLINIC_ADS[1]!]}
    />
  );
}

export const BUSINESS_SCENES = [
  { id: "restaurant", badge: "Restaurants & cafés", Scene: RestaurantScene, bg: "#1a120e" },
  { id: "retail", badge: "Retail stores", Scene: RetailScene, bg: "#1e1b4b" },
  { id: "gym", badge: "Fitness & gyms", Scene: GymScene, bg: "#0a0a0a" },
  { id: "hotel", badge: "Hotels & lobbies", Scene: HotelScene, bg: "#1c1917" },
  { id: "clinic", badge: "Clinics & offices", Scene: ClinicScene, bg: "#0c4a6e" },
] as const;
