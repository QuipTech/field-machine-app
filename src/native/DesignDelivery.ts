import { NativeModules, Platform } from 'react-native';

export interface NativeDesignDelivery {
  readJournal: (scope: string) => Promise<string>;
  writeJournal: (scope: string, payload: string) => Promise<void>;
  prepare: (scope: string, delivery: string, project: string) => Promise<void>;
  download: (scope: string, delivery: string, project: string, path: string,
    index: number, size: number, sha256: string, url: string) => Promise<string>;
  stop: () => void;
  openProject: (scope: string, delivery: string, project: string) => Promise<void>;
  // Android only: list a project's files and open one with another app.
  listFiles?: (scope: string, delivery: string, project: string) => Promise<unknown>;
  openFile?: (scope: string, delivery: string, project: string, path: string) => Promise<void>;
}

const native: NativeDesignDelivery | undefined = Platform.OS === 'windows' || Platform.OS === 'android'
  ? NativeModules.FieldMachineDesignDelivery
  : undefined;

export default native;
