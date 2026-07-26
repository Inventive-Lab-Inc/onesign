import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  CalendarClock,
  Globe,
  Layers,
  LayoutGrid,
  Monitor,
  Rocket,
  ShieldCheck,
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
import "./landing.css";

export interface VerticalConfig {
  slug: string;
  heroTitle: string;
  heroAccent: string;
  heroDescription: string;
  introParagraph: string;
  heroImageSrc: string;
  heroImageAlt: string;
}

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

export function VerticalLandingPage({
  vertical,
  plans,
  currency: _currency = "USD",
}: {
  vertical: VerticalConfig;
  plans?: PlanViewModel[];
  currency?: PlanCurrency;
}) {
  const { name } = layoutConfig.brand;
  const pricingPlans = plans && plans.length > 0 ? plans : STATIC_PLAN_VIEW_MODELS;

  return (
    <div className="landing">
      <VerticalNav name={name} />
      <VerticalHero vertical={vertical} name={name} />
      <Features />
      <HowItWorks />
      <LandingPricingSection plans={pricingPlans} />
      <FinalCta />
      <Footer name={name} />
      <LandingLiveChat />
    </div>
  );
}

function VerticalNav({ name }: { name: string }) {
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

function VerticalHero({ vertical, name }: { vertical: VerticalConfig; name: string }) {
  return (
    <section className="landing-hero landing-hero-grid relative px-5 pt-16 pb-20 sm:pt-24">
      <div className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
        <div className="landing-reveal text-center lg:text-left">
          <span className="landing-eyebrow mb-5 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold">
            <Zap size={13} strokeWidth={2.5} />
            Digital signage, simplified
          </span>
          <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-5xl lg:text-[3.5rem]">
            {vertical.heroTitle}
            <br />
            <span className="landing-title-accent">{vertical.heroAccent}</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground lg:mx-0">
            {vertical.heroDescription}
          </p>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground lg:mx-0">
            {vertical.introParagraph}
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

        <div className="landing-reveal relative mx-auto w-full max-w-sm sm:max-w-md lg:max-w-none">
          <div className="landing-showcase-stage relative aspect-[3/2] overflow-hidden rounded-2xl">
            <Image
              src={vertical.heroImageSrc}
              alt={vertical.heroImageAlt}
              fill
              sizes="(min-width: 1152px) 560px, (min-width: 640px) 448px, 384px"
              priority
              className="object-cover"
            />
          </div>
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
