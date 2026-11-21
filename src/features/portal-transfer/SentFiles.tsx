import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import styles from '../../components/workspaceStyles';
import history, { type SentReceipt } from './sentFileHistory';

interface Props {
  pairing: string;
  revision: number;
}

const SentFiles = ({ pairing, revision }: Props) => {
  const [receipts, setReceipts] = useState<SentReceipt[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => {
    let isActive = true;
    history.read(pairing).then(
      entries => {
        if (isActive) {
          setReceipts(entries);
          setState('ready');
        }
      },
      () => {
        if (isActive) {
          setState('error');
        }
      },
    );
    return () => { isActive = false; };
  }, [pairing, revision]);

  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.heading}>Sent files</Text>
      {state === 'loading' && <Text style={styles.body}>Loading sent files…</Text>}
      {state === 'error' && <Text accessibilityRole="alert" style={styles.body}>Could not load sent file history.</Text>}
      {state === 'ready' && receipts.length === 0 && <Text style={styles.body}>No uploads recorded on this tablet yet.</Text>}
      {receipts.map(receipt => (
        <View style={styles.receipt} key={receipt.id}>
          <Text style={styles.fileName}>{receipt.fileName}</Text>
          <Text style={styles.sent}>Sent to Portal · {new Date(receipt.uploadedAt).toLocaleString()}</Text>
        </View>
      ))}
    </View>
  );
};

export default SentFiles;
