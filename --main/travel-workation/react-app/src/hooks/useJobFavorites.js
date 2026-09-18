import { useEffect, useSyncExternalStore } from "react";
import { favoriteJob, getFavoriteJobs, unfavoriteJob } from "../api/jobs";
import { hasSession } from "../auth/session";

export const favoriteKey = (item) => {
  const job = item.job || item;
  return `${job.source}:${job.externalId}`;
};
const itemsOf = (data) => Array.isArray(data) ? data : data?.content || data?.jobs || data?.items || [];
const listeners = new Set();
let owner = null;
let state = { items: [], pending: new Set(), loading: false, ready: false, error: "" };
let loadingRequest = null;
let revision = 0;

function emit(patch) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

function sessionOwner() {
  if (!hasSession()) return "";
  return sessionStorage.getItem("userId") || sessionStorage.getItem("email") || sessionStorage.getItem("accessToken");
}

function ensureOwner() {
  const next = sessionOwner();
  if (owner !== next) {
    owner = next;
    revision += 1;
    loadingRequest = null;
    state = { items: [], pending: new Set(), loading: false, ready: false, error: "" };
  }
  return next;
}

async function readAllFavorites() {
  const items = [];
  for (let page = 0; ; page += 1) {
    const data = await getFavoriteJobs({ page, size: 20 });
    const batch = itemsOf(data);
    const seen = new Set(items.map(favoriteKey));
    const additions = batch.filter((item) => {
      const key = favoriteKey(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    items.push(...additions);
    const total = data?.totalElements ?? data?.page?.totalElements;
    const totalPages = data?.totalPages ?? data?.page?.totalPages;
    if (Array.isArray(data) || data?.last === true || data?.hasNext === false || (total != null && items.length >= total)
      || (totalPages != null && page + 1 >= totalPages) || batch.length < 20 || !additions.length) break;
  }
  return items;
}

export function refreshJobFavorites() {
  if (!ensureOwner()) return Promise.resolve();
  if (loadingRequest) return loadingRequest;
  if (state.pending.size) return Promise.resolve();
  const requestRevision = revision;
  emit({ loading: !state.ready, error: "" });
  const request = readAllFavorites().then((items) => {
    if (requestRevision === revision) emit({ items, ready: true });
  }).catch((error) => {
    if (requestRevision === revision) emit({ error: error.message });
    throw error;
  }).finally(() => {
    if (requestRevision === revision) emit({ loading: false });
    if (loadingRequest === request) loadingRequest = null;
  });
  loadingRequest = request;
  return request;
}

export async function toggleJobFavorite(payload) {
  if (!ensureOwner()) throw new Error("로그인 후 일자리를 찜할 수 있어요.");
  if (!state.ready) await refreshJobFavorites();
  if (!state.ready) throw new Error("찜 목록을 확인한 뒤 다시 시도해 주세요.");
  const key = favoriteKey(payload);
  if (state.pending.has(key)) return;
  const existing = state.items.find((item) => favoriteKey(item) === key);
  const favoriteId = existing?.favoriteId;
  if (existing && favoriteId == null) throw new Error("저장된 찜 ID를 확인할 수 없습니다. 다시 시도해 주세요.");
  const requestOwner = owner;
  revision += 1; // Older list responses must not overwrite an optimistic update.
  const optimistic = { job: payload, favoritedAt: new Date().toISOString() };
  const pending = new Set(state.pending).add(key);
  emit({ pending, loading: false, items: existing ? state.items.filter((item) => favoriteKey(item) !== key) : [optimistic, ...state.items] });
  try {
    if (existing) await unfavoriteJob(favoriteId);
    else {
      const saved = await favoriteJob(payload);
      if (owner === requestOwner) emit({ items: state.items.map((item) => favoriteKey(item) === key ? saved : item) });
    }
    return !existing;
  } catch (error) {
    if (owner === requestOwner) emit({ items: existing ? [existing, ...state.items.filter((item) => favoriteKey(item) !== key)] : state.items.filter((item) => favoriteKey(item) !== key) });
    throw error;
  } finally {
    if (owner === requestOwner) {
      const next = new Set(state.pending);
      next.delete(key);
      emit({ pending: next });
    }
  }
}

const subscribe = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };
const getSnapshot = () => { ensureOwner(); return state; };

export function useJobFavorites() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);
  useEffect(() => {
    const refresh = () => refreshJobFavorites().catch(() => {});
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);
  return { ...snapshot, toggle: toggleJobFavorite, refresh: refreshJobFavorites };
}
