// Generic CRUD for a project's brush/typography standards. Both kinds share
// the exact same lifecycle (add, trash, restore, permanent delete, update,
// reorder) — this hook is instantiated once per kind from ProjectContext
// instead of maintaining two near-identical ~200-line copies of the same logic.
import { useCallback } from 'react';
import api from '../services/api';
import logger from '../utils/logger';

/**
 * @param {'BrushNorm' | 'TypographyNorm'} kind Used only to build log event
 *   names identical to the ones each copy used to log by hand (e.g.
 *   'projects.addBrushNorm.error', 'projects.reorderTypographyNorms.error').
 * @param {'brushNorms' | 'typographyNorms'} fieldName The project field holding this kind's items.
 * @param {'brush-norms' | 'typography-norms'} apiSegment The REST path segment for this kind.
 */
export default function useNormActions({
  kind,
  fieldName,
  apiSegment,
  isDemo,
  projects,
  setProjects,
  setGlobalError,
  nextDemoId,
  trashedItems,
  setTrashedItems,
  trashedItemsRef,
}) {
  const patchProject = useCallback(
    (projectId, updater) =>
      setProjects((prevProjects) =>
        prevProjects.map((project) =>
          String(project.id) === String(projectId) ? updater(project) : project,
        ),
      ),
    [setProjects],
  );

  // Adds a norm using the server-assigned id (or a local demo id); bumps normsCount.
  const addNorm = useCallback(
    async (projectId, norm) => {
      if (isDemo) {
        const normWithId = { ...norm, id: nextDemoId() };
        patchProject(projectId, (project) => ({
          ...project,
          [fieldName]: [...(project[fieldName] || []), normWithId],
          normsCount: (project.normsCount || 0) + 1,
        }));
        return normWithId;
      }

      try {
        const data = await api.post(`/projects/${projectId}/${apiSegment}`, norm, {
          onGlobalError: setGlobalError,
        });
        const normWithId = { ...norm, id: data.id };
        patchProject(projectId, (project) => ({
          ...project,
          [fieldName]: [...(project[fieldName] || []), normWithId],
          normsCount: (project.normsCount || 0) + 1,
        }));
        return normWithId;
      } catch (error) {
        setGlobalError(error?.message || 'Failed to add the standard.');
        logger.error(`projects.add${kind}.error`, error);
        return null;
      }
    },
    // nextDemoId is deliberately not a dependency: it closes over a stable ref
    // (see nextDemoIdRef in ProjectContext) and is redefined every render, so
    // including it would give addNorm a new identity on every render too.
    [isDemo, apiSegment, fieldName, kind, patchProject, setGlobalError],
  );

  // Fetches this project's trashed norms of this kind (small list, with days left).
  const fetchTrashedNorms = useCallback(
    async (projectId, { silent = false } = {}) => {
      if (!projectId) {
        setTrashedItems([]);
        return [];
      }
      // The demo account's norm trash is simulated locally (see deleteNorm below).
      if (isDemo) {
        return trashedItemsRef.current;
      }
      try {
        const options = silent ? undefined : { onGlobalError: setGlobalError };
        const data = await api.get(`/projects/${projectId}/${apiSegment}/trash`, options);
        const fetched = data?.norms || [];
        setTrashedItems(fetched);
        return fetched;
      } catch (error) {
        logger.error(`projects.fetchTrashed${kind}s.error`, error);
        return [];
      }
    },
    [isDemo, apiSegment, kind, setTrashedItems, trashedItemsRef, setGlobalError],
  );

  // Moves a norm to the trash (soft delete) and decrements normsCount. The
  // trash list is refreshed silently so the page's trash section stays accurate.
  const deleteNorm = useCallback(
    async (projectId, normId) => {
      const normIdNum = Number(normId);

      if (isDemo) {
        const project = projects.find((p) => String(p.id) === String(projectId));
        const target = project?.[fieldName]?.find((norm) => Number(norm.id) === normIdNum);
        patchProject(projectId, (p) => ({
          ...p,
          [fieldName]: p[fieldName].filter((norm) => Number(norm.id) !== normIdNum),
          normsCount: (p.normsCount || 0) - 1,
        }));
        if (target) {
          setTrashedItems((prev) => [{ ...target, daysLeft: 30 }, ...prev]);
        }
        return true;
      }

      try {
        await api.delete(`/projects/${projectId}/${apiSegment}/${normIdNum}`, null, {
          onGlobalError: setGlobalError,
        });
        patchProject(projectId, (project) => ({
          ...project,
          [fieldName]: project[fieldName].filter((norm) => Number(norm.id) !== normIdNum),
          normsCount: (project.normsCount || 0) - 1,
        }));
        fetchTrashedNorms(projectId, { silent: true });
        return true;
      } catch (error) {
        setGlobalError(error?.message || 'Failed to delete the standard.');
        logger.error(`projects.delete${kind}.error`, error);
        return false;
      }
    },
    [
      isDemo,
      projects,
      fieldName,
      apiSegment,
      kind,
      patchProject,
      setTrashedItems,
      setGlobalError,
      fetchTrashedNorms,
    ],
  );

  // Restores a trashed norm, appending it back using the data already held in
  // the trash list, and bumps normsCount.
  const restoreNorm = useCallback(
    async (projectId, normId) => {
      const applyRestore = () => {
        const restored = trashedItems.find((norm) => String(norm.id) === String(normId));
        setTrashedItems((prev) => prev.filter((norm) => String(norm.id) !== String(normId)));
        if (restored) {
          patchProject(projectId, (project) => ({
            ...project,
            [fieldName]: [...(project[fieldName] || []), restored],
            normsCount: (project.normsCount || 0) + 1,
          }));
        }
      };

      if (isDemo) {
        applyRestore();
        return true;
      }

      try {
        await api.post(
          `/projects/${projectId}/${apiSegment}/${normId}/restore`,
          {},
          { onGlobalError: setGlobalError },
        );
        applyRestore();
        return true;
      } catch (error) {
        setGlobalError(error?.message || 'Failed to restore the standard.');
        logger.error(`projects.restore${kind}.error`, error);
        return false;
      }
    },
    [
      isDemo,
      trashedItems,
      apiSegment,
      fieldName,
      kind,
      patchProject,
      setTrashedItems,
      setGlobalError,
    ],
  );

  // Permanently deletes a TRASHED norm; irreversible.
  const deleteNormPermanently = useCallback(
    async (projectId, normId) => {
      if (isDemo) {
        setTrashedItems((prev) => prev.filter((norm) => String(norm.id) !== String(normId)));
        return true;
      }

      try {
        await api.delete(`/projects/${projectId}/${apiSegment}/${normId}/permanent`, null, {
          onGlobalError: setGlobalError,
        });
        setTrashedItems((prev) => prev.filter((norm) => String(norm.id) !== String(normId)));
        return true;
      } catch (error) {
        setGlobalError(error?.message || 'Failed to delete the standard.');
        logger.error(`projects.delete${kind}Permanently.error`, error);
        return false;
      }
    },
    [isDemo, apiSegment, kind, setTrashedItems, setGlobalError],
  );

  // Updates fields of an existing norm, merging `updates` locally.
  const updateNorm = useCallback(
    async (projectId, normId, updates) => {
      const applyUpdate = () =>
        patchProject(projectId, (project) => ({
          ...project,
          [fieldName]: project[fieldName].map((norm) =>
            Number(norm.id) === Number(normId) ? { ...norm, ...updates } : norm,
          ),
        }));

      if (isDemo) {
        applyUpdate();
        return true;
      }

      try {
        await api.put(`/projects/${projectId}/${apiSegment}/${normId}`, updates, {
          onGlobalError: setGlobalError,
        });
        applyUpdate();
        return true;
      } catch (error) {
        setGlobalError(error?.message || 'Failed to update the standard.');
        logger.error(`projects.update${kind}.error`, error);
        return false;
      }
    },
    [isDemo, apiSegment, fieldName, kind, patchProject, setGlobalError],
  );

  // Reorders this kind's standards. Only bumps the request server-side; the
  // caller (the drag hook) owns the optimistic local order.
  const reorderNorms = useCallback(
    async (projectId, orderedIds) => {
      if (isDemo) return true;

      try {
        await api.post(`/projects/${projectId}/${apiSegment}/reorder`, orderedIds, {
          onGlobalError: setGlobalError,
        });
        return true;
      } catch (error) {
        setGlobalError(error?.message || 'Failed to reorder the standards.');
        logger.error(`projects.reorder${kind}s.error`, error);
        return false;
      }
    },
    [isDemo, apiSegment, kind, setGlobalError],
  );

  return {
    addNorm,
    fetchTrashedNorms,
    deleteNorm,
    restoreNorm,
    deleteNormPermanently,
    updateNorm,
    reorderNorms,
  };
}
