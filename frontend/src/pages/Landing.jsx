/**
 * Public landing page (route: /).
 *
 * The only fully public, indexable page: it presents the product, its value and
 * a clear call to action. Unlike the app screens it is reachable without auth so
 * it can be crawled and shared. Sets its own SEO head + Schema.org JSON-LD.
 */
import React from 'react';
import Seo from '../components/Seo';
import Logo from '../components/Logo';
import Button from '../components/Button';
import ThemeToggle from '../components/ThemeToggle';

const FEATURES = [
  {
    title: 'Graphic standards',
    text: 'Document brushes, sizes, opacities and typography to keep a consistent direction.',
  },
  {
    title: 'Color palette',
    text: 'Build each project\'s reference palette, by hand or extracted from an image.',
  },
  {
    title: 'Export',
    text: 'Get your standards and palette as PDF or JSON, ready to share.',
  },
];

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

export default function Landing() {
  return (
    <div className="relative min-h-screen flex flex-col bg-canvas text-primary">
      <Seo
        path="/"
        description="FrameSet keeps every project's graphic standards and color palette in one place. Create your graphic reference in just a few minutes."
        jsonLd={JSON_LD}
      />

      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      <main className="flex-1 flex flex-col justify-center">
        <div className="w-full max-w-5xl mx-auto px-6 py-20">
        <section className="text-center max-w-2xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-light tracking-tight leading-tight">
            The graphic reference <br />
            <span className="font-bold">for your projects.</span>
          </h1>
          <p className="mt-6 text-lg text-primary/70 max-w-xl mx-auto leading-relaxed">
            Keep your graphic standards and color palettes in one place, and pick up
            any project without losing your settings.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button to="/register" fullWidth className="sm:w-auto px-8">Create account</Button>
            <Button to="/login" variant="outline" fullWidth className="sm:w-auto px-8">Sign in</Button>
          </div>
        </section>

        <section className="mt-16" aria-labelledby="features-title">
          <h2 id="features-title" className="sr-only">Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {FEATURES.map((feature) => (
              <article key={feature.title} className="bg-surface rounded-3xl p-8">
                <h3 className="text-lg font-medium mb-2">{feature.title}</h3>
                <p className="text-sm text-primary/70 leading-relaxed">{feature.text}</p>
              </article>
            ))}
          </div>
        </section>
        </div>
      </main>

      <footer className="border-t border-primary/10">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-primary/60">
          <Logo className="object-contain" style={{ width: '20%', maxWidth: '80px', height: 'auto' }} />
          <p>© 2026 FrameSet. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
