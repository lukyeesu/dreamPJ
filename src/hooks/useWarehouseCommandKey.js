import { useRef, useCallback, useEffect } from 'react';
import { generateIdempotencyKey } from '../services/warehouseService.js';

/**
 * Deterministic JSON stringifier for canonical fingerprinting
 * Excludes idempotencyKey / idempotency_key to prevent circular self-invalidation
 */
function canonicalStringify(obj) {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalStringify).join(',') + ']';
  }
  const keys = Object.keys(obj)
    .filter((k) => k !== 'idempotencyKey' && k !== 'idempotency_key')
    .sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalStringify(obj[k])).join(',') + '}';
}

/**
 * useWarehouseCommandKey Hook
 * Manages request UUID idempotency across UI mutation forms:
 * - Stable UUID across failed retries with unchanged payload
 * - Automatically generates a new UUID when payload changes (correction)
 * - Confirmed success clears key so a second identical request has a fresh intent
 * - Natural unmount cleanup
 */
export function useWarehouseCommandKey() {
  const keysRef = useRef(new Map());

  const getKey = useCallback((action, payload = {}) => {
    if (!action) {
      throw new Error('Action name is required to retrieve or generate an idempotency key');
    }

    const fingerprint = canonicalStringify(payload);
    const existing = keysRef.current.get(action);

    if (existing && existing.fingerprint === fingerprint) {
      return existing.key;
    }

    const newKey = generateIdempotencyKey();
    keysRef.current.set(action, { key: newKey, fingerprint });
    return newKey;
  }, []);

  const clearKey = useCallback((action) => {
    if (action) {
      keysRef.current.delete(action);
    } else {
      keysRef.current.clear();
    }
  }, []);

  useEffect(() => {
    const keys = keysRef.current;
    return () => {
      keys.clear();
    };
  }, []);

  return { getKey, clearKey };
}

export default useWarehouseCommandKey;
