import assert from 'node:assert/strict';
import { openTryOnCamera, cameraErrorMessage } from '../src/utils/cameraAccess';

async function main() {
  let calls = 0, stops = 0, cancelled = false;
  let resolveFirst!: (stream: MediaStream) => void;
  const stream = { getTracks: () => [{ stop: () => { stops++; } }] } as unknown as MediaStream;
  const constraints: MediaStreamConstraints[] = [];
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: {
    getUserMedia: (options: MediaStreamConstraints) => {
      constraints.push(options); calls++;
      if (calls === 1) return new Promise<MediaStream>(resolve => { resolveFirst = resolve; });
      return Promise.resolve(stream);
    },
  } } });
  const first = openTryOnCamera(() => cancelled);
  await Promise.resolve();
  const next = openTryOnCamera(() => false);
  await Promise.resolve();
  assert.equal(calls, 1, 'Concurrent camera requests were issued');
  cancelled = true; resolveFirst(stream);
  assert.equal(await first, null);
  assert.equal(await next, stream);
  assert.equal(stops, 1, 'Cancelled request leaked its camera stream');
  assert.equal(constraints[0].audio, false);

  calls = 0;
  navigator.mediaDevices.getUserMedia = async options => {
    calls++;
    if (calls === 1) throw new DOMException('Could not start video source', 'NotReadableError');
    assert.equal(options.video, true, 'Fallback did not relax video constraints');
    return stream;
  };
  assert.equal(await openTryOnCamera(() => false), stream);
  assert.equal(calls, 2);
  calls = 0;
  navigator.mediaDevices.getUserMedia = async () => { calls++; throw new DOMException('Denied', 'NotAllowedError'); };
  await assert.rejects(openTryOnCamera(() => false), { name: 'NotAllowedError' });
  assert.equal(calls, 1, 'Permission denial must not retry automatically');
  assert.match(cameraErrorMessage(new DOMException('', 'NotReadableError')), /Close other tabs or apps/);
  console.log('PASS: camera requests serialized, cancelled streams released, busy-camera fallback, denial not retried, actionable error.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
