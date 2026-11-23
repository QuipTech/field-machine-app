import signalPayloadCodec from './signalPayloadCodec';
import signalingMessages from './signalingMessages';

const OFFER = { type: 'offer', sdp: 'v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\n' };

describe('signalPayloadCodec', () => {
  it('round-trips UTF-8 JSON through base64', () => {
    const value = { text: 'Grader façade ✓ 🚜', list: [1, 2, 3] };
    expect(signalPayloadCodec.decode(signalPayloadCodec.encode(value))).toEqual(value);
  });

  it('matches the browser base64 encoding used by the Windows page', () => {
    // Fixture produced by Node's Buffer base64 encoder for the same JSON.
    expect(signalPayloadCodec.encode(OFFER))
      .toBe('eyJ0eXBlIjoib2ZmZXIiLCJzZHAiOiJ2PTBcclxubz0tIDEgMiBJTiBJUDQgMTI3LjAuMC4xXHJcbiJ9');
  });

  it('rejects malformed base64 and JSON', () => {
    expect(() => signalPayloadCodec.decode('not base64!')).toThrow();
    expect(() => signalPayloadCodec.decode('e29vcHM=')).toThrow();
  });
});

describe('signalingMessages', () => {
  it('reads a valid frame and ignores malformed or oversized frames', () => {
    const frame = { messageType: 'SDP_OFFER', senderClientId: 'viewer', messagePayload: 'abc' };
    expect(signalingMessages.readFrame(JSON.stringify(frame))).toEqual(frame);
    expect(signalingMessages.readFrame('{')).toBeUndefined();
    expect(signalingMessages.readFrame(JSON.stringify({ senderClientId: 'viewer' }))).toBeUndefined();
    expect(signalingMessages.readFrame('x'.repeat(100001))).toBeUndefined();
    expect(signalingMessages.readFrame(42)).toBeUndefined();
  });

  it('reads offers and rejects other descriptions', () => {
    expect(signalingMessages.readOffer(signalPayloadCodec.encode(OFFER))).toEqual(OFFER);
    const answer = signalPayloadCodec.encode({ type: 'answer', sdp: 'v=0' });
    expect(signalingMessages.readOffer(answer)).toBeUndefined();
    expect(signalingMessages.readOffer('###')).toBeUndefined();
  });

  it('requires a media id or index on ICE candidates', () => {
    const valid = { candidate: 'candidate:1 1 udp 1 1.2.3.4 5 typ host', sdpMid: '0', sdpMLineIndex: 0 };
    expect(signalingMessages.readCandidate(signalPayloadCodec.encode(valid))).toEqual(valid);
    const missing = signalPayloadCodec.encode({ candidate: 'candidate:1', sdpMid: null, sdpMLineIndex: null });
    expect(signalingMessages.readCandidate(missing)).toBeUndefined();
  });

  it('creates an addressed, encoded outbound message', () => {
    const message = JSON.parse(signalingMessages.createMessage('SDP_ANSWER', 'viewer', { type: 'answer' }));
    expect(message.action).toBe('SDP_ANSWER');
    expect(message.recipientClientId).toBe('viewer');
    expect(signalPayloadCodec.decode(message.messagePayload)).toEqual({ type: 'answer' });
  });
});
