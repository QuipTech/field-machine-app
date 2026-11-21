import runDelivery from './runDelivery';
import type { Delivery, Journal } from './designState';

const delivery: Delivery = {
  id: '00000000-0000-4000-8000-000000000001',
  projectId: '00000000-0000-4000-8000-000000000002',
  project: 'North Pit',
  versionId: '00000000-0000-4000-8000-000000000003',
  status: 'waiting',
  files: [{ path: 'surfaces/design.dxf', sizeBytes: 512, sha256: 'a'.repeat(64) }],
};

const journal: Journal = {
  projects: [{ ...delivery, id: '00000000-0000-4000-8000-000000000004' }],
  pending: null,
};

const setup = () => ({
  api: {
    next: jest.fn(),
    status: jest.fn().mockResolvedValue(undefined),
    file: jest.fn().mockResolvedValue({ url: 'https://storage.example/design' }),
  },
  storage: {
    prepare: jest.fn().mockResolvedValue(undefined),
    download: jest.fn(),
    readJournal: jest.fn(),
    writeJournal: jest.fn(),
    openProject: jest.fn(),
    stop: jest.fn(),
  },
  controller: new AbortController(),
});

test('refreshes a signed URL and retries a checksum before activating the new manifest', async () => {
  const { api, storage, controller } = setup();
  storage.download.mockResolvedValueOnce('expired').mockResolvedValueOnce('checksum')
    .mockResolvedValueOnce('verified');
  const result = await runDelivery(delivery, journal, 'scope', api, storage, controller.signal);
  expect(api.file).toHaveBeenCalledTimes(3);
  expect(api.file).toHaveBeenLastCalledWith(delivery.id, 0);
  expect(result.projects).toEqual([{
    id: delivery.id, projectId: delivery.projectId, project: delivery.project, versionId: delivery.versionId,
  }]);
  expect(result.pending).toEqual({ id: delivery.id, result: { status: 'arrived' } });
});

test('keeps the active project when a file fails verification twice', async () => {
  const { api, storage, controller } = setup();
  storage.download.mockResolvedValue('checksum');
  const result = await runDelivery(delivery, journal, 'scope', api, storage, controller.signal);
  expect(storage.download).toHaveBeenCalledTimes(2);
  expect(result.projects).toEqual(journal.projects);
  expect(result.pending?.result.status).toBe('failed');
});

test('rejects a late native completion after disconnect', async () => {
  const { api, storage, controller } = setup();
  storage.download.mockImplementation(async () => {
    controller.abort();
    return 'verified';
  });
  await expect(runDelivery(delivery, journal, 'scope', api, storage, controller.signal))
    .rejects.toThrow('Design delivery stopped.');
});

test('fails conflicting Windows manifest paths before staging', async () => {
  const { api, storage, controller } = setup();
  const file = delivery.files[0];
  const conflicting = { ...delivery, files: [file, { ...file, path: file.path.toUpperCase() }] };
  const result = await runDelivery(conflicting, journal, 'scope', api, storage, controller.signal);
  expect(result.pending?.result.status).toBe('failed');
  expect(storage.prepare).not.toHaveBeenCalled();
});
