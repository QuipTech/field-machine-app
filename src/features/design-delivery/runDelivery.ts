import type designApi from './designApi';
import type native from '../../native/DesignDelivery';
import type { Delivery, Journal } from './designState';
import checkDeliveryActive from './checkDeliveryActive';

const runDelivery = async (delivery: Delivery, journal: Journal, scope: string,
  api: ReturnType<typeof designApi>, storage: NonNullable<typeof native>, signal: AbortSignal): Promise<Journal> => {
  const { id, projectId, versionId, project, files } = delivery;
  const failed = (error: string): Journal => ({
    ...journal, pending: { id, result: { status: 'failed', error } },
  });
  const paths = files.map(file => file.path.toUpperCase());
  const unique = new Set(paths);
  if (unique.size !== files.length || paths.some(path => {
    const segments = path.split('/');
    return segments.slice(0, -1).some((_, index) => unique.has(segments.slice(0, index + 1).join('/')));
  })) {
    return failed('The design contains conflicting file paths.');
  }
  await storage.prepare(scope, id, projectId);
  checkDeliveryActive(signal);
  await api.status(id, { status: 'downloading' });
  for (const [index, file] of files.entries()) {
    let refreshedUrl = false;
    let retriedChecksum = false;
    for (;;) {
      const { url } = await api.file(id, index);
      checkDeliveryActive(signal);
      const result = await storage.download(scope, id, projectId, file.path, index,
        file.sizeBytes, file.sha256, url);
      checkDeliveryActive(signal);
      if (result === 'verified') {
        break;
      }
      if (result === 'expired' && !refreshedUrl) {
        refreshedUrl = true;
        continue;
      }
      if (result === 'checksum' && !retriedChecksum) {
        retriedChecksum = true;
        continue;
      }
      if (result === 'checksum' || result === 'path' || result === 'permanent') {
        return failed(result === 'checksum' ? 'A design file failed its integrity check.' :
          'A design file could not be saved. Check the package and tablet storage.');
      }
      throw new Error('Design download will retry.');
    }
  }
  return {
    projects: [...journal.projects.filter(entry => entry.projectId !== projectId),
      { id, projectId, versionId, project }],
    pending: { id, result: { status: 'arrived' } },
  };
};

export default runDelivery;
