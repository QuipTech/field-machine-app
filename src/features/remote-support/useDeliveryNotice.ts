import { useEffect, useRef } from 'react';
import desktopHost from '../../native/desktopHost';
import type { ActiveProject } from '../design-delivery/designState';

// Announces files that arrive from the Portal on the Windows support panel,
// so the operator sees them during a remote session in any Windows user.
// Projects already on the tablet when the app starts are not announced.
const useDeliveryNotice = (projects: ActiveProject[] | undefined) => {
  const known = useRef<Set<string>>(undefined);

  useEffect(() => {
    if (!projects || !desktopHost.isSupported) return;
    if (!known.current) {
      known.current = new Set(projects.map(project => project.id));
      return;
    }
    for (const project of projects) {
      if (known.current.has(project.id)) continue;
      known.current.add(project.id);
      desktopHost.notify(`Received from Portal: ${project.project} (open the Files tab)`);
    }
  }, [projects]);
};

export default useDeliveryNotice;
