import { z } from 'zod';
import signalPayloadCodec from './signalPayloadCodec';

// Validates KVS signaling frames for the Android peer. The rules match the
// Windows WebView page (screenPeerSignaling.ts / screenPeerIce.ts): frames
// over 100 kB or malformed JSON are ignored, and SDP and ICE payloads must
// decode to the expected shapes before reaching WebRTC.
const MAX_FRAME_LENGTH = 100000;

const frameSchema = z.object({
  messageType: z.string(),
  senderClientId: z.string().optional(),
  messagePayload: z.string().optional(),
});

const offerSchema = z.object({ type: z.literal('offer'), sdp: z.string().min(1) });

const candidateSchema = z.object({
  candidate: z.string(),
  sdpMid: z.string().nullable().optional(),
  sdpMLineIndex: z.number().int().min(0).nullable().optional(),
});

export type SignalingFrame = z.infer<typeof frameSchema>;
export type SignalingOffer = z.infer<typeof offerSchema>;
export type SignalingCandidate = z.infer<typeof candidateSchema>;

const readFrame = (data: unknown): SignalingFrame | undefined => {
  if (typeof data !== 'string' || data.length > MAX_FRAME_LENGTH) return undefined;
  try {
    const result = frameSchema.safeParse(JSON.parse(data), { jitless: true });
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
};

const readPayload = <T>(schema: z.ZodType<T>, payload: string): T | undefined => {
  try {
    const result = schema.safeParse(signalPayloadCodec.decode(payload), { jitless: true });
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
};

const readOffer = (payload: string) => readPayload(offerSchema, payload);

const readCandidate = (payload: string) => {
  const candidate = readPayload(candidateSchema, payload);
  // WebRTC rejects a candidate that names neither a media id nor an index.
  if (candidate && candidate.sdpMid == null && candidate.sdpMLineIndex == null) return undefined;
  return candidate;
};

const createMessage = (action: 'SDP_ANSWER' | 'ICE_CANDIDATE', recipientClientId: string, payload: unknown) =>
  JSON.stringify({ action, recipientClientId, messagePayload: signalPayloadCodec.encode(payload) });

const signalingMessages = { readFrame, readOffer, readCandidate, createMessage };

export default signalingMessages;
