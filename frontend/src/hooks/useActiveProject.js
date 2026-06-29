/**
 * Hook that synchronizes the project context's active project with the project
 * id from the current route, so project pages (norms, palette, export) all read
 * the correct `activeProject`.
 */
import { useEffect } from 'react';
import { useProjects } from '../context/ProjectContext';

/**
 * Sets the active project id whenever the route id changes.
 * @param {string|number} id Project id taken from the route params.
 */
export default function useActiveProject(id) {
  const { setActiveProjectId } = useProjects();

  useEffect(() => {
    if (id) setActiveProjectId(id);
  }, [id, setActiveProjectId]);
}