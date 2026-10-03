import { describe, expect, it } from '@jest/globals';

import { getDatabase, getSettings } from '@/lib/storage';

describe('app storage', () => {
  it('reuses a single database connection', async () => {
    await expect(getDatabase()).resolves.toBe(await getDatabase());
  });

  it('STO-016: persists settings', async () => {
    const settings = await getSettings();
    await settings.set('definitions.showUnderlines', true);
    await settings.set('reader.lastVersion.hamlet', 'folger');

    const reopened = await getSettings();
    await expect(reopened.get('definitions.showUnderlines')).resolves.toBe(true);
    await expect(reopened.get('reader.lastVersion.hamlet')).resolves.toBe('folger');
  });
});
