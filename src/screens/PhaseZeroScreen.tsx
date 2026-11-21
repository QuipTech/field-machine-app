import { colors } from '../config/colors';
import React, { useState } from 'react';
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import useCapabilityChecks from '../features/phase-zero/useCapabilityChecks';
import ActionButton from '../components/ActionButton';
import ConnectionDiagnostics from '../features/connection/ConnectionDiagnostics';

const PhaseZeroScreen = () => {
  const [root, setRoot] = useState('');
  const checks = useCapabilityChecks();
  const isDisabled = Platform.OS !== 'windows' || checks.isBusy;

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>WORKSHOP · DEVICE DIAGNOSTICS</Text>
      <Text style={styles.title}>FIELD Machine</Text>
      <ConnectionDiagnostics />
      <Text style={styles.heading}>Phase 0 · Windows capability checks</Text>
      <Text style={styles.text}>
        Check this device before use. Run these actions on an isolated test
        desktop. Each check starts only when you select its button.
      </Text>
      {Platform.OS !== 'windows' && (
        <Text style={styles.text}>These checks require Windows.</Text>
      )}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>01 External folder</Text>
        <Text style={styles.text}>
          Create, read, and clean up a small test file.
        </Text>
        <Text style={styles.label}>Dedicated external test folder</Text>
        <TextInput
          accessibilityLabel="Dedicated external test folder"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isDisabled}
          onChangeText={setRoot}
          placeholder="Enter the folder approved for this test"
          style={styles.input}
          value={root}
        />
        <View style={styles.action}>
          <ActionButton
            title="Test folder read/write"
            disabled={isDisabled}
            onPress={() => checks.checkFolder(root)}
          />
        </View>
      </View>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>02 Screen capture</Text>
        <Text style={styles.text}>
          Captures the whole primary monitor. Inspect the snapshot and frame
          count, then stop capture when finished.
        </Text>
        <View style={styles.action}>
          <ActionButton
            title="Start screen capture"
            disabled={isDisabled}
            onPress={checks.startCapture}
          />
        </View>
        <View style={styles.action}>
          <ActionButton
            title="Stop screen capture"
            disabled={isDisabled}
            onPress={checks.stopCapture}
          />
        </View>
        <View style={styles.action}>
          <ActionButton
            title="Inspect capture diagnostics and snapshot"
            disabled={isDisabled}
            onPress={checks.inspectCapture}
          />
        </View>
        {checks.snapshotUri && (
          <Image
            accessibilityLabel="First captured frame of the primary monitor"
            source={{ uri: checks.snapshotUri }}
            style={styles.snapshot}
            resizeMode="contain"
          />
        )}
      </View>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>03 Input verification</Text>
        <Text style={styles.text}>
          The click action must only address a dedicated native test target.
          Confirm the target receives the click before marking the check passed.
        </Text>
        <View style={styles.action}>
          <ActionButton
            title="Send one click to test target"
            disabled={isDisabled}
            onPress={checks.clickTarget}
          />
        </View>
      </View>
      <Text style={styles.label}>LATEST RESULT</Text>
      <Text accessibilityLiveRegion="polite" style={styles.result}>
        {checks.result}
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  page: { backgroundColor: colors.background },
  container: {
    padding: 24,
    paddingTop: 36,
    maxWidth: 1040,
    width: '100%',
    alignSelf: 'center',
  },
  eyebrow: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 24,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primaryDark,
    marginBottom: 10,
  },
  title: { fontSize: 30, fontWeight: '700', color: colors.primaryDark },
  heading: { fontSize: 20, marginVertical: 16, color: colors.text },
  text: { fontSize: 16, lineHeight: 24, marginBottom: 16, color: colors.textSecondary },
  label: { fontSize: 16, fontWeight: '600', marginBottom: 8, color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.textSecondary,
    borderRadius: 6,
    padding: 14,
    color: colors.text,
  },
  action: { marginVertical: 8 },
  snapshot: { width: '100%', height: 300, marginVertical: 16 },
  result: {
    fontSize: 16,
    padding: 16,
    marginTop: 0,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    borderRadius: 6,
    backgroundColor: colors.primaryLight,
    color: colors.text,
  },
});

export default PhaseZeroScreen;
