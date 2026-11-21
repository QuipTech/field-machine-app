import getFileSystem from '../../native/FileSystem';
import runFolderCheck from './runFolderCheck';

jest.mock('../../native/FileSystem', () => ({
  __esModule: true,
  default: jest.fn(),
}));
const getModule = jest.mocked(getFileSystem);

const createModule = () => {
  return {
    setTestRoot: jest.fn(async () => {}),
    writeTestFile: jest.fn(async (_name: string, _contents: string) => {}),
    readTestFile: jest.fn(async (_name: string) => ''),
    deleteTestFile: jest.fn(async (_name: string) => {}),
  };
};

beforeEach(() => jest.resetAllMocks());

test('rejects an empty folder without accessing native code', async () => {
  await expect(runFolderCheck(' ')).rejects.toThrow('Enter a dedicated');
  expect(getModule).not.toHaveBeenCalled();
});

test('reports an unregistered native module as blocked', async () => {
  getModule.mockReturnValue(null);
  await expect(runFolderCheck('C:\\Test')).rejects.toThrow('Blocked');
});

test('checks read-back contents and cleans up its own file', async () => {
  const module = createModule();
  module.readTestFile.mockImplementation(async () => {
    const write = module.writeTestFile.mock.calls[0];
    if (!write) {
      throw new Error('No test file was written.');
    }
    return write[1];
  });
  getModule.mockReturnValue(module);
  await expect(runFolderCheck(' C:\\Test ')).resolves.toContain('passed');
  expect(module.setTestRoot).toHaveBeenCalledWith('C:\\Test');
  expect(module.deleteTestFile).toHaveBeenCalledWith(
    module.writeTestFile.mock.calls[0]?.[0],
  );
});

test('cleans up on a read failure and reports the failure', async () => {
  const module = createModule();
  module.readTestFile.mockRejectedValue(new Error('Read denied'));
  getModule.mockReturnValue(module);
  await expect(runFolderCheck('C:\\Test')).rejects.toThrow('Read denied');
  expect(module.deleteTestFile).toHaveBeenCalledTimes(1);
});

test('does not delete an existing file when exclusive creation fails', async () => {
  const module = createModule();
  module.writeTestFile.mockRejectedValue(new Error('File exists'));
  getModule.mockReturnValue(module);
  await expect(runFolderCheck('C:\\Test')).rejects.toThrow('File exists');
  expect(module.deleteTestFile).not.toHaveBeenCalled();
});

test('reports corrupted read-back contents and cleans up', async () => {
  const module = createModule();
  getModule.mockReturnValue(module);
  await expect(runFolderCheck('C:\\Test')).rejects.toThrow('did not match');
  expect(module.deleteTestFile).toHaveBeenCalledTimes(1);
});
