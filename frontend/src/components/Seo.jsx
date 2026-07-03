import React from 'react';
import PropTypes from 'prop-types';
import { Helmet } from 'react-helmet-async';

/**
 * Per-page SEO/head manager: title, meta description, canonical URL, Open Graph
 * + Twitter Card tags, optional noindex and JSON-LD.
 * Site origin comes from VITE_SITE_URL at build time; set it in the deploy env
 * so canonical/OG URLs are correct.
 */
const SITE_NAME = 'FrameSet';
const SITE_URL = (import.meta.env.VITE_SITE_URL || 'https://frameset.app').replace(/\/$/, '');
const DEFAULT_DESCRIPTION =
  'FrameSet keeps every project\'s graphic standards and color palette in one place.';
// Brand logo as a safe default that always exists; swap for a dedicated
// 1200×630 `og-cover.png` for richer link previews.
const DEFAULT_IMAGE = `${SITE_URL}/FrameSet_Logo.png`;

export default function Seo({
  title,
  description = DEFAULT_DESCRIPTION,
  path = '',
  image = DEFAULT_IMAGE,
  noindex = false,
  type = 'website',
  jsonLd,
}) {
  const fullTitle = title ? `${title} — ${SITE_NAME}` : `${SITE_NAME} — The graphic reference for your projects`;
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
      <meta property="og:locale" content="en_US" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {/* Escape '<' so a value containing "</script>" can never break out of the
          script context (defense in depth — current JSON-LD is static). */}
      {jsonLd && <script type="application/ld+json">{JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>}
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
