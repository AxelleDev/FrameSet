// Placeholder shown on project pages before the active project is available.
import React from 'react';
import PropTypes from 'prop-types';
import Button from './Button';
import Spinner from './Spinner';
import EmptyState from './EmptyState';

// Loading spinner while fetching, else a "project not found" message.
export default function ProjectStatePlaceholder({ loading }) {
  if (loading) {
    return (
      <div className="text-center py-20" role="status" aria-live="polite">
        <Spinner size="lg" className="mx-auto text-blue" />
        <p className="mt-4 text-primary/60">Loading project…</p>
      </div>
    );
  }

  return (
    <div className="py-20">
      <EmptyState
        title="Project not found"
        description="This project doesn't exist or has been deleted."
        action={<Button to="/app/dashboard">Back to dashboard</Button>}
      />
    </div>
  );
}

ProjectStatePlaceholder.propTypes = {
  loading: PropTypes.bool,
};
