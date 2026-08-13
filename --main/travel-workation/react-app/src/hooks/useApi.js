import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../api/client";

export function useApi(path, { immediate = true } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState("");

  const run = useCallback(async (overridePath = path, options) => {
    setLoading(true);
    setError("");
    try {
      const result = await apiRequest(overridePath, options);
      setData(result);
      return result;
    } catch (requestError) {
      setError(requestError.message);
      throw requestError;
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    if (immediate && path) run().catch(() => {});
  }, [immediate, path, run]);

  return { data, loading, error, run, setData };
}

export function asList(data, key) {
  if (Array.isArray(data)) return data;
  if (key && Array.isArray(data?.[key])) return data[key];
  if (Array.isArray(data?.items)) return data.items;
  return [];
}
