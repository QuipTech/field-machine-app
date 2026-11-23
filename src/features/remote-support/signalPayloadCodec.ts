// KVS signaling payloads are base64-encoded UTF-8 JSON. The Windows WebView
// page uses the browser's btoa/atob/TextEncoder; Hermes types expose none of
// them, so the Android peer uses this small, dependency-free codec instead.
// Base64 packs 3 bytes into 4 six-bit digits, which is clearest as bit math.
/* eslint-disable no-bitwise */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

const toUtf8Bytes = (text: string) => {
  const bytes: number[] = [];
  const encoded = encodeURIComponent(text);
  for (let index = 0; index < encoded.length; index++) {
    if (encoded[index] === '%') {
      bytes.push(parseInt(encoded.slice(index + 1, index + 3), 16));
      index += 2;
    } else {
      bytes.push(encoded.charCodeAt(index));
    }
  }
  return bytes;
};

const fromUtf8Bytes = (bytes: number[]) =>
  decodeURIComponent(bytes.map(byte => `%${byte.toString(16).padStart(2, '0')}`).join(''));

const toBase64 = (bytes: number[]) => {
  let output = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    const group = (bytes[index] << 16) | ((second ?? 0) << 8) | (third ?? 0);
    output += ALPHABET[(group >> 18) & 63] + ALPHABET[(group >> 12) & 63];
    output += second === undefined ? '=' : ALPHABET[(group >> 6) & 63];
    output += third === undefined ? '=' : ALPHABET[group & 63];
  }
  return output;
};

const fromBase64 = (text: string) => {
  if (!BASE64_PATTERN.test(text)) {
    throw new Error('Invalid base64 payload.');
  }
  const bytes: number[] = [];
  for (let index = 0; index < text.length; index += 4) {
    const values = Array.from(text.slice(index, index + 4), char => ALPHABET.indexOf(char));
    const group = (values[0] << 18) | (values[1] << 12) | (Math.max(values[2], 0) << 6) | Math.max(values[3], 0);
    bytes.push((group >> 16) & 255);
    if (values[2] >= 0) bytes.push((group >> 8) & 255);
    if (values[3] >= 0) bytes.push(group & 255);
  }
  return bytes;
};

const encode = (value: unknown) => toBase64(toUtf8Bytes(JSON.stringify(value)));

// Throws on malformed base64, UTF-8, or JSON; callers treat that as an
// ignored frame, like the Windows page.
const decode = (payload: string): unknown => JSON.parse(fromUtf8Bytes(fromBase64(payload)));

const signalPayloadCodec = { encode, decode };

export default signalPayloadCodec;
