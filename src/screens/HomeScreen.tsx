import { colors } from '../config/colors';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ActionButton from '../components/ActionButton';
import styles from '../components/workspaceStyles';
import HomeDisconnect from '../features/pairing/HomeDisconnect';
import type { ActiveProject } from '../features/design-delivery/designState';

interface Props {
  machineLabel: string;
  connectionLabel: string;
  isConnected: boolean;
  projects?: ActiveProject[];
  deliveryMessage: string;
  onOpenFiles: () => void;
  onOpenSupport: () => void;
}

const homeStyles = StyleSheet.create({
  hero: { backgroundColor: colors.primary, borderRadius: 18, padding: 24 },
  machine: { color: colors.onPrimary, fontSize: 36, fontWeight: '800' },
  status: { color: colors.primaryLight, fontSize: 17, marginTop: 10 },
  project: { color: colors.text, fontSize: 17, paddingVertical: 8, marginBottom: 4 },
});

const HomeScreen = ({
  machineLabel, connectionLabel, isConnected, projects, deliveryMessage,
  onOpenFiles, onOpenSupport,
}: Props) => (
  <>
    <View style={homeStyles.hero}>
      <Text accessibilityRole="header" style={homeStyles.machine}>{machineLabel}</Text>
      <Text accessibilityLiveRegion="polite" style={[homeStyles.status, isConnected && styles.connected]}>
        {connectionLabel}
      </Text>
    </View>
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.heading}>Design deliveries</Text>
      <Text accessibilityLiveRegion="polite" style={styles.body}>{deliveryMessage}</Text>
      {projects && projects.length > 0 && (
        <Text style={styles.fileName}>Projects on this tablet · {projects.length}</Text>
      )}
      {projects?.slice(0, 3).map(project => (
        <Text key={project.projectId} style={homeStyles.project}>{project.project}</Text>
      ))}
      <ActionButton title="Open files" onPress={onOpenFiles} />
    </View>
    <View style={styles.card}>
      <ActionButton title="Remote support" onPress={onOpenSupport} />
      <HomeDisconnect />
    </View>
  </>
);

export default HomeScreen;
