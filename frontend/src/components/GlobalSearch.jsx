import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import Modal from './Modal';
import TextInput from './TextInput';
import Spinner from './Spinner';
import ConfirmDialog from './ConfirmDialog';
import api from '../services/api';
import logger from '../utils/logger';
import { getHasUnsavedChanges } from '../utils/unsavedChangesStore';

const DEBOUNCE_MS = 250;

// One result row: main label on the left, dimmed context on the right.
function ResultRow({ onSelect, leading, label, context }) {
  return (
    <button
      type="button"
      data-search-result
      onClick={onSelect}
      className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-primary hover:bg-blue/10 focus-ring"
    >
      {leading}
      <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
      {context && <span className="shrink-0 text-xs text-primary/50 truncate">{context}</span>}
    </button>
  );
}

ResultRow.propTypes = {
  onSelect: PropTypes.func.isRequired,
  leading: PropTypes.node,
  label: PropTypes.node.isRequired,
  context: PropTypes.node,
};

function GroupHeading({ children }) {
  return (
    <p className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-primary/50">
      {children}
    </p>
  );
}

GroupHeading.propTypes = { children: PropTypes.node };

export default function GlobalSearch({ isOpen, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null); // null until a search ran
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  const navigate = useNavigate();
  const panelRef = useRef(null);
  // Path awaiting confirmation from the unsaved-changes dialog below (see goTo).
  const [pendingPath, setPendingPath] = useState(null);

  // Fresh field every time the palette opens.
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults(null);
      setFailed(false);
    }
  }, [isOpen]);

  // Debounced server search; aborted when the query changes or the modal closes.
  useEffect(() => {
    if (!isOpen) return undefined;
    const trimmed = query.trim();
    if (!trimmed) {
      setResults(null);
      setSearching(false);
      setFailed(false);
      return undefined;
    }

    const controller = new AbortController();
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const data = await api.get(`/projects/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        setResults(data);
        setFailed(false);
        setSearching(false);
      } catch (error) {
        if (error?.name === 'AbortError') return;
        logger.error('search.query.error', error);
        setFailed(true);
        setSearching(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [isOpen, query]);

  // Same guard as the sidebar links: leaving a dirty page needs confirmation,
  // via the same styled dialog rather than the browser's own window.confirm.
  const goTo = (path) => {
    if (getHasUnsavedChanges()) {
      setPendingPath(path);
      return;
    }
    onClose();
    navigate(path);
  };

  const confirmPendingPath = () => {
    const path = pendingPath;
    setPendingPath(null);
    onClose();
    navigate(path);
  };

  const cancelPendingPath = () => setPendingPath(null);

  // Arrow keys move through the input + result rows as one list.
  const handleKeyDown = (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const stops = Array.from(
      panelRef.current?.querySelectorAll('input, [data-search-result]') || [],
    );
    if (!stops.length) return;
    event.preventDefault();
    const currentIndex = stops.indexOf(document.activeElement);
    const step = event.key === 'ArrowDown' ? 1 : -1;
    stops[(currentIndex + step + stops.length) % stops.length].focus();
  };

  const projects = results?.projects || [];
  const colors = results?.colors || [];
  const brushNorms = results?.brushNorms || [];
  const typographyNorms = results?.typographyNorms || [];
  const hasMatches =
    projects.length + colors.length + brushNorms.length + typographyNorms.length > 0;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Search"
        subtitle="Projects, colors and standards — Esc to close."
        showClose={false}
        panelClassName="bg-surface w-full max-w-xl rounded-3xl p-4 sm:p-6 max-h-[85dvh] overflow-y-auto"
      >
        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- keydown implements the list's arrow-key pattern, not a click substitute */}
        <div ref={panelRef} onKeyDown={handleKeyDown}>
          <TextInput
            type="search"
            role="searchbox"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects, colors, standards…"
            aria-label="Search projects, colors and standards"
            // eslint-disable-next-line jsx-a11y/no-autofocus -- focus belongs in the field when a search palette opens
            autoFocus
          />

          <div className="mt-2" role="status" aria-live="polite">
            {searching && (
              <div className="flex items-center gap-2 px-3 py-3 text-sm text-primary/60">
                <Spinner size="sm" /> Searching…
              </div>
            )}

            {failed && !searching && (
              <p className="px-3 py-3 text-sm text-danger">
                The search failed. Check your connection and try again.
              </p>
            )}

            {!searching && !failed && results && !hasMatches && (
              <p className="px-3 py-3 text-sm text-primary/60">No matches for “{query.trim()}”.</p>
            )}

            {!searching && !failed && hasMatches && (
              <div className="space-y-1">
                {projects.length > 0 && (
                  <>
                    <GroupHeading>Projects</GroupHeading>
                    {projects.map((project) => (
                      <ResultRow
                        key={`project-${project.id}`}
                        label={project.name}
                        onSelect={() => goTo(`/app/project/${project.id}/norms`)}
                      />
                    ))}
                  </>
                )}

                {colors.length > 0 && (
                  <>
                    <GroupHeading>Colors</GroupHeading>
                    {colors.map((color) => (
                      <ResultRow
                        key={`color-${color.id}`}
                        leading={
                          <span
                            aria-hidden="true"
                            className="h-5 w-5 shrink-0 rounded-full ring-1 ring-primary/10"
                            style={{ backgroundColor: color.hex }}
                          />
                        }
                        label={
                          <>
                            {color.name || color.hex}
                            <span className="ml-2 font-mono text-xs text-primary/50">
                              {color.hex}
                            </span>
                          </>
                        }
                        context={color.projectName}
                        onSelect={() => goTo(`/app/project/${color.projectId}/palette`)}
                      />
                    ))}
                  </>
                )}

                {brushNorms.length > 0 && (
                  <>
                    <GroupHeading>Brushes</GroupHeading>
                    {brushNorms.map((norm) => (
                      <ResultRow
                        key={`brush-${norm.id}`}
                        label={norm.name}
                        context={norm.projectName}
                        onSelect={() => goTo(`/app/project/${norm.projectId}/norms`)}
                      />
                    ))}
                  </>
                )}

                {typographyNorms.length > 0 && (
                  <>
                    <GroupHeading>Typography</GroupHeading>
                    {typographyNorms.map((norm) => (
                      <ResultRow
                        key={`typo-${norm.id}`}
                        label={norm.fontFamily}
                        context={norm.fontUsage || norm.projectName}
                        onSelect={() => goTo(`/app/project/${norm.projectId}/norms`)}
                      />
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={pendingPath !== null}
        title="Leave this page?"
        message="You have unsaved changes. Leave this page without saving?"
        confirmLabel="Leave"
        cancelLabel="Cancel"
        onConfirm={confirmPendingPath}
        onCancel={cancelPendingPath}
        primaryVariant="primary"
      />
    </>
  );
}

GlobalSearch.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
};
