import React, { useState } from 'react';
import { Button, Text, View } from 'react-native';
import { z } from 'zod';
import native from '../../native/DesignDelivery';
import styles from '../pairing/pairingStyles';
import type { ActiveProject } from './designState';

interface Props {
  scope: string;
  project: ActiveProject;
}

const filesSchema = z.array(z.string().min(1));

// Android: a project expands to its files; each opens in another app via "Open with".
const DesignProjectFiles = ({ scope, project }: Props) => {
  const [files, setFiles] = useState<string[]>();
  const [error, setError] = useState('');

  const toggle = async () => {
    setError('');
    if (files) {
      setFiles(undefined);
      return;
    }
    try {
      const listed = await native?.listFiles?.(scope, project.id, project.projectId);
      setFiles(filesSchema.parse(listed ?? []));
    } catch {
      setError('Could not list the project files.');
    }
  };

  const open = async (path: string) => {
    setError('');
    try {
      await native?.openFile?.(scope, project.id, project.projectId, path);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not open the file.');
    }
  };

  return (
    <View>
      <Button
        title={`${files ? 'Hide' : 'Show'} ${project.project} files`}
        onPress={toggle}
      />
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {files?.length === 0 && <Text style={styles.text}>This project has no files.</Text>}
      {files?.map(path => (
        <Button key={path} title={`Open ${path}`} onPress={() => open(path)} />
      ))}
    </View>
  );
};

export default DesignProjectFiles;
