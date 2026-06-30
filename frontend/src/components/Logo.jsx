import React from 'react';
import PropTypes from 'prop-types';

/**
 * Brand logo. Shows the standard logo in light mode and the reversed
 * (light-on-dark) variant in dark mode. Sizing/positioning are passed through
 * via `className` / `style`.
 *
 * @param {object} props
 * @param {string} [props.className] - Layout/sizing classes.
 * @param {object} [props.style] - Inline style overrides.
 */
export default function Logo({ className = '', style }) {
  return (
    <>
      <img
        src="/FrameSet_Logo.png"
        alt="FrameSet"
        className={`${className} dark:hidden`.trim()}
        style={style}
      />
      <img
        src="/FrameSet_Logo_Reversed.png"
        alt=""
        aria-hidden="true"
        className={`${className} hidden dark:block`.trim()}
        style={style}
      />
    </>
  );
}

Logo.propTypes = {
  className: PropTypes.string,
  style: PropTypes.object,
};
