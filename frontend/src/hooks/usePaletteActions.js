// A project palette's whole lifecycle: bulk replace (add/edit/reorder), single
// -color trash, restore and permanent delete. Extracted from ProjectContext
// (the same move useNormActions made for standards) so the context stays an
// assembler of state + action hooks instead of one thousand-line module.
import { useCallback } from 'react';
import api from '../services/api';
import logger from '../utils/logger';

export default function usePaletteActions({
  isDemo,
  projects,
  setProjects,
  setGlobalError,
  nextDemoId,
  trashedPaletteColors,
  setTrashedPaletteColors,
  trashedPaletteColorsRef,
}) {
  // Replaces the whole palette and adopts the canonical one returned by the
  // server (ids + persisted order). Used for every palette change: add, edit,
  // delete, reorder. Returns the saved palette, or null on failure.
  const updateProjectPalette = useCallback(
    async (projectId, palette) => {
      if (isDemo) {
        const savedPalette = palette.map((color) =>
          color.id ? color : { ...color, id: nextDemoId() },
        );
        setProjects((prevProjects) =>
          prevProjects.map((project) =>
            String(project.id) === String(projectId)
              ? { ...project, palette: savedPalette }
              : project,
          ),
        );
        return savedPalette;
      }

      try {
        const response = await api.post(`/projects/${projectId}/palette`, palette, {
          onGlobalError: setGlobalError,
        });
        const savedPalette = response?.palette || [];
        setProjects((prevProjects) =>
          prevProjects.map((project) =>
            String(project.id) === String(projectId)
              ? { ...project, palette: savedPalette }
              : project,
          ),
        );
        return savedPalette;
      } catch (error) {
        setGlobalError(error?.message || 'Failed to update the palette.');
        logger.error('projects.updatePalette.error', error);
        return null;
      }
    },
    // nextDemoId is deliberately not a dependency: it closes over a stable ref
    // (see nextDemoIdRef in ProjectContext) and is redefined every render, so
    // including it would give updateProjectPalette a new identity every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isDemo, setProjects, setGlobalError],
  );

  // Fetches a project's trashed colors (small list: id, name, hex, days left).
  const fetchTrashedColors = useCallback(
    async (projectId, { silent = false } = {}) => {
      if (!projectId) {
        setTrashedPaletteColors([]);
        return [];
      }
      // The demo account's color trash is simulated locally (see deleteColor);
      // skip the network call so it isn't wiped by the real (empty) trash.
      if (isDemo) {
        return trashedPaletteColorsRef.current;
      }
      try {
        const options = silent ? undefined : { onGlobalError: setGlobalError };
        const data = await api.get(`/projects/${projectId}/palette/trash`, options);
        const fetched = data?.colors || [];
        setTrashedPaletteColors(fetched);
        return fetched;
      } catch (error) {
        logger.error('projects.fetchTrashedColors.error', error);
        return [];
      }
    },
    [isDemo, setTrashedPaletteColors, trashedPaletteColorsRef, setGlobalError],
  );

  // Moves a single color to the trash (soft delete server-side) and removes it
  // locally. Distinct from updateProjectPalette (bulk replace): this is what the
  // palette editor's "Delete" button calls, so a deletion is always
  // independently restorable. The trash list is refreshed silently so the
  // page's trash section stays accurate. Returns true on success.
  const deleteColor = useCallback(
    async (projectId, colorId) => {
      if (isDemo) {
        const project = projects.find((p) => String(p.id) === String(projectId));
        const target = project?.palette?.find((color) => String(color.id) === String(colorId));
        setProjects((prevProjects) =>
          prevProjects.map((p) =>
            String(p.id) === String(projectId)
              ? {
                  ...p,
                  palette: (p.palette || []).filter(
                    (color) => String(color.id) !== String(colorId),
                  ),
                }
              : p,
          ),
        );
        if (target) {
          setTrashedPaletteColors((prev) => [{ ...target, daysLeft: 30 }, ...prev]);
        }
        return true;
      }

      try {
        await api.delete(`/projects/${projectId}/palette/${colorId}`, null, {
          onGlobalError: setGlobalError,
        });
        setProjects((prevProjects) =>
          prevProjects.map((project) =>
            String(project.id) === String(projectId)
              ? {
                  ...project,
                  palette: (project.palette || []).filter(
                    (color) => String(color.id) !== String(colorId),
                  ),
                }
              : project,
          ),
        );
        fetchTrashedColors(projectId, { silent: true });
        return true;
      } catch (error) {
        setGlobalError(error?.message || 'Failed to delete the color.');
        logger.error('projects.deleteColor.error', error);
        return false;
      }
    },
    [isDemo, projects, setProjects, setTrashedPaletteColors, setGlobalError, fetchTrashedColors],
  );

  // Restores a trashed color, appending it back to the project's local palette
  // using the data already held in the trash list. Returns true on success.
  const restoreColor = useCallback(
    async (projectId, colorId) => {
      const applyRestore = () => {
        const restored = trashedPaletteColors.find((color) => String(color.id) === String(colorId));
        setTrashedPaletteColors((prev) =>
          prev.filter((color) => String(color.id) !== String(colorId)),
        );
        if (restored) {
          setProjects((prevProjects) =>
            prevProjects.map((project) =>
              String(project.id) === String(projectId)
                ? {
                    ...project,
                    palette: [
                      ...(project.palette || []),
                      { id: restored.id, name: restored.name, hex: restored.hex },
                    ],
                  }
                : project,
            ),
          );
        }
      };

      if (isDemo) {
        applyRestore();
        return true;
      }

      try {
        await api.post(
          `/projects/${projectId}/palette/${colorId}/restore`,
          {},
          { onGlobalError: setGlobalError },
        );
        applyRestore();
        return true;
      } catch (error) {
        setGlobalError(error?.message || 'Failed to restore the color.');
        logger.error('projects.restoreColor.error', error);
        return false;
      }
    },
    [isDemo, trashedPaletteColors, setTrashedPaletteColors, setProjects, setGlobalError],
  );

  // Permanently deletes a TRASHED color (irreversible). Returns true on success.
  const deleteColorPermanently = useCallback(
    async (projectId, colorId) => {
      if (isDemo) {
        setTrashedPaletteColors((prev) =>
          prev.filter((color) => String(color.id) !== String(colorId)),
        );
        return true;
      }

      try {
        await api.delete(`/projects/${projectId}/palette/${colorId}/permanent`, null, {
          onGlobalError: setGlobalError,
        });
        setTrashedPaletteColors((prev) =>
          prev.filter((color) => String(color.id) !== String(colorId)),
        );
        return true;
      } catch (error) {
        setGlobalError(error?.message || 'Failed to delete the color.');
        logger.error('projects.deleteColorPermanently.error', error);
        return false;
      }
    },
    [isDemo, setTrashedPaletteColors, setGlobalError],
  );

  return {
    updateProjectPalette,
    fetchTrashedColors,
    deleteColor,
    restoreColor,
    deleteColorPermanently,
  };
}
