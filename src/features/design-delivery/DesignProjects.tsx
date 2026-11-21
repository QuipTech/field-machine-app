import React, { useState } from 'react';
import { Button, Text, TextInput, View } from 'react-native';
import native from '../../native/DesignDelivery';
import styles from '../pairing/pairingStyles';
import type { ActiveProject } from './designState';

interface Props {
  scope: string;
  projects: ActiveProject[];
  message: string;
}

const DesignProjects = ({ scope, projects, message }: Props) => {
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();
  const matching = projects.filter(project => project.project.toLowerCase().includes(query));
  const [error, setError] = useState('');
  const open = async (project: ActiveProject) => {
    setError('');
    try {
      await native?.openProject(scope, project.id, project.projectId);
    } catch {
      setError('Could not open the project folder.');
    }
  };
  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.heading}>Received designs</Text>
      <Text accessibilityLiveRegion="polite" style={styles.text}>{message}</Text>
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {projects.length > 1 && (
        <TextInput
          accessibilityLabel="Search received projects"
          placeholder="Search received projects"
          style={styles.input}
          value={search}
          onChangeText={setSearch}
        />
      )}
      {projects.length > 0 && matching.length === 0 && (
        <Text style={styles.text}>No projects match your search.</Text>
      )}
      {matching.map(project => (
        <Button key={project.projectId} title={`Open ${project.project}`} onPress={() => open(project)} />
      ))}
    </View>
  );
};

export default DesignProjects;
