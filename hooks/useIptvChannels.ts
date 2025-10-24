import { useEffect, useState } from 'react';
import { loadUiChannels, UiChannel } from '@/lib/iptv';

export function useIptvChannels(limit = 20) {
  const [data, setData] = useState<UiChannel[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    loadUiChannels(limit)
      .then((d) => {
        if (alive) {
          setData(d);
          setError(null);
        }
      })
      .catch((e) => {
        if (alive) setError(e as Error);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [limit]);

  return { data, loading, error };
}
