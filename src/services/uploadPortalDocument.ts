import { z } from 'zod';
import environment from '../config/environment';
import portalTransfer from '../native/PortalTransfer';

const receiptSchema = z.object({
  id: z.string().min(1),
  fileName: z.string().min(1),
  documentType: z.enum(['service_report', 'inspection', 'certificate', 'other']),
  uploadedAt: z.iso.datetime(),
});
const revokedSchema = z.object({ code: z.literal('DEVICE_TOKEN_REVOKED') });

export type UploadResult =
  | { status: 'sent'; receipt: z.infer<typeof receiptSchema> }
  | { status: 'revoked' }
  | { status: 'failed'; message: string; canRetry: boolean; shouldBackoff: boolean };

const failed = (message: string, canRetry = true, shouldBackoff = false): UploadResult =>
  ({ status: 'failed', message, canRetry, shouldBackoff });

const uploadPortalDocument = async (
  token: string,
  pairing: string,
  id: string,
): Promise<UploadResult> => {
  let response;
  try {
    response = await portalTransfer.upload(
      `${environment.apiBaseUrl}/mc/device/files`, token, pairing, id,
    );
  } catch {
    return failed('Connection interrupted. Try again when the connection is available.', true, true);
  }
  const { status, body } = response;
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    payload = null;
  }
  if (status === 201) {
    const receipt = receiptSchema.safeParse(payload);
    return receipt.success
      ? { status: 'sent', receipt: receipt.data }
      : failed('The Portal returned an unreadable receipt. Retry to check this transfer.');
  }
  if (status === 401 && revokedSchema.safeParse(payload).success) {
    return { status: 'revoked' };
  }
  if (status === 400) {
    return failed('The Portal rejected this file. Correct the selection and send again.', false);
  }
  if (status === 403) {
    return failed('The machine is inactive or Machine Control is unavailable.');
  }
  if (status === 413) {
    return failed('The file exceeds the Portal request limit. Choose a smaller file.', false);
  }
  if ([408, 429].includes(status) || status >= 500) {
    return failed('The Portal is temporarily unavailable. Try again shortly.', true, true);
  }
  return failed(`The Portal could not accept the file (HTTP ${status}).`);
};

export default uploadPortalDocument;
