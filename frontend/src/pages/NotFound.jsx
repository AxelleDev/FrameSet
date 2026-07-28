// 404 page (catch-all route "*"): home link goes to the dashboard when authed,
// otherwise to login. Sits outside the authenticated app shell, so it gets the
// same public chrome (PublicTopBar/PublicFooter) as every other out-of-app page.
import React from 'react';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Button';
import Seo from '../components/Seo';
import PublicTopBar from '../components/PublicTopBar';
import PublicFooter from '../components/PublicFooter';

export default function NotFound() {
  const { user } = useAuth();
  const homeLink = user ? '/app/dashboard' : '/login';

  return (
    <div className="min-h-dvh flex flex-col bg-canvas text-primary">
      {/* The SPA serves a 200 for every path, so keep this soft-404 out of the index. */}
      <Seo title="Page not found" noindex />
      <PublicTopBar />

      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <p className="text-6xl sm:text-7xl font-light tracking-tight text-blue">404</p>
        <h1 className="text-2xl font-medium mt-4">Page not found</h1>
        <p className="text-sm text-primary/60 mt-2 mb-8 max-w-sm">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Button to={homeLink}>Back to home</Button>
      </main>

      <PublicFooter />
    </div>
  );
}
