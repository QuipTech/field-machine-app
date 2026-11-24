import React from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';
import ActionButton from '../../components/ActionButton';
import styles from '../../components/workspaceStyles';

interface Props {
  error?: string;
  isSubmitting: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

// Google Play's prominent disclosure for the AccessibilityService API. Keep
// the text in step with RemoteInputService.kt. Back counts as declining.
const RemoteControlConsent = ({ error, isSubmitting, onAccept, onDecline }: Props) => (
  <Modal animationType="fade" onRequestClose={onDecline}>
    <View style={styles.shell}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.title}>Allow remote control?</Text>
          <Text style={styles.body}>
            FIELD Machine uses Android’s AccessibilityService API so that Portal support can control this tablet
            during a support session. This is optional. Screen viewing works without it.
          </Text>
          <Text style={styles.heading}>What it does</Text>
          <Text style={styles.body}>
            • Performs taps, swipes and scrolling, in FIELD Machine and in other apps.{'\n'}
            • Goes back, moves between fields, and types or edits text.{'\n'}
            • Selects, copies, cuts and pastes text in the selected field.
          </Text>
          <Text style={styles.heading}>Data it accesses</Text>
          <Text style={styles.body}>
            To edit text, it reads the text and cursor position of the selected field, which can include personal or
            sensitive text. The service uses this on the tablet only and does not store or send it.
          </Text>
          <Text style={styles.heading}>You stay in control</Text>
          <Text style={styles.body}>
            Control works only in a session where you choose “Allow with control access” and share your screen. You
            can end the session at any time, withdraw this consent on the Remote Support screen, or turn the service
            off in Android Accessibility settings.
          </Text>
          <Text style={styles.body}>If you agree, turn on the service in Android settings to finish setup.</Text>
          {error && <Text accessibilityLiveRegion="polite" style={[styles.body, styles.error]}>{error}</Text>}
          <View style={styles.row}>
            <ActionButton title="I agree" disabled={isSubmitting} onPress={onAccept} />
            <ActionButton title="No thanks" disabled={isSubmitting} onPress={onDecline} />
          </View>
        </View>
      </ScrollView>
    </View>
  </Modal>
);

export default RemoteControlConsent;
