import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  Check,
  Globe,
  Layers,
  LayoutGrid,
  Monitor,
  MonitorPlay,
  Rocket,
  ShieldCheck,
  Star,
  Wifi,
  Zap,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { layoutConfig } from "@/lib/config/layout";
import { appUrl } from "@/lib/site-hosts";
import {
  STATIC_PLAN_VIEW_MODELS,
  planIconForIndex,
  type PlanViewModel,
} from "@/components/plans/plan-data";
import { LandingDownloadButton } from "./landing-download-button";
import "./landing.css";

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

export function LandingPage({ plans }: { plans?: PlanViewModel[] }) {
  const { name } = layoutConfig.brand;
  const pricingPlans = plans && plans.length > 0 ? plans : STATIC_PLAN_VIEW_MODELS;

  return (
    <div className="landing">
      <LandingNav name={name} />
      <Hero name={name} />
      <TrustStrip />
      <Features />
      <HowItWorks />
      <StatsBand />
      <PricingTeaser plans={pricingPlans} />
      <FinalCta />
      <Footer name={name} />
    </div>
  );
}

function LandingNav({ name }: { name: string }) {
  return (
    <header className="landing-nav">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2.5">
          <BrandMark icon={layoutConfig.brand.icon} iconSize={18} />
          <span className="text-lg font-bold tracking-tight text-foreground">{name}</span>
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
            7-day free trial · No credit card required
          </p>
        </div>

        <HeroMockup />
      </div>
    </section>
  );
}

function HeroMockup() {
  return (
    <div className="landing-reveal relative mx-auto w-full max-w-md lg:max-w-none">
      <div className="landing-screen">
        <div className="landing-screen-bar flex items-center gap-2 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
          <span className="ml-3 flex items-center gap-1.5 text-xs font-medium text-white/70">
            <MonitorPlay size={13} /> Lobby Display · Live
          </span>
        </div>
        <div className="landing-screen-canvas relative aspect-[4/3] p-5">
          <div className="flex h-full flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1 text-[0.625rem] font-semibold text-brand-strong shadow-sm">
                <span className="landing-live-dot h-1.5 w-1.5 rounded-full" />
                NOW PLAYING
              </span>
              <span className="text-[0.625rem] font-medium text-muted-foreground">Playlist · 6 items</span>
            </div>
            <div>
              <div className="h-3 w-2/3 rounded-full bg-brand-soft" />
              <div className="mt-2 h-3 w-1/2 rounded-full bg-brand-softer" />
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="aspect-video rounded-lg border border-border bg-card/70"
                  style={{ opacity: 1 - i * 0.18 }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="landing-float landing-float-card absolute -left-4 top-1/3 hidden rounded-xl px-3.5 py-2.5 sm:block">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-soft text-brand-strong">
            <Monitor size={14} strokeWidth={2.5} />
          </span>
          <div>
            <p className="text-xs font-bold text-foreground">12 screens</p>
            <p className="text-[0.625rem] text-muted-foreground">all online</p>
          </div>
        </div>
      </div>

      <div className="landing-float landing-float--slow landing-float-card absolute -right-3 bottom-8 hidden rounded-xl px-3.5 py-2.5 sm:block">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-soft text-brand-strong">
            <Zap size={14} strokeWidth={2.5} />
          </span>
          <div>
            <p className="text-xs font-bold text-foreground">Published</p>
            <p className="text-[0.625rem] text-muted-foreground">in 3 seconds</p>
          </div>
        </div>
      </div>
    </div>
  );
}

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
              <span className="landing-step-num flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold">
                {i + 1}
              </span>
              <h3 className="mt-4 text-lg font-bold text-foreground">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
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

function PricingTeaser({ plans }: { plans: PlanViewModel[] }) {
  return (
    <section id="pricing" className="px-5 py-20">
      <div className="mx-auto w-full max-w-6xl">
        <SectionHeading
          eyebrow="Pricing"
          title="Simple plans that scale with you"
          subtitle="Start free, then pick the plan that matches your screen count. No setup fees, cancel anytime."
        />
        <div className="mt-12 grid gap-5 md:grid-cols-3 md:items-center">
          {plans.map((plan, index) => {
            const popular = plan.highlighted;
            const Icon = planIconForIndex(index);
            return (
              <div
                key={plan.id}
                className={`landing-price-card p-6 ${popular ? "landing-price-card--popular md:scale-[1.03]" : ""}`}
              >
                {popular && plan.badge && (
                  <span className="landing-price-badge absolute right-5 top-5 rounded-full px-2.5 py-1 text-[0.625rem] font-bold uppercase tracking-wider">
                    {plan.badge}
                  </span>
                )}
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                    popular ? "bg-white/15 text-white" : "bg-brand-soft text-brand-strong"
                  }`}
                >
                  <Icon size={18} strokeWidth={2} />
                </span>
                <h3 className={`mt-4 text-lg font-bold ${popular ? "text-white" : "text-foreground"}`}>
                  {plan.name}
                </h3>
                <p className={`text-sm ${popular ? "text-white/60" : "text-muted-foreground"}`}>
                  {plan.tagline}
                </p>
                <div className="mt-4 flex items-end gap-1.5">
                  <span className={`text-3xl font-bold tracking-tight ${popular ? "text-white" : "text-foreground"}`}>
                    ${plan.monthlyPrice}
                  </span>
                  <span className={`mb-1 text-xs font-medium ${popular ? "text-white/55" : "text-muted-foreground"}`}>
                    /mo · {plan.screens}
                  </span>
                </div>
                <ul className="mt-5 space-y-2">
                  {plan.features.slice(0, 4).map((feature) => (
                    <li
                      key={feature}
                      className={`flex items-center gap-2 text-sm ${popular ? "text-white/85" : "text-foreground"}`}
                    >
                      <Check
                        size={14}
                        strokeWidth={2.5}
                        className={popular ? "landing-price-check--dark" : "landing-price-check"}
                      />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href={appUrl("/signup")}
                  className={`mt-6 flex h-10 w-full items-center justify-center rounded-lg text-sm font-semibold transition-colors ${
                    popular
                      ? "landing-btn-on-dark"
                      : "landing-btn-ghost"
                  }`}
                >
                  {plan.ctaLabel}
                </Link>
              </div>
            );
          })}
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
            minutes — free for 7 days.
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
        <Link href="/" className="flex items-center gap-2.5">
          <BrandMark icon={layoutConfig.brand.icon} iconSize={16} boxWidth="1.875rem" boxHeight="1.75rem" />
          <span className="text-base font-bold tracking-tight text-foreground">{name}</span>
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
