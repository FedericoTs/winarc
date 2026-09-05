import type { RefObject } from 'react';
import { Share } from 'react-native';
import { captureRef } from 'react-native-view-shot';

/**
 * Renders a card view to a PNG and opens the share sheet. Cards are 9:16 and
 * composed from the same components as the screens; never a screenshot of
 * the UI. Every card carries the join code.
 */
export async function shareCard(ref: RefObject<unknown>, message: string): Promise<'shared' | 'dismissed'> {
  const uri = await captureRef(ref as never, { format: 'png', quality: 1, result: 'tmpfile', width: 1080, height: 1920 });
  const result = await Share.share({ url: uri, message }, { dialogTitle: 'Share to your story' });
  return result.action === Share.sharedAction ? 'shared' : 'dismissed';
}
