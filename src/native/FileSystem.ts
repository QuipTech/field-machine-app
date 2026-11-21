import { TurboModuleRegistry, type TurboModule } from 'react-native';

export interface FileSystemModule extends TurboModule {
  // Native code must constrain access to the explicitly approved test root.
  setTestRoot(root: string): Promise<void>;
  writeTestFile(name: string, contents: string): Promise<void>;
  readTestFile(name: string): Promise<string>;
  deleteTestFile(name: string): Promise<void>;
}

const getFileSystem = () => {
  return TurboModuleRegistry.get<FileSystemModule>('FieldMachineFileSystem');
};

export default getFileSystem;
