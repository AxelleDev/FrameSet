import { useEffect } from 'react';
import { useProjects } from '../context/ProjectContext';

export default function useActiveProject(id) {
  const { setActiveProjectId } = useProjects();

  useEffect(() => {
    if (id) setActiveProjectId(id);
  }, [id, setActiveProjectId]);
}