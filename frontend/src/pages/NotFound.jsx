/**
 * 404 page (route: catch-all "*").
 *
 * Shown for any unmatched route. The "home" link points to the dashboard when
 * the user is authenticated, otherwise to the login page.
 */
import React from 'react';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Button';
import Seo from '../components/Seo';

export default function NotFound() {
  const { user } = useAuth();
  const homeLink = user ? '/app/dashboard' : '/login';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-canvas text-primary px-6 text-center">
      {/* The SPA serves a 200 for every path, so keep this soft-404 out of the index. */}
      <Seo title="Page not found" noindex />
      <p className="text-7xl font-light tracking-tight text-blue">404</p>
      <h1 className="text-2xl font-medium mt-4">Page not found</h1>
      <p className="text-sm text-primary/60 mt-2 mb-8 max-w-sm">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Button to={homeLink}>Back to home</Button>
    </div>
  );
}
