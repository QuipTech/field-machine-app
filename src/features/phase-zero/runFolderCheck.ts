import getFileSystem from '../../native/FileSystem';

const runFolderCheck = async (root: string): Promise<string> => {
  if (!root.trim()) {
    throw new Error('Enter a dedicated Windows test folder first.');
  }
  const fileSystem = getFileSystem();
  if (!fileSystem) {
    throw new Error('Blocked: FileSystem native module is not registered.');
  }
  await fileSystem.setTestRoot(root.trim());
  const name = `field-phase-zero-${Date.now()}.txt`;
  const contents = `FIELD Machine read/write check: ${name}`;
  // Native write must create a new file exclusively; never replace a file.
  await fileSystem.writeTestFile(name, contents);
  try {
    const actual = await fileSystem.readTestFile(name);
    if (actual !== contents) {
      throw new Error('Read-back contents did not match.');
    }
  } finally {
    await fileSystem.deleteTestFile(name);
  }
  return 'Folder read/write and cleanup passed.';
};

export default runFolderCheck;
