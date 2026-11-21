import React, { useState } from 'react';
import { Modal, Text, View } from 'react-native';
import ActionButton from '../../components/ActionButton';
import styles from './pairingStyles';
import usePairingStore from './usePairingStore';

const HomeDisconnect = () => {
  const [isConfirming, setIsConfirming] = useState(false);
  const isDisconnecting = usePairingStore(state => state.status === 'disconnecting');
  const error = usePairingStore(state => state.error);
  const forgetPairing = usePairingStore(state => state.forgetPairing);

  const close = () => setIsConfirming(false);
  const disconnect = async () => {
    close();
    await forgetPairing();
  };

  return (
    <View style={styles.action}>
      <ActionButton
        title={isDisconnecting ? 'Disconnecting…' : 'Disconnect tablet'}
        variant="danger"
        disabled={isDisconnecting}
        onPress={() => setIsConfirming(true)}
      />
      {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      <Modal visible={isConfirming} transparent onRequestClose={close}>
        <View style={styles.overlay}>
          <View style={styles.dialog} accessibilityViewIsModal>
            <Text style={styles.heading}>Disconnect this tablet?</Text>
            <Text style={styles.text}>This removes the machine pairing. To reconnect, pair again using a code from the Portal.</Text>
            <ActionButton title="Cancel" onPress={close} />
            <View style={styles.action}>
              <ActionButton title="Confirm disconnect" variant="danger" onPress={disconnect} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default HomeDisconnect;
