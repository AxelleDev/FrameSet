// Public landing page (route: /): the only fully public, indexable page.
// Sets its own SEO head + Schema.org JSON-LD so it can be crawled and shared.
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Seo from '../components/Seo';
import Button from '../components/Button';
import Badge from '../components/Badge';
import Card from '../components/Card';
import PublicTopBar from '../components/PublicTopBar';
import PublicFooter from '../components/PublicFooter';
import ColorTile from '../components/ColorTile';
import ColorFormatToggle from '../components/ColorFormatToggle';
import IconCircle from '../components/IconCircle';
import StandardCard from '../components/StandardCard';
import BrushPreview from '../components/BrushPreview';
import TypographyPreview from '../components/TypographyPreview';

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'FrameSet',
  applicationCategory: 'DesignApplication',
  operatingSystem: 'Web',
  description: "FrameSet keeps every project's graphic standards and color palette in one place.",
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
      { threshold: 0.15 },
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
      detail={
        <div className="mb-2">
          <span className="text-xs text-primary italic">Italic</span>
        </div>
      }
      preview={<TypographyPreview fontFamily="Figtree" fontStyle="Italic" loaded />}
    />
  );
}

/** Mockup for the "Graphic standards" feature — two real standard cards.
    aria-hidden: purely decorative, so its sample titles ("Hair outline") never
    pollute the page outline screen readers navigate by. */
function StandardsMock() {
  return (
    <div aria-hidden="true" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <BrushCard />
      <TypeCard />
    </div>
  );
}

/** Mockup for the "Color palette" feature — the real square swatch grid, with a
    live format toggle so visitors can flip the swatches between HEX/RGB/HSL/HSB. */
function PaletteMock() {
  const [format, setFormat] = useState('hex');
  return (
    <Card className="p-4 sm:p-6">
      <div className="mb-3 flex items-center justify-end gap-2">
        <span className="text-xs text-primary/50">Show as</span>
        <ColorFormatToggle value={format} onChange={setFormat} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        {PALETTE.map((c) => (
          <ColorTile key={c.hex} hex={c.hex} name={c.name} displayFormat={format} />
        ))}
      </div>
    </Card>
  );
}

/** Mockup for the "Export" feature, faithful to ProjectExport: the PDF/JSON
    cards plus the drawing-app palette rows (visual only — this is a mockup). */
function ExportMock() {
  const cards = [
    {
      title: 'PDF style guide',
      icon: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z',
    },
    { title: 'JSON data', icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4' },
  ];
  const paletteFormats = [
    { label: 'Photoshop / Illustrator', ext: '.ase' },
    { label: 'Clip Studio Paint', ext: '.ase' },
    { label: 'Krita / GIMP', ext: '.gpl' },
    { label: 'Procreate', ext: '.swatches' },
  ];
  return (
    // aria-hidden: decorative mockup (nothing interactive inside), so its
    // sample headings never pollute the outline screen readers navigate by.
    <div aria-hidden="true" className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {cards.map((c) => (
          <Card key={c.title} className="p-5">
            <IconCircle>
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d={c.icon} />
              </svg>
            </IconCircle>
            <h3 className="text-sm font-medium text-primary">{c.title}</h3>
          </Card>
        ))}
      </div>
      <Card className="p-5">
        <h4 className="text-[10px] font-bold text-primary uppercase tracking-wider mb-3">
          Palette for your drawing app
        </h4>
        <div className="space-y-2">
          {paletteFormats.map(({ label, ext }) => (
            <div
              key={label}
              className="flex items-center justify-between gap-3 rounded-xl bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary"
            >
              <span className="flex items-center gap-2.5">
                <svg
                  className="w-4 h-4 text-blue"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"
                  />
                </svg>
                {label}
              </span>
              <span className="font-mono text-xs text-primary/60">{ext}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

const FEATURES = [
  {
    title: 'Graphic standards',
    text: 'Document your brushes, sizes, opacities and typography so every project keeps a consistent direction — no more guessing your old settings. Starting something new? Duplicate a project and keep your favorite setup as the base — everything stays one Ctrl+K search away.',
    Mock: StandardsMock,
  },
  {
    title: 'Color palette',
    text: "Build each project's reference palette by hand, pick any pixel on your screen with the system eyedropper, extract it straight from an image, generate harmonies from a base color, or import the .ase, .gpl or Procreate .swatches palette you already have. Reorder, tweak, and view or copy any color — as HEX, RGB, HSL or HSB — in a click.",
    Mock: PaletteMock,
  },
  {
    title: 'Export & share',
    text: 'Turn your standards and palette into a clean PDF or a JSON file, import the palette straight into Photoshop, Clip Studio Paint, Krita or Procreate — or share a live read-only link that clients and collaborators can open without an account.',
    Mock: ExportMock,
  },
];

export default function Landing() {
  const { loginAsDemo } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [demoLoading, setDemoLoading] = useState(false);

  // Same instant, no-account entry as the Login page's demo button, surfaced
  // here so a visitor can try the product without leaving the landing.
  const handleDemoLogin = async () => {
    if (demoLoading) return;
    setDemoLoading(true);
    const result = await loginAsDemo();
    setDemoLoading(false);
    if (result.success) {
      navigate('/app/dashboard');
    } else {
      showToast(result.message || 'The demo is not available right now.', 'danger');
    }
  };

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
            <Badge color="blue">For illustrators &amp; studios</Badge>
            <h1 className="mt-6 text-4xl sm:text-5xl md:text-6xl font-light tracking-tight leading-[1.12] md:leading-[1.05]">
              The graphic reference <br className="hidden sm:block" />
              <span className="font-bold">for your projects.</span>
            </h1>
            <p className="mt-5 text-base sm:text-lg text-primary/60 max-w-xl mx-auto leading-relaxed">
              Keep your graphic standards and color palettes in one place, and pick up any project
              without losing your settings.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button to="/register" fullWidth className="sm:w-auto px-8">
                Create account
              </Button>
              <Button to="/login" variant="outline" fullWidth className="sm:w-auto px-8">
                Sign in
              </Button>
            </div>
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={demoLoading}
              className="mt-5 text-sm text-blue hover:text-primary transition-colors rounded focus-ring disabled:opacity-60"
            >
              {demoLoading ? 'Opening the demo…' : 'or try the demo — no account needed'}
            </button>
            <p className="mt-3 text-xs text-secondary">Free to use · No credit card required</p>
          </div>

          <a
            href="#features"
            onClick={scrollToFeatures}
            aria-label="See how it works"
            className="absolute bottom-6 left-1/2 -translate-x-1/2 p-2 rounded-full text-secondary hover:text-blue transition-colors focus-ring"
          >
            <svg
              className="w-6 h-6 animate-bounce"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </a>
        </section>

        {/* scroll-mt matches the sticky PublicTopBar height (h-16 / sm:h-20)
            plus breathing room, so jumping here (the hero's arrow, or a
            #features link) never tucks the section title under the bar. */}
        <section
          id="features"
          className="scroll-mt-20 sm:scroll-mt-24 max-w-6xl mx-auto px-6 py-4 md:py-8"
          aria-labelledby="features-title"
        >
          <Reveal className="text-center max-w-2xl mx-auto mb-12 md:mb-16">
            <h2
              id="features-title"
              className="text-2xl sm:text-3xl md:text-4xl font-light tracking-tight"
            >
              Everything your art direction needs
            </h2>
            <p className="mt-4 text-primary/60">
              Three simple tools, one consistent reference for every project.
            </p>
          </Reveal>

          <div className="space-y-16 md:space-y-28">
            {FEATURES.map((feature, i) => {
              const Mock = feature.Mock;
              const reverse = i % 2 === 1;
              return (
                <div
                  key={feature.title}
                  className="grid md:grid-cols-2 gap-6 md:gap-16 items-center"
                >
                  <Reveal className={reverse ? 'md:order-2' : ''}>
                    <span className="text-5xl md:text-6xl font-light text-blue/30">0{i + 1}</span>
                    <h3 className="mt-2 text-2xl md:text-3xl font-medium">{feature.title}</h3>
                    <p className="mt-3 md:mt-4 text-primary/60 leading-relaxed max-w-md">
                      {feature.text}
                    </p>
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
          <Reveal className="bg-surface rounded-3xl px-6 py-12 md:px-10 md:py-16 text-center">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-light tracking-tight">
              Start your <span className="font-bold">reference</span> today.
            </h2>
            <p className="mt-4 text-primary/60 max-w-md mx-auto">
              Create your account and structure the graphic foundations of your next project in
              minutes.
            </p>
            <div className="mt-8 flex justify-center">
              <Button to="/register" className="px-10">
                Create account
              </Button>
            </div>
          </Reveal>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
