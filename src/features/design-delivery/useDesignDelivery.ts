import { useEffect, useState } from 'react';
import usePairingStore from '../pairing/usePairingStore';
import useConnectionStore from '../connection/useConnectionStore';
import getTransferPairing from '../portal-transfer/getTransferPairing';
import native from '../../native/DesignDelivery';
import designApi from './designApi';
import { journalSchema, type ActiveProject } from './designState';
import runDelivery from './runDelivery';
import checkDeliveryActive from './checkDeliveryActive';

interface DeliveryView {
  scope: string;
  projects: ActiveProject[];
  message: string;
}

const useDesignDelivery = () => {
  const [view, setView] = useState<DeliveryView>();
  useEffect(() => {
    const storage = native;
    if (!storage) {
      return;
    }
    let active: AbortController | undefined;
    let scope: string | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let work = Promise.resolve();
    let wake: (() => void) | undefined;
    let wasConnected = false;

    const stop = () => {
      if (active) {
        active.abort();
        active = undefined;
        storage.stop();
      }
      clearTimeout(timer);
      timer = undefined;
      wake = undefined;
    };

    const synchronize = () => {
      const { pairedDevice, status } = usePairingStore.getState();
      const nextScope = status === 'paired' && pairedDevice ? getTransferPairing(pairedDevice) : undefined;
      const { status: connectionStatus, isSessionValid } = useConnectionStore.getState();
      const connected = connectionStatus === 'connected';
      const didReconnect = connected && !wasConnected;
      wasConnected = connected;
      if (nextScope !== scope || (!isSessionValid && active)) {
        stop();
        scope = nextScope;
        if (scope) {
          const captured = scope;
          work = work.then(async () => {
            if (scope !== captured || active) {
              return;
            }
            const raw = await storage.readJournal(captured);
            const projects = journalSchema.parse(JSON.parse(raw)).projects;
            if (scope === captured && !active) {
              setView({ scope: captured, projects, message: 'Waiting for a verified connection.' });
            }
          }).catch(() => {
            if (scope === captured && !active) {
              setView({ scope: captured, projects: [], message: 'Could not read saved projects.' });
            }
          });
        }
      }
      if (active && didReconnect && timer !== undefined) {
        wake?.();
      }
      if (active || !nextScope || !isSessionValid || !pairedDevice) {
        return;
      }
      const controller = new AbortController();
      active = controller;
      const { signal } = controller;
      const api = designApi(() => {
        const current = usePairingStore.getState().pairedDevice;
        if (!current || getTransferPairing(current) !== nextScope) {
          throw new Error('Pairing changed.');
        }
        return current.deviceToken;
      }, signal);
      let delay = 1000;
      let idleMessage = 'Waiting for design deliveries.';

      const poll = async () => {
        if (signal.aborted) {
          return;
        }
        let next = 10000;
        let projects: ActiveProject[] | undefined;
        try {
          let journal = journalSchema.parse(JSON.parse(await storage.readJournal(nextScope)));
          projects = journal.projects;
          const publish = (message: string) => {
            if (!signal.aborted) {
              setView({ scope: nextScope, projects: journal.projects, message });
            }
          };
          checkDeliveryActive(signal);
          if (!journal.pending) {
            const delivery = await api.next();
            if (delivery) {
              publish(`Downloading ${delivery.project}…`);
              journal = await runDelivery(delivery, journal, nextScope, api, storage, signal);
              checkDeliveryActive(signal);
              await storage.writeJournal(nextScope, JSON.stringify(journal));
              projects = journal.projects;
            }
          }
          if (journal.pending) {
            const { id, result } = journal.pending;
            idleMessage = result.status === 'arrived' ? 'Design installed.' : result.error;
            publish(result.status === 'arrived' ? 'Design installed. Confirming with Portal…' : result.error);
            await api.status(id, result);
            checkDeliveryActive(signal);
            await storage.writeJournal(nextScope, JSON.stringify({ ...journal, pending: null }));
            next = 0;
          } else {
            publish(idleMessage);
          }
          delay = 1000;
        } catch {
          if (!signal.aborted) {
            setView(previous => ({ scope: nextScope,
              projects: projects ?? (previous?.scope === nextScope ? previous.projects : []),
              message: 'Delivery interrupted. Retrying…' }));
            next = delay + Math.random() * delay / 2;
            delay = Math.min(delay * 2, 60000);
          }
        }
        if (!signal.aborted) {
          timer = setTimeout(() => wake?.(), next);
        }
      };
      wake = () => {
        clearTimeout(timer);
        timer = undefined;
        work = work.then(poll);
      };
      wake();
    };

    const unsubscribePairing = usePairingStore.subscribe(synchronize);
    const unsubscribeConnection = useConnectionStore.subscribe(synchronize);
    synchronize();
    return () => {
      unsubscribePairing();
      unsubscribeConnection();
      stop();
      scope = undefined;
    };
  }, []);
  return view;
};

export default useDesignDelivery;
