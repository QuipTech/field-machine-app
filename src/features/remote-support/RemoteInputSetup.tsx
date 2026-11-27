import React, { useState } from 'react';
import { Text, View } from 'react-native';
import ActionButton from '../../components/ActionButton';
import styles from '../../components/workspaceStyles';
import RemoteControlConsent from './RemoteControlConsent';
import useRemoteControlConsent from './useRemoteControlConsent';
import useRemoteInputAccess from './useRemoteInputAccess';

const SERVICE_NAME = 'FIELD Machine remote control';

// Consent and the one-time Android accessibility step that remote control
// needs. Renders nothing where no setup exists (Windows).
const RemoteInputSetup = () => {
  const { isSetupRequired, isEnabled, hasConsent, openSettings } = useRemoteInputAccess();
  const { submit, isSubmitting, error, clearError } = useRemoteControlConsent();
  const [isConsentOpen, setIsConsentOpen] = useState(false);

  const accept = async () => {
    if (await submit(true)) setIsConsentOpen(false);
  };

  if (!isSetupRequired) return null;
  if (isEnabled === undefined) {
    return <Text style={styles.body}>Checking remote control access…</Text>;
  }
  if (!hasConsent) {
    return (
      <View>
        <Text accessibilityLiveRegion="polite" style={styles.body}>
          Remote control is off. Screen viewing still works. Review how remote control works before you allow it.
        </Text>
        <View style={styles.row}>
          <ActionButton title="Set up remote control" onPress={() => setIsConsentOpen(true)} />
        </View>
        {isConsentOpen && (
          <RemoteControlConsent
            error={error}
            isSubmitting={isSubmitting}
            onAccept={() => { accept(); }}
            onDecline={() => {
              clearError();
              setIsConsentOpen(false);
            }}
          />
        )}
      </View>
    );
  }
  return (
    <View>
      <Text accessibilityLiveRegion="polite" style={styles.body}>
        {isEnabled
          ? 'Remote control is set up. Portal support can control this tablet only during a session where you allow control.'
          : `One step left: open Accessibility settings, choose “${SERVICE_NAME}” (under Downloaded or Installed apps), and turn it on.`}
      </Text>
      {error && <Text accessibilityLiveRegion="polite" style={[styles.body, styles.error]}>{error}</Text>}
      <View style={styles.row}>
        {!isEnabled && <ActionButton title="Open accessibility settings" onPress={() => { openSettings(); }} />}
        <ActionButton title="Withdraw consent" disabled={isSubmitting} onPress={() => { submit(false); }} />
      </View>
    </View>
  );
};

export default RemoteInputSetup;
