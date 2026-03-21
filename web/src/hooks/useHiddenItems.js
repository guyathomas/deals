import { useState, useCallback } from 'react';

const STORAGE_KEY = 'deals_hidden_items';

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function persist(set) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
}

export default function useHiddenItems() {
  const [hiddenItems, setHiddenItems] = useState(load);

  const hideItem = useCallback((key) => {
    setHiddenItems((prev) => {
      const next = new Set(prev);
      next.add(key);
      persist(next);
      return next;
    });
  }, []);

  const unhideItem = useCallback((key) => {
    setHiddenItems((prev) => {
      const next = new Set(prev);
      next.delete(key);
      persist(next);
      return next;
    });
  }, []);

  const isHidden = useCallback((key) => hiddenItems.has(key), [hiddenItems]);

  const clearAll = useCallback(() => {
    const next = new Set();
    persist(next);
    setHiddenItems(next);
  }, []);

  return { hiddenItems, hideItem, unhideItem, isHidden, hiddenCount: hiddenItems.size, clearAll };
}
