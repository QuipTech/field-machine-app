import React, { useState } from 'react';
import { Modal, Text, View } from 'react-native';
import ActionButton from '../../components/ActionButton';
import styles from '../pairing/pairingStyles';
import ChangePasswordForm from './ChangePasswordForm';
import { formatFieldId } from './tabletAccessSchema';
import useTabletAccessStore from './useTabletAccessStore';

const PHASE_TEXT = {
  idle: 'Starting…',
  registering: 'Registering this tablet with FIELD…',
  waiting: 'Waiting to be added in the FIELD Portal.',
  connecting: 'Added to a machine. Connecting…',
  paired: '',
  error: '',
};

// FIELD ID access: what the installer or Portal user needs to add the tablet.
const TabletAccessCard = () => {
  const { phase, record, notice, error, changePassword, confirmPasswordRecorded, registerAsNew } =
    useTabletAccessStore();
  const [isConfirmingNew, setIsConfirmingNew] = useState(false);
  const device = record?.device;
  const canRegisterAsNew = Boolean(record && !device && !record.password);

  return (
    <View style={styles.card}>
      <Text style={styles.text}>FIELD ID</Text>
      <Text accessibilityRole="header" selectable style={styles.title}>
        {record ? formatFieldId(record.fieldId) : '— — —'}
      </Text>
      {device && <Text style={styles.heading}>Machine: {device.machine.label}</Text>}
      {!device && <Text accessibilityLiveRegion="polite" style={styles.text}>{PHASE_TEXT[phase]}</Text>}
      {record?.password && (
        <>
          <Text style={styles.text}>Password</Text>
          <Text selectable style={styles.heading}>{record.password}</Text>
        </>
      )}
      {!device && record?.password && (
        <>
          <Text style={styles.text}>
            In the FIELD Portal, add this tablet to the machine with the FIELD ID and password.
          </Text>
          <ChangePasswordForm onSubmit={changePassword} />
        </>
      )}
      {device && record?.isPasswordUnconfirmed && record.password && (
        <>
          <Text style={styles.text}>
            Portal users need this password to connect. It cannot be changed on the tablet; record it,
            or set a new one in the Portal (Change password on the machine).
          </Text>
          <ActionButton title="I have recorded the password" onPress={confirmPasswordRecorded} />
        </>
      )}
      {canRegisterAsNew && (
        <>
          <Text style={styles.text}>
            This tablet no longer stores its password. If nobody knows it, register the tablet again to get a
            new FIELD ID and password.
          </Text>
          <ActionButton title="Register as a new tablet" variant="danger" onPress={() => setIsConfirmingNew(true)} />
        </>
      )}
      {notice && <Text accessibilityLiveRegion="polite" style={styles.text}>{notice}</Text>}
      {error && <Text accessibilityRole="alert" style={styles.error}>{error} Retrying in 30 seconds.</Text>}
      <Modal visible={isConfirmingNew} transparent onRequestClose={() => setIsConfirmingNew(false)}>
        <View style={styles.overlay}>
          <View style={styles.dialog} accessibilityViewIsModal>
            <Text style={styles.heading}>Register as a new tablet?</Text>
            <Text style={styles.text}>
              The tablet gets a new FIELD ID. Remove the old FIELD ID from its machine in the Portal first.
            </Text>
            <ActionButton title="Cancel" onPress={() => setIsConfirmingNew(false)} />
            <View style={styles.action}>
              <ActionButton
                title="Register again"
                variant="danger"
                onPress={() => {
                  setIsConfirmingNew(false);
                  registerAsNew();
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default TabletAccessCard;
