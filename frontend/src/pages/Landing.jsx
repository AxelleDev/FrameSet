// Public landing page (route: /): the only fully public, indexable page.
// Sets its own SEO head + Schema.org JSON-LD so it can be crawled and shared.
import React, { useEffect, useRef, useState } from 'react';
import Seo from '../components/Seo';
import Logo from '../components/Logo';
import Button from '../components/Button';
import PublicTopBar from '../components/PublicTopBar';
import ColorTile from '../components/ColorTile';
import StandardCard from '../components/StandardCard';
import BrushPreview from '../components/BrushPreview';
import TypographyPreview from '../components/TypographyPreview';

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'FrameSet',
  applicationCategory: 'DesignApplication',
  operatingSystem: 'Web',
  description:
    'FrameSet keeps every project\'s graphic standards and color palette in one place.',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
};

// Sample palette shown in the mockups — real colors from the "Alyse Twitch
// Emotes" reference project.
const PALETTE = [
  { hex: '#DBE7E5', name: 'Hair Base Colors' },
  { hex: '#A4BDBA', name: 'Hair Shadows' },
  { hex: '#558AA3', name: 'Eye Base Color' },
  { hex: '#E0E5FC', name: 'Hepatica Anemone' },
  { hex: '#FFEDE8', name: 'Skin Base Color' },
  { hex: '#FCBFC4', name: 'Blush Color' },
];

/** Reveals its children with a fade-up once they scroll into view. */
function Reveal({ children, className = '', delay = 0 }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`.trim()}
    >
      {children}
    </div>
  );
}

/** A brush standard card — the exact same StandardCard used by ProjectNorms
    and the Shared reference sheet, not a lookalike. */
function BrushCard() {
  return (
    <StandardCard
      category="Brush"
      badgeColor="primary"
      title="Hair outline"
      value="8"
      unit="px"
      detail={<div className="text-xs text-secondary mb-2">Opacity: 0.9</div>}
      preview={<BrushPreview value="8" opacity={0.9} brushName="Plume G" />}
    />
  );
}

/** A typography standard card — the exact same StandardCard used by
    ProjectNorms and the Shared reference sheet, not a lookalike. Figtree is
    the app's self-hosted base font, so it's already "loaded" here. */
function TypeCard() {
  return (
    <StandardCard
      category="Typography"
      badgeColor="blue"
      title="Heading"
      value="Figtree"
      valueTitle="Figtree"
      valueTruncate
      unit="700"
      detail={<div className="mb-2"><span className="text-xs text-primary italic">Italic</span></div>}
      preview={<TypographyPreview fontFamily="Figtree" fontStyle="Italic" loaded />}
    />
  );
}

/** Mockup for the "Graphic standards" feature — two real standard cards. */
function StandardsMock() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <BrushCard />
      <TypeCard />
    </div>
  );
}

/** Mockup for the "Color palette" feature — the real square swatch grid. */
function PaletteMock() {
  return (
    <div className="bg-surface rounded-3xl ring-1 ring-primary/5 p-4 sm:p-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        {PALETTE.map((c) => <ColorTile key={c.hex} hex={c.hex} name={c.name} />)}
      </div>
    </div>
  );
}

/** Mockup for the "Export" feature, faithful to ProjectExport. */
function ExportMock() {
  const cards = [
    { title: 'PDF style guide', icon: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z' },
    { title: 'JSON data', icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4' },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {cards.map((c) => (
          <div key={c.title} className="bg-surface rounded-3xl ring-1 ring-primary/5 p-5">
            <div className="h-12 w-12 bg-blue/15 text-blue rounded-full flex items-center justify-center mb-4">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d={c.icon} />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-primary">{c.title}</h3>
          </div>
        ))}
      </div>
      <div className="bg-surface rounded-3xl ring-1 ring-primary/5 p-5">
        <h4 className="text-[10px] font-bold text-primary uppercase tracking-wider mb-3">JSON output preview</h4>
        <div className="bg-primary/5 rounded-2xl p-4">
          <pre className="text-[11px] text-primary/70 font-mono leading-relaxed whitespace-pre-wrap break-words">{`{
  "name": "Alyse Twitch Emotes",
  "palette": ["#DBE7E5", "#558AA3"],
  "brushNorms": [{ "name": "Hair outline" }]
}`}</pre>
        </div>
      </div>
    </div>
  );
}

const FEATURES = [
  {
    title: 'Graphic standards',
    text: 'Document your brushes, sizes, opacities and typography so every project keeps a consistent direction — no more guessing your old settings. Starting something new? Duplicate a project and keep your favorite setup as the base.',
    Mock: StandardsMock,
  },
  {
    title: 'Color palette',
    text: 'Build each project\'s reference palette by hand, or extract it straight from an image. Reorder, tweak and copy any color in a click.',
    Mock: PaletteMock,
  },
  {
    title: 'Export & share',
    text: 'Turn your standards and palette into a clean PDF or a JSON file — or share a live read-only link that clients and collaborators can open without an account.',
    Mock: ExportMock,
  },
];

export default function Landing() {
  // Smoothly scroll to the features section (honors reduced-motion).
  const scrollToFeatures = (e) => {
    e.preventDefault();
    const el = document.getElementById('features');
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };

  return (
    <div className="relative min-h-dvh flex flex-col bg-canvas text-primary">
      <Seo
        path="/"
        description="FrameSet keeps every project's graphic standards and color palette in one place. Create your graphic reference in just a few minutes."
        jsonLd={JSON_LD}
      />

      <PublicTopBar />

      <main className="relative flex-1">
        <section className="relative min-h-[calc(100dvh-4rem)] sm:min-h-[calc(100dvh-5rem)] flex flex-col items-center justify-center text-center px-6 pt-8 pb-20 animate-fade-in">
          <div className="max-w-3xl">
            <span className="inline-block text-[11px] sm:text-xs font-bold uppercase tracking-widest text-blue bg-blue/15 px-3 py-1 rounded-full">For illustrators &amp; studios</span>
            <h1 className="mt-6 text-4xl sm:text-5xl md:text-6xl font-light tracking-tight leading-[1.12] md:leading-[1.05]">
              The graphic reference <br className="hidden sm:block" />
              <span className="font-bold">for your projects.</span>
            </h1>
            <p className="mt-5 text-base sm:text-lg text-primary/70 max-w-xl mx-auto leading-relaxed">
              Keep your graphic standards and color palettes in one place, and pick up
              any project without losing your settings.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button to="/register" fullWidth className="sm:w-auto px-8">Create account</Button>
              <Button to="/login" variant="outline" fullWidth className="sm:w-auto px-8">Sign in</Button>
            </div>
            <p className="mt-4 text-xs text-secondary">Free to use · No credit card required</p>
          </div>

          <a href="#features" onClick={scrollToFeatures} aria-label="See how it works" className="absolute bottom-6 left-1/2 -translate-x-1/2 p-2 rounded-full text-secondary hover:text-blue transition-colors focus-ring">
            <svg className="w-6 h-6 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </a>
        </section>

        <section id="features" className="scroll-mt-6 max-w-6xl mx-auto px-6 py-4 md:py-8" aria-labelledby="features-title">
          <Reveal className="text-center max-w-2xl mx-auto mb-12 md:mb-16">
            <h2 id="features-title" className="text-2xl sm:text-3xl md:text-4xl font-light tracking-tight">
              Everything your art direction needs
            </h2>
            <p className="mt-4 text-primary/70">Three simple tools, one consistent reference for every project.</p>
          </Reveal>

          <div className="space-y-16 md:space-y-28">
            {FEATURES.map((feature, i) => {
              const Mock = feature.Mock;
              const reverse = i % 2 === 1;
              return (
                <div key={feature.title} className="grid md:grid-cols-2 gap-6 md:gap-16 items-center">
                  <Reveal className={reverse ? 'md:order-2' : ''}>
                    <span className="text-5xl md:text-6xl font-light text-blue/30">0{i + 1}</span>
                    <h3 className="mt-2 text-2xl md:text-3xl font-medium">{feature.title}</h3>
                    <p className="mt-3 md:mt-4 text-primary/70 leading-relaxed max-w-md">{feature.text}</p>
                  </Reveal>
                  <Reveal delay={100} className={reverse ? 'md:order-1' : ''}>
                    <Mock />
                  </Reveal>
                </div>
              );
            })}
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-6 py-16 md:py-24">
          <Reveal className="bg-surface ring-1 ring-primary/5 rounded-[1.75rem] md:rounded-[2rem] px-6 py-12 md:px-10 md:py-16 text-center">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-light tracking-tight">
              Start your <span className="font-bold">reference</span> today.
            </h2>
            <p className="mt-4 text-primary/70 max-w-md mx-auto">
              Create your account and structure the graphic foundations of your next project in minutes.
            </p>
            <div className="mt-8 flex justify-center">
              <Button to="/register" className="px-10">Create account</Button>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="relative border-t border-primary/10">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-primary/60">
          <Logo className="object-contain w-1/5 max-w-[80px] h-auto" />
          <p>© {new Date().getFullYear()} FrameSet. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
