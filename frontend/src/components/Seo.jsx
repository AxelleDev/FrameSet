import React from 'react';
import PropTypes from 'prop-types';
import { Helmet } from 'react-helmet-async';

/**
 * Per-page SEO/head manager. Sets a unique <title> + meta description, the
 * canonical URL, Open Graph + Twitter Card tags, an optional noindex directive
 * (for private app screens), and optional JSON-LD structured data.
 *
 * The absolute site origin is read from VITE_SITE_URL at build time; set it in
 * the deploy environment so canonical/OG URLs are correct.
 *
 * @param {object} props
 * @param {string} [props.title] - Page title (suffixed with the site name).
 * @param {string} [props.description] - Meta description (unique per page).
 * @param {string} [props.path] - Route path for the canonical/OG URL (e.g. "/login").
 * @param {string} [props.image] - Absolute URL of the social share image (1200×630).
 * @param {boolean} [props.noindex] - When true, asks crawlers not to index the page.
 * @param {'website'|'article'} [props.type] - Open Graph type.
 * @param {object} [props.jsonLd] - Schema.org JSON-LD object injected as a script.
 */
const SITE_NAME = 'FrameSet';
const SITE_URL = (import.meta.env.VITE_SITE_URL || 'https://frameset.app').replace(/\/$/, '');
const DEFAULT_DESCRIPTION =
  'FrameSet centralise les normes graphiques et la palette de couleurs de chaque projet, au même endroit.';
const DEFAULT_IMAGE = `${SITE_URL}/og-cover.png`;

export default function Seo({
  title,
  description = DEFAULT_DESCRIPTION,
  path = '',
  image = DEFAULT_IMAGE,
  noindex = false,
  type = 'website',
  jsonLd,
}) {
  const fullTitle = title ? `${title} — ${SITE_NAME}` : `${SITE_NAME} — Le référentiel graphique de vos projets`;
  const canonical = `${SITE_URL}${path}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph */}
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={image} />
      <meta property="og:locale" content="fr_FR" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {jsonLd && <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>}
    </Helmet>
  );
}

Seo.propTypes = {
  title: PropTypes.string,
  description: PropTypes.string,
  path: PropTypes.string,
  image: PropTypes.string,
  noindex: PropTypes.bool,
  type: PropTypes.oneOf(['website', 'article']),
  jsonLd: PropTypes.object,
};
