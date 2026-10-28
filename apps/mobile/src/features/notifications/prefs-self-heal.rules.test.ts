import { describe, expect, test } from 'vitest';
import { writeWithSelfHeal } from './prefs-self-heal.rules';

const recoverable = () => Object.assign(new Error('denied'), { code: 'permission-denied' });
const transient = () => Object.assign(new Error('offline'), { code: 'unavailable' });
const isRecoverable = (e: unknown) =>
  (e as { code?: string })?.code === 'permission-denied';

describe('writeWithSelfHeal', () => {
  test('happy path: write succeeds, ensure never called', async () => {
    let ensureCalls = 0;
    let writeCalls = 0;
    const out = await writeWithSelfHeal({
      write: async () => {
        writeCalls++;
        return 'ok';
      },
      ensure: async () => {
        ensureCalls++;
      },
      isRecoverable,
    });
    expect(out).toBe('ok');
    expect(writeCalls).toBe(1);
    expect(ensureCalls, 'ensure must not run when the write succeeds').toBe(0);
  });

  // 네트워크 dead spot 에서 문서를 새로 만들지 않기 위한 가드.
  test('non-recoverable error rethrows immediately, ensure never called', async () => {
    let ensureCalls = 0;
    await expect(writeWithSelfHeal({
        write: async () => {
          throw transient();
        },
        ensure: async () => {
          ensureCalls++;
        },
        isRecoverable,
      })).rejects.toSatisfy((e: any) => e.code === 'unavailable');
    expect(ensureCalls, 'a dead spot must not seed a document').toBe(0);
  });

  test('recoverable error: ensure runs once, write retried once, result returned', async () => {
    let ensureCalls = 0;
    let writeCalls = 0;
    const out = await writeWithSelfHeal({
      write: async () => {
        writeCalls++;
        if (writeCalls === 1) throw recoverable();
        return 'healed';
      },
      ensure: async () => {
        ensureCalls++;
      },
      isRecoverable,
    });
    expect(out).toBe('healed');
    expect(writeCalls).toBe(2);
    expect(ensureCalls, 'exactly one ensure per call').toBe(1);
  });

  test('second write also fails → rethrows the SECOND error', async () => {
    let writeCalls = 0;
    await expect(writeWithSelfHeal({
        write: async () => {
          writeCalls++;
          if (writeCalls === 1) throw recoverable();
          throw Object.assign(new Error('second'), { code: 'invalid-argument' });
        },
        ensure: async () => {},
        isRecoverable,
      }))
      // 두 번째 에러가 더 진짜에 가깝다 — 시드는 성공했는데도 write 가 실패한 것.
      .rejects.toSatisfy((e: any) => e.code === 'invalid-argument');
    expect(writeCalls).toBe(2);
  });

  test('ensure() itself fails → rethrows the ORIGINAL write error', async () => {
    let writeCalls = 0;
    await expect(writeWithSelfHeal({
        write: async () => {
          writeCalls++;
          throw recoverable();
        },
        ensure: async () => {
          throw Object.assign(new Error('seed failed'), { code: 'already-exists' });
        },
        isRecoverable,
      }))
      // 호출자에게는 원래 write 실패가 더 의미 있다. 시드 실패는 삼키지 않고 로깅만.
      .rejects.toSatisfy((e: any) => e.code === 'permission-denied');
    expect(writeCalls, 'no retry when the seed did not happen').toBe(1);
  });

  test('onEnsureError receives the seed failure without masking the original', async () => {
    let seen: unknown;
    await expect(writeWithSelfHeal({
        write: async () => {
          throw recoverable();
        },
        ensure: async () => {
          throw Object.assign(new Error('seed failed'), { code: 'already-exists' });
        },
        isRecoverable,
        onEnsureError: (e) => {
          seen = e;
        },
      })).rejects.toSatisfy((e: any) => e.code === 'permission-denied');
    expect((seen as { code?: string })?.code).toBe('already-exists');
  });
});
