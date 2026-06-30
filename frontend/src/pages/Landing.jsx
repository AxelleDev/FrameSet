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
    title: 'Normes graphiques',
    text: 'Documentez brosses, tailles, opacités et typographies pour garder une direction cohérente.',
  },
  {
    title: 'Palette de couleurs',
    text: 'Construisez la palette de référence de chaque projet, à la main ou extraite d’une image.',
  },
  {
    title: 'Export',
    text: 'Récupérez vos normes et votre palette en PDF ou en JSON, prêts à partager.',
  },
];

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'FrameSet',
  applicationCategory: 'DesignApplication',
  operatingSystem: 'Web',
  description:
    'FrameSet centralise les normes graphiques et la palette de couleurs de chaque projet, au même endroit.',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
};

export default function Landing() {
  return (
    <div className="relative min-h-screen flex flex-col bg-canvas text-primary">
      <Seo
        path="/"
        description="FrameSet centralise les normes graphiques et la palette de couleurs de chaque projet, au même endroit. Créez votre référentiel graphique en quelques minutes."
        jsonLd={JSON_LD}
      />

      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      <main className="flex-1 flex flex-col justify-center">
        <div className="w-full max-w-5xl mx-auto px-6 py-20">
        <section className="text-center max-w-2xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-light tracking-tight leading-tight">
            Le référentiel graphique <br />
            <span className="font-bold">de vos projets.</span>
          </h1>
          <p className="mt-6 text-lg text-primary/70 max-w-xl mx-auto leading-relaxed">
            Centralisez normes graphiques et palettes de couleurs au même endroit, et reprenez
            n’importe quel projet sans perdre vos réglages.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button to="/register" fullWidth className="sm:w-auto px-8">Créer un compte</Button>
            <Button to="/login" variant="outline" fullWidth className="sm:w-auto px-8">Se connecter</Button>
          </div>
        </section>

        <section className="mt-16" aria-labelledby="features-title">
          <h2 id="features-title" className="sr-only">Fonctionnalités</h2>
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
          <p>© 2026 FrameSet. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
}
