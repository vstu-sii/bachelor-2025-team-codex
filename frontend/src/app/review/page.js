"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

export default function ReviewPage() {
  const router = useRouter();

  const [decks, setDecks] = useState([]);
  const [selectedDeckId, setSelectedDeckId] = useState(null);
  const [loadingDecks, setLoadingDecks] = useState(true);

  const [currentCard, setCurrentCard] = useState(null);
  const [loadingCard, setLoadingCard] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [showAnswer, setShowAnswer] = useState(false);

  // ✅ helper: fetch to backend with Authorization Bearer token
  const apiFetch = useCallback(
    async (path, options = {}) => {
      const { data: sessionData, error: sessionErr } =
        await supabase.auth.getSession();
      if (sessionErr) throw new Error(sessionErr.message);

      const token = sessionData?.session?.access_token;
      if (!token) {
        router.push("/login");
        throw new Error("No active session token");
      }

      const headers = new Headers(options.headers || {});
      headers.set("Authorization", `Bearer ${token}`);

      if (!headers.has("Content-Type") && options.body) {
        headers.set("Content-Type", "application/json");
      }

      const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

      if (res.status === 401) {
        router.push("/login");
        throw new Error("Unauthorized (token missing/expired)");
      }

      return res;
    },
    [router]
  );

  // 1) Load decks
  useEffect(() => {
    const loadDecks = async () => {
      setLoadingDecks(true);
      setError("");

      try {
        const res = await apiFetch("/decks/", { method: "GET" });
        if (!res.ok) {
          const t = await res.text();
          throw new Error(`Failed to load decks: ${res.status} – ${t}`);
        }

        const list = (await res.json()) || [];
        setDecks(list);

        if (list.length > 0) setSelectedDeckId(list[0].id);
        else setSelectedDeckId(null);
      } catch (err) {
        setError(err?.message || "Error while loading decks.");
      } finally {
        setLoadingDecks(false);
      }
    };

    void loadDecks();
  }, [apiFetch]);

  // 2) Load next card
  const loadNextCard = useCallback(async () => {
    if (!selectedDeckId) {
      setError("Please select a deck first.");
      return;
    }

    setLoadingCard(true);
    setError("");
    setInfoMessage("");
    setShowAnswer(false);

    try {
      const res = await apiFetch(`/review/next?deck_id=${selectedDeckId}`, {
        method: "GET",
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Error loading next card: ${res.status} – ${text}`);
      }

      const json = await res.json();

      if (!json.card) {
        setCurrentCard(null);
        setInfoMessage("No due cards today for this deck 🎉");
      } else {
        setCurrentCard(json.card);
      }
    } catch (err) {
      setError(err?.message || "Error while loading next card.");
    } finally {
      setLoadingCard(false);
    }
  }, [apiFetch, selectedDeckId]);

  useEffect(() => {
    if (selectedDeckId) {
      setCurrentCard(null);
      setInfoMessage("");
      setError("");
      void loadNextCard();
    }
  }, [selectedDeckId, loadNextCard]);

  // 3) Submit answer
  const handleAnswer = useCallback(
    async (grade) => {
      if (!currentCard || !selectedDeckId) return;

      setSubmitting(true);
      setError("");
      setInfoMessage("");

      try {
        const res = await apiFetch("/review/answer", {
          method: "POST",
          body: JSON.stringify({
            deck_id: selectedDeckId,
            card_id: currentCard.id,
            grade,
          }),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`Error submitting answer: ${res.status} – ${text}`);
        }

        const data = await res.json();

        if (!data.next_card) {
          setCurrentCard(null);
          setInfoMessage("Session finished for this deck 🎉");
          setShowAnswer(false);
        } else {
          setCurrentCard(data.next_card);
          setShowAnswer(false);
        }
      } catch (err) {
        setError(err?.message || "Error while submitting answer.");
      } finally {
        setSubmitting(false);
      }
    },
    [apiFetch, currentCard, selectedDeckId]
  );

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex justify-center px-4 py-10">
      <div className="w-full max-w-4xl space-y-8">
        <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">
              Review mode <span className="text-slate-400 text-base">(UC-3)</span>
            </h1>
            <p className="text-sm text-slate-300 mt-1">
              Select a deck and practice with spaced repetition (SM-2).
            </p>
          </div>

          <a
            href="/profile"
            className="mt-3 md:mt-0 inline-flex items-center justify-center rounded-full border border-slate-700 px-4 py-1.5 text-xs md:text-sm hover:bg-slate-800 transition-colors"
          >
            ← Back to profile
          </a>
        </header>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">1. Choose a deck</h2>
            <button
              type="button"
              onClick={loadNextCard}
              disabled={!selectedDeckId || loadingCard}
              className="text-xs md:text-sm inline-flex items-center rounded-lg bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 px-3 py-1.5 font-medium transition-colors"
            >
              {loadingCard ? "Loading card..." : "Load next card"}
            </button>
          </div>

          {loadingDecks ? (
            <p className="text-sm text-slate-400">Loading decks...</p>
          ) : decks.length === 0 ? (
            <p className="text-sm text-slate-400">
              No decks found. Go to <span className="font-semibold text-sky-400">Profile</span> and create a deck first.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-xs text-slate-400">Available decks:</label>
              <select
                value={selectedDeckId || ""}
                onChange={(e) => {
                  const nextId = e.target.value ? Number(e.target.value) : null;
                  setSelectedDeckId(nextId);
                  setShowAnswer(false);
                }}
                className="min-w-[220px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-sky-500"
              >
                {decks.map((deck) => (
                  <option key={deck.id} value={deck.id}>
                    {deck.title} (id={deck.id})
                  </option>
                ))}
              </select>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
          <h2 className="text-lg font-semibold">2. Current card</h2>

          {error && (
            <div className="rounded-lg border border-red-700 bg-red-950/60 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}

          {infoMessage && (
            <div className="rounded-lg border border-emerald-700 bg-emerald-950/60 px-3 py-2 text-sm text-emerald-200">
              {infoMessage}
            </div>
          )}

          {!currentCard ? (
            <p className="text-sm text-slate-400">
              No active card. {selectedDeckId ? "Loading…" : "Select a deck first."}
            </p>
          ) : (
            <div className="space-y-4 rounded-xl border border-slate-700 bg-slate-950 px-4 py-4">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Deck ID: {selectedDeckId}</span>
                <span>Card ID: {currentCard.id}</span>
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-400 mb-1">Question</div>
                <div className="text-base font-medium">{currentCard.question}</div>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setShowAnswer((prev) => !prev)}
                  className="text-sm font-medium text-sky-400 hover:text-sky-300 transition-colors"
                >
                  {showAnswer ? "Hide answer" : "Show answer"}
                </button>

                {showAnswer && (
                  <div className="mt-2 rounded-lg bg-slate-900/80 border border-slate-700 px-3 py-2 text-sm">
                    {currentCard.answer}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-800 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleAnswer(0)}
                  className="inline-flex items-center justify-center rounded-full bg-red-600 hover:bg-red-500 disabled:bg-slate-700 px-4 py-1.5 text-xs md:text-sm font-semibold transition-colors"
                >
                  Again (0)
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleAnswer(3)}
                  className="inline-flex items-center justify-center rounded-full bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 px-4 py-1.5 text-xs md:text-sm font-semibold transition-colors"
                >
                  Hard (3)
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleAnswer(4)}
                  className="inline-flex items-center justify-center rounded-full bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 px-4 py-1.5 text-xs md:text-sm font-semibold transition-colors"
                >
                  Good (4)
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleAnswer(5)}
                  className="inline-flex items-center justify-center rounded-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 px-4 py-1.5 text-xs md:text-sm font-semibold transition-colors"
                >
                  Easy (5)
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
