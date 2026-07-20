import { realtime } from './realtime.js';
import { useState, useEffect } from 'react';

export const useLiveShared = (path, initialValue = null) => {
  const [data, setData] = useState(initialValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    
    try {
      const channel = realtime.subscribe(path.split(':')[0], (payload) => {
        setData(payload.new || payload.old);
      });

      return () => {
        realtime.unsubscribe(channel);
      };
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [path]);

  return { data, loading, error };
};

export const useLive = (table, filter = null) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);

    try {
      const channel = realtime.subscribe(table, (payload) => {
        setData(payload.new || payload.old);
      }, filter);

      return () => {
        realtime.unsubscribe(channel);
      };
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [table, filter]);

  return { data, loading, error };
};
