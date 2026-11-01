import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Daily } from "./simulate";

export interface Connection {
  accountId: string;
  accountName: string;
  connectedAt: string;
}
export interface Campaign {
  id: string;
  name: string;
  /** Робота, до якої зіставлено кампанію; "" — не зіставлено. */
  workId: string;
  confidence: number;
}
export interface StatsEntry {
  workId: string;
  platformId: string;
  campaignId: string;
  syncedAt: string;
  /** Бюджет на момент синхронізації: план не зсувається, коли фінальні суми перезаписують вартість. */
  planBudget: number;
  days: Daily[];
}
export interface SyncState {
  syncedAt: string;
  items: Campaign[];
}

interface DigitalState {
  connections: Record<string, Connection>;
  /** projectId → platformId → кампанії останньої синхронізації. */
  sync: Record<string, Record<string, SyncState>>;
  /** workId → статистика. */
  stats: Record<string, StatsEntry>;
  connect(platformId: string, c: Connection): void;
  disconnect(platformId: string): void;
  saveSync(projectId: string, platformId: string, syncedAt: string, items: Campaign[], entries: StatsEntry[]): void;
  reassign(projectId: string, platformId: string, campaignId: string, workId: string, entry: StatsEntry | null): void;
}

export const useDigital = create<DigitalState>()(
  persist(
    (set) => ({
      connections: {},
      sync: {},
      stats: {},
      connect: (platformId, c) => set((s) => ({ connections: { ...s.connections, [platformId]: c } })),
      disconnect: (platformId) =>
        set((s) => {
          const { [platformId]: _x, ...rest } = s.connections;
          return { connections: rest };
        }),
      saveSync: (projectId, platformId, syncedAt, items, entries) =>
        set((s) => {
          const stats = { ...s.stats };
          for (const c of s.sync[projectId]?.[platformId]?.items ?? []) if (c.workId) delete stats[c.workId];
          for (const e of entries) stats[e.workId] = e;
          return { stats, sync: { ...s.sync, [projectId]: { ...s.sync[projectId], [platformId]: { syncedAt, items } } } };
        }),
      reassign: (projectId, platformId, campaignId, workId, entry) =>
        set((s) => {
          const cur = s.sync[projectId]?.[platformId];
          if (!cur) return s;
          const stats = { ...s.stats };
          const items = cur.items.map((c) => {
            if (c.id === campaignId) {
              if (c.workId) delete stats[c.workId];
              return { ...c, workId, confidence: workId ? 1 : 0 };
            }
            if (workId && c.workId === workId) return { ...c, workId: "", confidence: 0 }; // робота має одну кампанію
            return c;
          });
          if (workId) delete stats[workId];
          if (entry) stats[workId] = entry;
          return { stats, sync: { ...s.sync, [projectId]: { ...s.sync[projectId], [platformId]: { ...cur, items } } } };
        }),
    }),
    { name: "aura6-media-digital" },
  ),
);
