// Syncs the context's active project with the route id so project pages (norms,
// palette, export) all read the correct activeProject.
import { useEffect } from 'react';
import { useProjects } from '../context/ProjectContext';

export default function useActiveProject(id) {
  const { setActiveProjectId } = useProjects();

  useEffect(() => {
    if (id) setActiveProjectId(id);
  }, [id, setActiveProjectId]);
}