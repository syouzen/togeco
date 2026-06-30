import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { isAuthenticated, pb } from '@/lib/pb';

const COLLECTION = 'gifticons';
const INVALIDATE_DELAY_MS = 350;

export function useRealtimeGifticons(detailId?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated()) return undefined;

    let active = true;
    let unsubscribe: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const scheduleInvalidate = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: [COLLECTION] });
        if (detailId) queryClient.invalidateQueries({ queryKey: [COLLECTION, detailId] });
      }, INVALIDATE_DELAY_MS);
    };

    pb.collection(COLLECTION).subscribe('*', scheduleInvalidate)
      .then((off) => {
        if (!active) {
          off();
          return;
        }
        unsubscribe = off;
      })
      .catch(() => undefined);

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      if (unsubscribe) unsubscribe();
    };
  }, [detailId, queryClient]);
}
