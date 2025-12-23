"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabaseClient";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data?.session?.access_token || null;
}

async function fetchWithAuth(url, options = {}) {
  const token = await getAccessToken();

  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(url, { ...options, headers });
}

export default function HomePage() {
  // --- Auth state ---
  const [user, setUser] = useState(null);
  const isAuthed = useMemo(() => Boolean(user?.id), [user]);

  // --- AI ---
  const [text, setText] = useState("");
  const [cards, setCards] = useState([]);
  const [maxCards, setMaxCards] = useState(5);
  const [loadingAI, setLoadingAI] = useState(false);
  const [errorAI, setErrorAI] = useState("");

  // --- Decks ---
  const [decks, setDecks] = useState([]);
  const [deckTitle, setDeckTitle] = useState("");
  const [deckDescription, setDeckDescription] = useState("");
  const [loadingDecks, setLoadingDecks] = useState(false);
  const [creatingDeck, setCreatingDeck] = useState(false);
  const [errorDecks, setErrorDecks] = useState("");

  useEffect(() => {
    let mounted = true;

    async function boot() {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;

      setUser(data?.user || null);
      if (data?.user) await loadDecks();
    }

    boot();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user || null;
      setUser(u);
      if (u) loadDecks();
      else setDecks([]);
    });

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadDecks() {
    setErrorDecks("");
    setLoadingDecks(true);

    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/decks/`);

      if (response.status === 401) {
        setDecks([]);
        throw new Error("401 Unauthorized — لازم تعمل Login أولاً (التوكن غير موجود/منتهي).");
      }

      if (!response.ok) {
        throw new Error(`Ошибка загрузки колод: ${response.status}`);
      }

      const data = await response.json();
      setDecks(Array.isArray(data) ? data : []);
    } catch (e) {
      setErrorDecks(e instanceof Error ? e.message : "Unknown error while loading decks.");
    } finally {
      setLoadingDecks(false);
    }
  }

  async function handleCreateDeck() {
    setErrorDecks("");

    if (!isAuthed) {
      setErrorDecks("لازم تعمل Login قبل إنشاء Deck.");
      return;
    }

    const title = deckTitle.trim();
    const description = (deckDescription || "").trim();

    if (!title) {
      setErrorDecks("Пожалуйста, введите название колоды.");
      return;
    }

    setCreatingDeck(true);
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/decks/`, {
        method: "POST",
        body: JSON.stringify({
          title,
          description: description || null,
        }),
      });

      if (response.status === 401) {
        throw new Error("401 Unauthorized — التوكن غير موجود/منتهي. أعد تسجيل الدخول.");
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || `Ошибка создания колоды: ${response.status}`);
      }

      setDeckTitle("");
      setDeckDescription("");
      await loadDecks();
    } catch (e) {
      setErrorDecks(e instanceof Error ? e.message : "Unknown error while creating deck.");
    } finally {
      setCreatingDeck(false);
    }
  }

  async function handleGenerate() {
    setErrorAI("");
    setCards([]);

    const trimmed = text.trim();
    if (!trimmed) {
      setErrorAI("Пожалуйста, введите текст для генерации.");
      return;
    }

    const maxCardsNumber = Number(maxCards) || 5;

    setLoadingAI(true);
    try {
      const response = await fetch(`${API_BASE_URL}/ai/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed, max_cards: maxCardsNumber }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || `Ошибка запроса: ${response.status}`);
      }

      const data = await response.json();
      setCards(Array.isArray(data.cards) ? data.cards : []);
    } catch (e) {
      setErrorAI(e instanceof Error ? e.message : "Unknown error while generating.");
    } finally {
      setLoadingAI(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-10 space-y-10">
        <header className="text-center space-y-3">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Auto-Flashcards — MVP
          </h1>
          <p className="text-sm text-slate-300">Next.js + FastAPI + Supabase + OpenAI</p>

          <div className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/50 px-3 py-1 text-xs">
            <span className={`h-2 w-2 rounded-full ${isAuthed ? "bg-emerald-400" : "bg-rose-400"}`} />
            <span className="text-slate-300">
              {isAuthed ? `Logged in: ${user.email || user.id}` : "Not logged in"}
            </span>
          </div>
        </header>

        {/* AI */}
        <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="text-xl font-semibold">1) Генерация карточек (AI)</h2>

          <div className="space-y-2">
            <label className="block text-sm font-medium">Учебный текст</label>
            <textarea
              className="w-full h-32 rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-sky-500"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>

          <div className="flex flex-col md:flex-row gap-3 items-start md:items-end">
            <div className="space-y-1">
              <label className="block text-xs font-medium">Кол-во карточек</label>
              <input
                type="number"
                min={1}
                max={20}
                className="w-28 rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-sky-500"
                value={maxCards}
                onChange={(e) => setMaxCards(e.target.value)}
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={loadingAI}
              className="w-full md:w-auto rounded-xl bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 py-2.5 px-4 text-sm font-semibold transition-colors"
            >
              {loadingAI ? "Генерация..." : "Сгенерировать"}
            </button>
          </div>

          {errorAI && (
            <div className="rounded-xl border border-red-600 bg-red-950/60 px-3 py-2 text-sm text-red-200">
              Ошибка: {errorAI}
            </div>
          )}

          {cards.length > 0 && (
            <ul className="space-y-2">
              {cards.map((c, i) => (
                <li key={i} className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm">
                  <div className="font-semibold">Q{i + 1}: {c.question}</div>
                  <div className="text-slate-300 mt-1">A: {c.answer}</div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Decks */}
        <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">2) Decks</h2>
              <p className="text-xs text-slate-400 mt-1">
                <code className="text-sky-400">GET/POST /decks/</code> تحتاج Bearer token
              </p>
            </div>

            <button
              onClick={loadDecks}
              disabled={!isAuthed || loadingDecks}
              className="text-xs rounded-xl border border-slate-700 px-3 py-2 hover:bg-slate-800 disabled:opacity-60"
            >
              {loadingDecks ? "..." : "Reload"}
            </button>
          </div>

          {!isAuthed && (
            <div className="rounded-xl border border-amber-600/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-200">
              سجّل دخول أولاً حتى تقدر تقرأ/تنشئ decks.
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Create deck</h3>

              <input
                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none"
                value={deckTitle}
                onChange={(e) => setDeckTitle(e.target.value)}
                placeholder="Title"
              />
              <textarea
                className="w-full h-20 rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none"
                value={deckDescription}
                onChange={(e) => setDeckDescription(e.target.value)}
                placeholder="Description"
              />

              {errorDecks && (
                <div className="rounded-xl border border-red-600 bg-red-950/60 px-3 py-2 text-xs text-red-200">
                  {errorDecks}
                </div>
              )}

              <button
                onClick={handleCreateDeck}
                disabled={!isAuthed || creatingDeck}
                className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 py-2.5 text-sm font-semibold"
              >
                {creatingDeck ? "Creating..." : "Create"}
              </button>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold">List</h3>

              {isAuthed && decks.length > 0 ? (
                <ul className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {decks.map((d) => (
                    <li key={d.id} className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm">
                      <div className="font-semibold">{d.title}</div>
                      <div className="text-xs text-slate-400 mt-1">ID: {d.id}</div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">{isAuthed ? "No decks yet." : "Login required."}</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
