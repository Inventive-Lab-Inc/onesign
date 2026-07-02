import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  Globe,
  Image as ImageIcon,
  Layers,
  LayoutGrid,
  Lock,
  Monitor,
  Rocket,
  ShieldCheck,
  Smartphone,
  Star,
  Wifi,
  Zap,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { layoutConfig } from "@/lib/config/layout";
import { appUrl } from "@/lib/site-hosts";
import { type PlanCurrency } from "@/lib/plan-currency";
import {
  STATIC_PLAN_VIEW_MODELS,
  type PlanViewModel,
} from "@/components/plans/plan-data";
import { LandingPricingSection } from "@/components/landing/landing-pricing-section";
import { DEFAULT_TRIAL_DAYS } from "@/lib/plan-quota";
import { LandingLiveChat } from "./landing-live-chat";
import { LandingDownloadButton } from "./landing-download-button";
import { LandingMockupSlideshow, type MockupSlide } from "./landing-mockup-slideshow";
import "./landing.css";

const showcaseSlides: MockupSlide[] = [
  {
    src: "/images/landing/mockup-v2-restaurant-menu.webp",
    alt: "Digital menu board above the counter in a fast-casual burger restaurant",
    tag: "Restaurants",
    title: "Menus that sell — updated in seconds",
  },
  {
    src: "/images/landing/mockup-v2-cafe-menu.webp",
    alt: "Digital drinks menu above the counter in a minimalist specialty coffee shop",
    tag: "Cafés",
    title: "Menu boards that update themselves",
  },
  {
    src: "/images/landing/mockup-v2-retail-window.webp",
    alt: "Storefront window display showing a storewide discount at golden hour",
    tag: "Retail",
    title: "Window displays that sell for you",
  },
  {
    src: "/images/landing/mockup-v2-wellness-lobby.webp",
    alt: "Welcome screen in a wellness studio lobby with natural light and plants",
    tag: "Wellness & lobbies",
    title: "Brand every arrival",
  },
  {
    src: "/images/landing/mockup-v2-grocery-store.webp",
    alt: "Grocery store end-cap screen showing weekly specials across produce, meat and dairy",
    tag: "Grocery",
    title: "Complex promos, one publish",
  },
  {
    src: "/images/landing/mockup-v2-multiscreen-venue.webp",
    alt: "Hotel lobby with welcome, menu and promo screens across the venue",
    tag: "Multi-location",
    title: "One console, every screen",
  },
];

const features = [
  {
    icon: Monitor,
    title: "Any screen, anywhere",
    body: "Pair a TV in seconds with a code. Manage one display or a thousand from a single console.",
  },
  {
    icon: Layers,
    title: "Drag-and-drop playlists",
    body: "Mix images, video and live widgets into playlists that loop exactly how you want them to.",
  },
  {
    icon: CalendarClock,
    title: "Schedule ahead",
    body: "Plan campaigns by day, hour or store. Content swaps itself so you never touch the TV again.",
  },
  {
    icon: LayoutGrid,
    title: "Groups & bulk deploy",
    body: "Organize screens into groups and push updates to entire locations with one click.",
  },
  {
    icon: Globe,
    title: "Websites & live widgets",
    body: "Show dashboards, menus, weather or any URL right alongside your media content.",
  },
  {
    icon: Wifi,
    title: "Real-time control",
    body: "See what's online at a glance and publish changes that reach every screen instantly.",
  },
];

const steps = [
  {
    title: "Connect a screen",
    body: "Install the OneSign player, enter the pairing code, and your display shows up in the console.",
  },
  {
    title: "Build your playlist",
    body: "Upload media or add widgets, arrange the order, and set when each item should play.",
  },
  {
    title: "Publish instantly",
    body: "Hit publish and your content goes live across every linked screen in real time.",
  },
];

const stats = [
  { value: "1,000+", label: "Screens powered" },
  { value: "99.9%", label: "Player uptime" },
  { value: "<5s", label: "To publish live" },
  { value: "24/7", label: "Always-on displays" },
];

export function LandingPage({
  plans,
  currency: _currency = "USD",
}: {
  plans?: PlanViewModel[];
  currency?: PlanCurrency;
}) {
  const { name } = layoutConfig.brand;
  const pricingPlans = plans && plans.length > 0 ? plans : STATIC_PLAN_VIEW_MODELS;

  return (
    <div className="landing">
      <LandingNav name={name} />
      <Hero name={name} />
      <TrustStrip />
      <ProductShowcase />
      <Features />
      <HowItWorks />
      <StatsBand />
      <LandingPricingSection plans={pricingPlans} />
      <FinalCta />
      <Footer name={name} />
      <LandingLiveChat />
    </div>
  );
}

function LandingNav({ name }: { name: string }) {
  return (
    <header className="landing-nav">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5">
        <Link href="/" className="flex items-center" aria-label={name}>
          <Logo height={30} />
        </Link>

        <nav className="hidden items-center gap-8 text-sm md:flex">
          <a href="#features" className="landing-nav-link">
            Features
          </a>
          <a href="#how" className="landing-nav-link">
            How it works
          </a>
          <a href="#pricing" className="landing-nav-link">
            Pricing
          </a>
        </nav>

        <div className="flex items-center gap-2.5">
          <Link
            href={appUrl("/login")}
            className="flex h-9 items-center rounded-lg px-3 text-sm font-medium text-foreground transition-colors hover:text-brand sm:px-3.5"
          >
            Sign in
          </Link>
          <Link
            href={appUrl("/signup")}
            className="landing-btn-primary flex h-9 items-center gap-1.5 rounded-lg px-4 text-sm font-semibold"
          >
            Start free trial
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero({ name }: { name: string }) {
  return (
    <section className="landing-hero landing-hero-grid relative px-5 pt-16 pb-20 sm:pt-24">
      <div className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
        <div className="landing-reveal text-center lg:text-left">
          <span className="landing-eyebrow mb-5 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold">
            <Zap size={13} strokeWidth={2.5} />
            Digital signage, simplified
          </span>
          <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-5xl lg:text-[3.5rem]">
            Run every screen
            <br />
            from <span className="landing-title-accent">one console</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground lg:mx-0">
            {name} turns any TV into a remote-controlled display. Upload content, build playlists, and
            publish to all your screens in seconds — no technical setup required.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
            <LandingDownloadButton className="landing-btn-primary flex h-12 items-center gap-2 rounded-xl px-7 text-sm font-semibold" />
            <Link
              href={appUrl("/signup")}
              className="landing-btn-ghost flex h-12 items-center gap-2 rounded-xl px-6 text-sm font-semibold"
            >
              Start free trial
              <ArrowRight size={16} strokeWidth={2.5} />
            </Link>
          </div>
          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground lg:justify-start">
            <ShieldCheck size={13} className="text-brand" strokeWidth={2} />
            {DEFAULT_TRIAL_DAYS}-day Solo trial · No credit card required
          </p>
        </div>

        <HeroMockup />
      </div>
    </section>
  );
}

/** Hero showpiece: the OneSign console dashboard in a browser window. */
function HeroMockup() {
  return (
    <div className="landing-reveal relative mx-auto w-full max-w-sm sm:max-w-md lg:max-w-none">
      <div className="landing-stage relative">
        <div className="landing-tilt relative">
          <div className="landing-window">
            <div className="landing-window-bar">
              <span className="landing-window-dot" />
              <span className="landing-window-dot" />
              <span className="landing-window-dot" />
              <span className="landing-url">
                <Lock size={9} strokeWidth={2.5} />
                app.onesigntv.com/dashboard
              </span>
            </div>

            <div className="bg-muted/20 p-3 sm:p-3.5">
              <div className="grid grid-cols-3 gap-2">
                <StatTile variant="live" label="Online" value="12" />
                <StatTile variant="soft" label="Screens" value="18" icon={Monitor} />
                <StatTile variant="soft" label="Content" value="240" icon={ImageIcon} />
              </div>

              <div className="mt-2.5 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-2">
                  <span className="text-[0.5rem] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                    Fleet monitor
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[0.5625rem] font-bold tabular-nums text-brand-strong">
                    <span className="landing-dot-live text-brand" />
                    12 online
                  </span>
                </div>
                <FleetRow name="Lobby Display" detail="HQ · Reception" creative="welcome" health="playing" />
                <FleetRow name="Drive-Thru Menu" detail="Store 04" creative="menu" health="playing" />
                <FleetRow name="Window Promo" detail="Flagship" creative="promo" health="idle" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatTile({
  variant,
  label,
  value,
  icon: Icon,
}: {
  variant: "live" | "soft";
  label: string;
  value: string;
  icon?: typeof Monitor;
}) {
  if (variant === "live") {
    return (
      <div className="landing-stat-live rounded-lg p-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[0.5rem] font-bold uppercase tracking-[0.12em] text-white/70">{label}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400 px-1.5 py-0.5 text-[0.4375rem] font-extrabold uppercase tracking-wide text-emerald-950">
            <span className="landing-dot-live text-emerald-900" style={{ height: "0.3rem", width: "0.3rem" }} />
            Live
          </span>
        </div>
        <p className="mt-1.5 text-xl font-bold leading-none tabular-nums sm:text-2xl">{value}</p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-border bg-card p-2.5">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-[0.5rem] font-bold uppercase tracking-[0.12em]">{label}</span>
        {Icon ? <Icon size={11} strokeWidth={2.25} /> : null}
      </div>
      <p className="mt-1.5 text-xl font-bold leading-none tabular-nums text-foreground sm:text-2xl">{value}</p>
    </div>
  );
}

const fleetHealth = {
  playing: { label: "Playing", chip: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700", dot: "text-emerald-500" },
  idle: { label: "Idle", chip: "border-sky-500/25 bg-sky-500/10 text-sky-700", dot: "text-sky-500" },
  offline: { label: "Offline", chip: "border-red-500/30 bg-red-500/10 text-red-600", dot: "text-red-500" },
} as const;

function FleetRow({
  name,
  detail,
  creative,
  health,
}: {
  name: string;
  detail: string;
  creative: CreativeVariant;
  health: keyof typeof fleetHealth;
}) {
  const h = fleetHealth[health];
  return (
    <div className="flex items-center gap-2.5 border-b border-border px-3 py-2 last:border-b-0">
      <div className="relative h-7 w-11 shrink-0 overflow-hidden rounded-md border border-border">
        <span className={`absolute inset-0 landing-creative--${creative}`} />
        <span className="absolute left-1 top-1 rounded-sm bg-black/55 px-1 text-[0.4375rem] font-bold uppercase tracking-wide text-white">
          Live
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.6875rem] font-bold leading-tight text-foreground">{name}</p>
        <p className="truncate text-[0.5625rem] leading-tight text-muted-foreground">{detail}</p>
      </div>
      <span
        className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[0.5625rem] font-semibold ${h.chip}`}
      >
        <span className={`landing-dot-live ${h.dot}`} style={{ height: "0.3rem", width: "0.3rem" }} />
        {h.label}
      </span>
    </div>
  );
}

type CreativeVariant = "welcome" | "promo" | "menu" | "fresh";


function TrustStrip() {
  return (
    <section className="border-y border-border bg-muted/30 px-5 py-5">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
        <span className="flex items-center gap-0.5 text-amber-400">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} size={15} className="fill-current" />
          ))}
        </span>
        <span className="font-medium">Loved by retailers, cafés, gyms and agencies — trusted on 1,000+ screens worldwide.</span>
      </div>
    </section>
  );
}

/** "Every venue" showcase: a rotating set of real-world signage scenes —
 *  café menus, retail windows, lobbies and more — the multi-use story of
 *  digital signage, told through the screens themselves rather than UI chrome. */
function ProductShowcase() {
  return (
    <section className="px-5 py-16 sm:py-20">
      <div className="mx-auto w-full max-w-6xl">
        <SectionHeading
          eyebrow="See it in action"
          title="Built for cafés, retail, grocery and more"
          subtitle="The same console powers menu boards, window promos, lobby welcomes and weekly specials — swap the scene, keep the workflow."
        />

        <div className="landing-rise mt-12">
          <LandingMockupSlideshow slides={showcaseSlides} />
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="px-5 py-20">
      <div className="mx-auto w-full max-w-6xl">
        <SectionHeading
          eyebrow="Features"
          title="Everything you need to run your screens"
          subtitle="From a single window display to a national network — OneSign keeps every screen on-brand and up to date."
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, body }) => (
            <div key={title} className="landing-feature p-6">
              <span className="landing-feature-icon flex h-11 w-11 items-center justify-center rounded-xl">
                <Icon size={20} strokeWidth={2} />
              </span>
              <h3 className="mt-4 text-base font-bold text-foreground">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how" className="bg-muted/30 px-5 py-20">
      <div className="mx-auto w-full max-w-6xl">
        <SectionHeading
          eyebrow="How it works"
          title="Live in three simple steps"
          subtitle="No installers, no IT tickets. If you can make a playlist, you can run a screen."
        />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((step, i) => (
            <div key={step.title} className="relative">
              <div className="flex items-center gap-3">
                <span className="landing-step-num flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold">
                  {i + 1}
                </span>
                <h3 className="text-lg font-bold text-foreground">{step.title}</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function StatsBand() {
  return (
    <section className="px-5 py-16">
      <div className="landing-band-dark mx-auto w-full max-w-6xl rounded-3xl px-8 py-12">
        <div className="relative z-10 grid grid-cols-2 gap-8 text-center md:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label}>
              <p className="text-3xl font-bold tracking-tight sm:text-4xl">{stat.value}</p>
              <p className="mt-1 text-sm text-white/65">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="px-5 pb-20">
      <div className="landing-band-dark mx-auto w-full max-w-6xl rounded-3xl px-8 py-14 text-center">
        <div className="relative z-10 mx-auto max-w-2xl">
          <span className="flex justify-center">
            <Rocket size={28} className="text-white" strokeWidth={2} />
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to light up your screens?
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-base text-white/70">
            Join the businesses running their displays the easy way. Set up your first screen in
            minutes — start with a {DEFAULT_TRIAL_DAYS}-day Solo trial.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <LandingDownloadButton className="landing-btn-on-dark flex h-11 items-center gap-2 rounded-xl px-6 text-sm font-semibold" />
            <Link
              href={appUrl("/signup")}
              className="flex h-11 items-center gap-2 rounded-xl border border-white/25 px-6 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              Start free trial
              <ArrowRight size={16} strokeWidth={2.5} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer({ name }: { name: string }) {
  return (
    <footer className="border-t border-border px-5 py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
        <Link href="/" className="flex items-center" aria-label={name}>
          <Logo height={26} />
        </Link>
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
          <a href="#features" className="landing-footer-link">
            Features
          </a>
          <a href="#pricing" className="landing-footer-link">
            Pricing
          </a>
          <Link href={appUrl("/login")} className="landing-footer-link">
            Sign in
          </Link>
          <Link href={appUrl("/signup")} className="landing-footer-link">
            Get started
          </Link>
        </nav>
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} {name}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <span className="landing-eyebrow inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider">
        {eyebrow}
      </span>
      <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-[2.25rem]">{title}</h2>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">{subtitle}</p>
    </div>
  );
}
