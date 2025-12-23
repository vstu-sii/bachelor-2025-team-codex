"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

/**
 * UC-4: Статистика обучения (per user).
 * GET /stats/overview (protected)
 */
export default function StatsPage() {
  const router = useRouter();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const apiFetch = async (path, options = {}) => {
    const { data: sessionData, error: sessionErr } =
      await supabase.auth.getSession();
    if (sessionErr) throw new Error(sessionErr.message);

    const token = sessionData?.session?.access_token;
    if (!token) {
      router.push("/login");
      throw new Error("Unauthorized: please login first.");
    }

    const headers = new Headers(options.headers || {});
    headers.set("Authorization", `Bearer ${token}`);

    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

    if (res.status === 401) {
      router.push("/login");
      throw new Error("Unauthorized (token missing/expired).");
    }

    return res;
  };

  const loadStats = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await apiFetch("/stats/overview", { method: "GET" });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`Ошибка загрузки статистики: ${res.status} – ${t}`);
      }
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error(err);
      setError(err?.message || "Не удалось загрузить статистику.");
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex justify-center px-4 py-10">
      <div className="w-full max-w-3xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold">Статистика обучения</h1>
          <p className="text-sm text-slate-300">
            Здесь отображается статистика только вашего аккаунта (ваши колоды и карточки).
          </p>
        </header>

        <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-slate-400">
              Данные с эндпоинта{" "}
              <code className="text-sky-400">/stats/overview</code>
            </div>
            <button
              type="button"
              onClick={loadStats}
              disabled={loading}
              className="rounded-lg bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 disabled:text-slate-400 px-3 py-2 text-xs font-semibold transition-colors"
            >
              {loading ? "Обновление..." : "Обновить"}
            </button>
          </div>

          {error && (
            <div className="mt-2 rounded-lg border border-red-700 bg-red-950/40 px-3 py-2 text-xs text-red-200">
              {error}
            </div>
          )}

          {!stats && !error && !loading && (
            <div className="text-xs text-slate-400">Статистика пока не загружена.</div>
          )}

          {stats && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <div className="text-xs text-slate-400">Всего колод</div>
                <div className="text-3xl font-bold mt-1">{stats.total_decks}</div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <div className="text-xs text-slate-400">Всего карточек</div>
                <div className="text-3xl font-bold mt-1">{stats.total_cards}</div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <div className="text-xs text-slate-400">К повторению сегодня</div>
                <div className="text-3xl font-bold mt-1">{stats.due_today}</div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-1">
                <div className="text-xs text-slate-400">
                  Выученные карточки (repetitions ≥ 3)
                </div>
                <div className="text-3xl font-bold">{stats.learned_cards}</div>
                <div className="text-[10px] text-slate-500">
                  По этим карточкам было достаточно успешных повторений.
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 md:col-span-2 flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400">
                    Карточки, по которым уже были ответы
                  </div>
                  <div className="text-3xl font-bold mt-1">{stats.reviewed_cards}</div>
                </div>
                <div className="text-[10px] text-slate-500 max-w-[200px] text-right">
                  Это количество карточек, для которых уже хотя бы один раз была выставлена оценка.
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
