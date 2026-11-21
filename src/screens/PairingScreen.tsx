import React, { useState } from 'react';
import { Button, Modal, ScrollView, Text, View } from 'react-native';
import PairingCodeForm from '../features/pairing/PairingCodeForm';
import usePairingStore from '../features/pairing/usePairingStore';
import styles from '../features/pairing/pairingStyles';
import useConnectionStore from '../features/connection/useConnectionStore';

const PairingScreen = ({ isSettings = false }: { isSettings?: boolean }) => {
  const pairing = usePairingStore();
  const connectionStatus = useConnectionStore(state => state.status);
  const connectionLabel = {
    idle: 'Saved pairing — connection not verified',
    validating: 'Checking session…',
    reconnecting: 'Offline / reconnecting — pairing retained',
    connected: 'Connected — session verified',
  }[connectionStatus];
  const [isCodeDialogOpen, setIsCodeDialogOpen] = useState(false);
  const isBusy = pairing.status === 'submitting' || pairing.status === 'saving';
  const isPaired = pairing.status === 'paired';
  const closeDialog = () => {
    if (!isBusy) {
      setIsCodeDialogOpen(false);
    }
  };
  const submitCode = async (code: string) => {
    await pairing.pairDevice(code);
    if (usePairingStore.getState().pairedDevice) {
      setIsCodeDialogOpen(false);
    }
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.container}>
      <Text style={styles.title}>{isSettings ? 'Tablet settings' : 'FIELD Machine'}</Text>
      {!isSettings && <Text style={styles.text}>STAGING · Tablet pairing</Text>}
      <View style={styles.card}>
        <Text style={styles.heading}>
          {isPaired
            ? `Tablet paired with ${pairing.pairedDevice?.machine.label}`
            : 'Pair this tablet'}
        </Text>
        {pairing.status === 'loading' && (
          <Text style={styles.text}>Reading secure pairing storage…</Text>
        )}
        {isPaired && (
          <Text style={styles.text}>
            {connectionLabel}.
          </Text>
        )}
        {pairing.status === 'unpaired' && (
          <>
            <Text style={styles.text}>
              Link this tablet to your machine using a code from the FIELD
              Portal.
            </Text>
            <Button
              title="Pair this tablet"
              onPress={() => setIsCodeDialogOpen(true)}
            />
          </>
        )}
        {isPaired && (
          <>
            <Text style={styles.text}>
              Disconnect this tablet from the machine and remove its saved
              pairing. Internet access is required to confirm the disconnect.
            </Text>
            <Button title="Disconnect tablet" onPress={pairing.forgetPairing} />
          </>
        )}
        {pairing.status === 'disconnecting' && (
          <Text style={styles.text}>Disconnecting tablet…</Text>
        )}
        {pairing.status === 'forgetting' && (
          <Text style={styles.text}>Removing saved pairing…</Text>
        )}
        {pairing.status === 'clear-failed' && (
          <Button title="Retry secure cleanup" onPress={pairing.retryCleanup} />
        )}
        {pairing.status === 'saving' && (
          <Text style={styles.text}>Saving pairing securely…</Text>
        )}
        {pairing.error && !isCodeDialogOpen && (
          <Text accessibilityRole="alert" style={styles.error}>
            {pairing.error}
          </Text>
        )}
        {pairing.status === 'save-failed' && (
          <Button title="Retry secure save" onPress={pairing.retrySave} />
        )}
        {pairing.status === 'blocked' && (
          <Button
            title="Retry reading secure storage"
            onPress={pairing.restorePairing}
          />
        )}
      </View>
      <Modal
        visible={isCodeDialogOpen}
        transparent
        animationType="fade"
        onRequestClose={closeDialog}
      >
        <View style={styles.overlay}>
          <View style={styles.dialog} accessibilityViewIsModal>
            <PairingCodeForm isBusy={isBusy} onSubmit={submitCode} />
            {pairing.error && (
              <Text accessibilityRole="alert" style={styles.error}>
                {pairing.error}
              </Text>
            )}
            <View style={styles.action}>
              <Button title="Cancel" disabled={isBusy} onPress={closeDialog} />
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

export default PairingScreen;
