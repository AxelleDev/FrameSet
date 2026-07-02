// Placeholder shown on project pages before the active project is available.
import React from 'react';
import PropTypes from 'prop-types';
import Button from './Button';

// Loading spinner while fetching, else a "project not found" message.
export default function ProjectStatePlaceholder({ loading }) {
  if (loading) {
    return (
      <div className="text-center py-20" role="status" aria-live="polite">
        <div className="border-4 border-blue/20 border-t-blue rounded-full w-10 h-10 mx-auto animate-spin"></div>
        <p className="mt-4 text-primary/60">Loading project…</p>
      </div>
    );
  }

  return (
    <div className="text-center py-20">
      <p className="text-lg font-medium text-primary mb-2">Project not found</p>
      <p className="text-sm text-primary/60 mb-6">This project doesn't exist or has been deleted.</p>
      <Button to="/app/dashboard">Back to dashboard</Button>
    </div>
  );
}

ProjectStatePlaceholder.propTypes = {
  loading: PropTypes.bool,
};
