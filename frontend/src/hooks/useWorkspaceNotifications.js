import { useEffect, useRef } from 'react';
import { subscribeNotifications } from '../services/notificationService';
import { useFileTreeContext } from '../context/FileTreeContext';
import { useToast } from '../context/ToastContext';

/**
 * Keep Explorer in sync with Drive/agent notifications while the IDE is open.
 */
export function useWorkspaceNotifications(enabled = true) {
  const tree = useFileTreeContext();
  const toast = useToast();
  const refreshRef = useRef(tree.refreshFolder);
  const projectRef = useRef(tree.projectId);
  refreshRef.current = tree.refreshFolder;
  projectRef.current = tree.projectId;

  useEffect(() => {
    if (!enabled || !projectRef.current) return undefined;

    let debounce = null;
    const scheduleRefresh = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        refreshRef.current?.(projectRef.current);
      }, 400);
    };

    const unsub = subscribeNotifications({
      onEvent: (ev) => {
        const type = ev.type || ev.payload?.type;
        if (!type) return;
        if (
          type.startsWith('DRIVE_FILE_')
          || type === 'PIPELINE_COMPLETE'
          || type === 'FILE_WRITTEN'
        ) {
          scheduleRefresh();
        }
        if (type === 'PIPELINE_COMPLETE') {
          toast.success('Agent pipeline complete');
        }
        if (type === 'PIPELINE_FAILED' || type === 'AGENT_ERROR') {
          const msg = ev.payload?.error || ev.error || 'Agent failed';
          toast.error(String(msg));
        }
      },
    });

    return () => {
      if (debounce) clearTimeout(debounce);
      unsub();
    };
  }, [enabled, toast, tree.projectId]);
}
