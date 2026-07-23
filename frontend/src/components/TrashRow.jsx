import React from 'react';
import PropTypes from 'prop-types';
import Card from './Card';
import Button from './Button';

// A single trashed item's row: optional leading visual (e.g. a color swatch),
// name, days-left-before-purge notice, and the Restore / Delete forever pair.
// Used by Dashboard (projects), ProjectPalette (colors) and ProjectNorms
// (standards) — identical shell, only the leading visual and title differ.
export default function TrashRow({
  leading,
  title,
  daysLeft,
  onRestore,
  restoring,
  onDeleteForever,
  busy,
}) {
  return (
    <Card className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="min-w-0 flex items-center gap-3">
        {leading}
        <div className="min-w-0">
          <p className="text-sm font-medium text-primary truncate">{title}</p>
          <p className="text-xs text-primary/60">
            {daysLeft <= 0
              ? 'Will be deleted with the next cleanup'
              : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left before permanent deletion`}
          </p>
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        <Button
          variant="ghost"
          className="text-sm"
          onClick={onRestore}
          loading={restoring}
          disabled={busy}
        >
          Restore
        </Button>
        <Button variant="danger" className="text-sm" disabled={busy} onClick={onDeleteForever}>
          Delete forever
        </Button>
      </div>
    </Card>
  );
}

TrashRow.propTypes = {
  leading: PropTypes.node,
  title: PropTypes.node.isRequired,
  daysLeft: PropTypes.number.isRequired,
  onRestore: PropTypes.func.isRequired,
  restoring: PropTypes.bool,
  onDeleteForever: PropTypes.func.isRequired,
  busy: PropTypes.bool,
};
