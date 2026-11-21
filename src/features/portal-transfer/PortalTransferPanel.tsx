import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import portalTransfer, { type PendingTransfer } from '../../native/PortalTransfer';
import type { PairedDevice } from '../pairing/pairingSchema';
import styles from '../pairing/pairingStyles';
import getTransferPairing from './getTransferPairing';
import sendPendingTransfer from './sendPendingTransfer';

interface Props {
  device: PairedDevice;
}

interface TransferStatus {
  message: string;
  canRetry?: boolean;
}

import ActionButton from '../../components/ActionButton';
import SentFiles from './SentFiles';
import UploadProgress from './UploadProgress';

const PortalTransferPanel = ({ device }: Props) => {
  const pairing = getTransferPairing(device);
  const [selection, setSelection] = useState<string[]>([]);
  const [pending, setPending] = useState<PendingTransfer[]>([]);
  const [statuses, setStatuses] = useState<Record<string, TransferStatus>>({});
  const [activeId, setActiveId] = useState<string>();
  const activeTransfer = useRef<string | undefined>(undefined);
  const [historyRevision, setHistoryRevision] = useState(0);
  const [percent, setPercent] = useState(0);
  const [isBusy, setIsBusy] = useState(true);
  const [error, setError] = useState('');
  const busy = useRef(true);
  const isMounted = useRef(false);

  const reload = async () => {
    const entries = await portalTransfer.list(pairing);
    if (isMounted.current) {
      setPending(entries);
    }
    return entries;
  };

  useEffect(() => {
    isMounted.current = true;
    const subscription = portalTransfer.subscribe((id, value) => {
      if (id === activeTransfer.current) {
        setPercent(value);
      }
    });
    return () => {
      subscription.remove();
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    portalTransfer.list(pairing).then(
      entries => {
        setPending(entries);
        setIsBusy(false);
        busy.current = false;
      },
      () => {
        setError('Could not load pending uploads.');
        setIsBusy(false);
        busy.current = false;
      },
    );
  }, [pairing]);

  const run = async (action: () => Promise<void>) => {
    if (busy.current) {
      return;
    }
    busy.current = true;
    setIsBusy(true);
    setError('');
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not complete the transfer.');
    } finally {
      busy.current = false;
      setIsBusy(false);
    }
  };

  const setStatus = (id: string, status: TransferStatus) =>
    setStatuses(current => ({ ...current, [id]: status }));

  const send = async (entry: PendingTransfer) => {
    setPercent(0);
    activeTransfer.current = entry.id;
    setActiveId(entry.id);
    setStatus(entry.id, { message: 'Uploading…' });
    try {
      const result = await sendPendingTransfer(device, entry.id, () => {
        setPercent(0);
        setStatus(entry.id, { message: 'Connection interrupted. Retrying…' });
      });
      if (typeof result === 'string') {
        setStatus(entry.id, { message: result, canRetry: true });
      } else if (result.status === 'sent') {
        setHistoryRevision(revision => revision + 1);
        const note = 'cleanupFailed' in result ? ' Local cleanup is pending.' : '';
        setStatus(entry.id, { message: `Sent to Portal · ${result.receipt.fileName}${note}` });
      } else {
        setStatus(entry.id, result);
      }
    } finally {
      activeTransfer.current = undefined;
      setActiveId(undefined);
    }
  };

  const confirm = () => run(async () => {
    const existing = new Set((await reload()).map(entry => entry.id));
    setSelection([]);
    try {
      await portalTransfer.stage(pairing);
    } catch (cause) {
      await reload();
      throw cause;
    }
    const entries = await reload();
    for (const entry of entries) {
      if (!existing.has(entry.id) && isMounted.current) {
        await send(entry);
      }
    }
    await reload();
  });

  const retry = (entry: PendingTransfer) => run(async () => {
    await send(entry);
    await reload();
  });

  const discard = (entry: PendingTransfer) => run(async () => {
    await portalTransfer.remove(pairing, entry.id);
    setStatuses(current => {
      const next = { ...current };
      delete next[entry.id];
      return next;
    });
    await reload();
  });

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.heading}>Send to Portal</Text>
        <Text style={styles.text}>Destination: {device.machine.label}</Text>
        <Text style={styles.text}>PDF, DOC, DOCX, JPG, JPEG, PNG and HEIC · 20 MiB per file</Text>
        <ActionButton
          title="Choose files"
          disabled={isBusy}
          onPress={() => run(async () => setSelection(await portalTransfer.pick()))}
        />
        {selection.length > 0 && (
          <View style={styles.action}>
            <Text style={styles.text}>{selection.join('\n')}</Text>
            <ActionButton title="Confirm and send" disabled={isBusy} onPress={confirm} />
            <ActionButton title="Cancel selection" disabled={isBusy} onPress={() => setSelection([])} />
          </View>
        )}
        {error !== '' && (
          <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
        )}
        {pending.map(entry => (
          <View key={entry.id} style={styles.action}>
            <Text style={styles.text}>
              {entry.fileName} · {statuses[entry.id]?.message ?? 'Pending upload'}
            </Text>
            {activeId === entry.id && <UploadProgress percent={percent} />}
            {activeId !== entry.id && statuses[entry.id]?.canRetry !== false && (
              <ActionButton title="Retry upload" disabled={isBusy} onPress={() => retry(entry)} />
            )}
            <ActionButton title="Remove from queue" disabled={isBusy} onPress={() => discard(entry)} />
          </View>
        ))}
        {Object.entries(statuses).map(([id, status]) =>
          !pending.some(entry => entry.id === id) && (
            <Text key={id} accessibilityLiveRegion="polite" style={styles.text}>{status.message}</Text>
          ),
        )}
      </View>
      <SentFiles pairing={pairing} revision={historyRevision} />
    </>
  );
};

export default PortalTransferPanel;
