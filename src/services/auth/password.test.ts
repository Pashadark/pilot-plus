import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from '@/services/auth/password';

describe('пароли', () => {
  it('отклоняет пароль короче 12 символов', async () => {
    await expect(hashPassword('короткий')).rejects.toThrow('не менее 12 символов');
  });

  it('создаёт разные хеши для одного пароля', async () => {
    const password = 'Надёжный пароль 2026';

    const firstHash = await hashPassword(password);
    const secondHash = await hashPassword(password);

    expect(firstHash).not.toBe(secondHash);
  });

  it('принимает верный пароль', async () => {
    const password = 'Надёжный пароль 2026';
    const encodedHash = await hashPassword(password);

    await expect(verifyPassword(password, encodedHash)).resolves.toBe(true);
  });

  it('отклоняет неверный пароль и повреждённый хеш', async () => {
    const encodedHash = await hashPassword('Надёжный пароль 2026');

    await expect(verifyPassword('Неверный пароль', encodedHash)).resolves.toBe(false);
    await expect(verifyPassword('Надёжный пароль 2026', 'повреждённый-хеш')).resolves.toBe(false);
  });
});
