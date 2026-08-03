import React from 'react';
import PropTypes from 'prop-types';

// Brand logo: standard variant in light mode, reversed (light-on-dark) in dark mode.
export default function Logo({ className = '', style }) {
  return (
    <>
      <img
        src="/FrameSet_Logo.png"
        alt="FrameSet"
        className={`${className} dark:hidden`.trim()}
        style={style}
        // Often the page's LCP element (public top bar): fetch it eagerly.
        fetchpriority="high"
      />
      <img
        src="/FrameSet_Logo_Reversed.png"
        alt="FrameSet"
        className={`${className} hidden dark:block`.trim()}
        style={style}
        fetchpriority="high"
      />
    </>
  );
}

Logo.propTypes = {
  className: PropTypes.string,
  style: PropTypes.object,
};
