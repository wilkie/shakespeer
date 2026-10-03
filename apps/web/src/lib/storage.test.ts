import { describe, expect, it } from '@jest/globals';

import { getDatabase, getPreferences } from '@/lib/storage';

describe('app storage', () => {
  it('reuses a single database connection', async () => {
    await expect(getDatabase()).resolves.toBe(await getDatabase());
  });

  it('persists preferences', async () => {
    const preferences = await getPreferences();
    await preferences.set('fontScale', 1.5);

    await expect((await getPreferences()).get('fontScale')).resolves.toBe(1.5);
  });
});
