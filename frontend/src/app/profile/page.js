"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_BUCKET || "uploads";

const MAX_ANSWER_LEN = 2000;
const MAX_QUESTION_LEN = 500;

function clipStr(s, maxLen) {
  if (!s) return "";
  const t = String(s);
  return t.length > maxLen ? t.slice(0, maxLen) : t;
}

function guessMimeByName(name) {
  const n = (name || "").toLowerCase();
  if (n.endsWith(".pdf")) return "application/pdf";
  if (n.endsWith(".docx"))
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (n.endsWith(".txt")) return "text/plain";
  return "";
}

export default function ProfilePage() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadError, setUploadError] = useState("");

  const [aiStatus, setAiStatus] = useState("");
  const [aiError, setAiError] = useState("");
  const [generatingDeckId, setGeneratingDeckId] = useState(null);

  // ✅ helper: fetch to backend with Authorization Bearer token
  const apiFetch = async (path, options = {}) => {
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

    // set JSON content-type only if body is a string (JSON), not FormData/Blob
    if (
      !headers.has("Content-Type") &&
      options.body &&
      typeof options.body === "string"
    ) {
      headers.set("Content-Type", "application/json");
    }

    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

    if (res.status === 401) {
      router.push("/login");
      throw new Error("Unauthorized (token missing/expired)");
    }

    return res;
  };

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        router.push("/login");
        return;
      }

      setUser(data.user);

      try {
        const res = await apiFetch("/decks/", { method: "GET" });
        if (!res.ok) {
          const t = await res.text();
          throw new Error(`Failed to load decks: ${res.status} – ${t}`);
        }
        const json = await res.json();
        setDecks(Array.isArray(json) ? json : []);
      } catch (err) {
        setError(err?.message || "Unknown error while loading decks");
      } finally {
        setLoading(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleCreateDeck = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setCreating(true);
    setError("");

    try {
      const res = await apiFetch("/decks/", {
        method: "POST",
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription?.trim() || null,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Backend error: ${res.status} – ${text}`);
      }

      const created = await res.json();
      setDecks((prev) => [...prev, created]);
      setNewTitle("");
      setNewDescription("");
    } catch (err) {
      setError(err?.message || "Error while creating deck");
    } finally {
      setCreating(false);
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    setUploadError("");
    setUploadMessage("");
    setAiError("");
    setAiStatus("");

    if (!selectedFile) {
      setUploadError("Please choose a file first.");
      return;
    }
    if (!user) {
      setUploadError("No authenticated user.");
      return;
    }

    setUploading(true);

    try {
      const file = selectedFile;

      // optional: basic extension check
      const name = (file.name || "").toLowerCase();
      const ok =
        name.endsWith(".txt") || name.endsWith(".pdf") || name.endsWith(".docx");
      if (!ok) {
        throw new Error("Supported files: .txt .pdf .docx");
      }

      const fileName = `${Date.now()}-${file.name}`;
      const filePath = `user-${user.id}/${fileName}`;

      const { data, error: uploadErrorObj } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, file);

      if (uploadErrorObj) throw uploadErrorObj;

      setUploadedFiles((prev) => [
        ...prev,
        { name: file.name, path: data?.path || filePath },
      ]);

      setSelectedFile(null);
      setUploadMessage(`Uploaded: ${file.name}`);
    } catch (err) {
      setUploadError(err?.message || "Error while uploading file");
    } finally {
      setUploading(false);
    }
  };

  const handleGenerateFromUpload = async (deckId) => {
    setAiError("");
    setAiStatus("");

    if (!uploadedFiles.length) {
      setAiError("Please upload a file first.");
      return;
    }
    if (!user) {
      setAiError("No authenticated user.");
      return;
    }

    const lastFile = uploadedFiles[uploadedFiles.length - 1];
    setGeneratingDeckId(deckId);

    try {
      // 1) download from Supabase as Blob
      const { data: blob, error: downloadError } = await supabase.storage
        .from(BUCKET)
        .download(lastFile.path);

      if (downloadError) throw downloadError;
      if (!blob) throw new Error("Failed to download file from storage.");

      // 2) send file to backend as multipart/form-data
      const mime = blob.type || guessMimeByName(lastFile.name) || "";
      const f = new File([blob], lastFile.name, { type: mime });

      const form = new FormData();
      form.append("file", f);
      form.append("max_cards", "5");

      const aiRes = await fetch(`${API_BASE}/ai/generate-file`, {
        method: "POST",
        body: form, // DO NOT set Content-Type manually
      });

      if (!aiRes.ok) {
        const msg = await aiRes.text().catch(() => "");
        throw new Error(`AI generate failed: ${aiRes.status} – ${msg}`);
      }

      const aiJson = await aiRes.json();
      const cards = aiJson.cards || [];
      if (!cards.length) throw new Error("AI returned 0 cards.");

      // 3) create cards in deck (protected)
      for (const card of cards) {
        const question = clipStr(card.question, MAX_QUESTION_LEN).trim();
        const answer = clipStr(card.answer, MAX_ANSWER_LEN).trim();

        if (!question || !answer) continue;

        const res = await apiFetch(`/decks/${deckId}/cards`, {
          method: "POST",
          body: JSON.stringify({ question, answer }),
        });

        if (!res.ok) {
          const txt = await res.text();
          console.error("Error creating card:", txt);
        }
      }

      // 4) refresh deck
      const deckRes = await apiFetch(`/decks/${deckId}`, { method: "GET" });
      if (deckRes.ok) {
        const updatedDeck = await deckRes.json();
        setDecks((prev) => prev.map((d) => (d.id === deckId ? updatedDeck : d)));
      }

      setAiStatus(`Generated and saved ${cards.length} cards to deck #${deckId}.`);
    } catch (err) {
      setAiError(err?.message || "Error while generating flashcards.");
    } finally {
      setGeneratingDeckId(null);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f172a",
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          padding: "1rem",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: "50px",
              height: "50px",
              border: "4px solid rgba(139, 92, 246, 0.3)",
              borderTop: "4px solid #8b5cf6",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 1rem",
            }}
          />
          <p style={{ color: "#94a3b8", fontSize: "1.1rem", fontWeight: 500 }}>
            Loading your workspace...
          </p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        padding: "1rem",
      }}
    >
      <nav
        style={{
          background: "#1e293b",
          borderBottom: "1px solid #334155",
          padding: "0.75rem 0",
          marginBottom: "2rem",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div
          style={{
            maxWidth: "1400px",
            margin: "0 auto",
            padding: "0 1rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "1.5rem" }}>🎓</span>
            <span style={{ fontSize: "1.25rem", fontWeight: 700, color: "#f1f5f9" }}>
              MVP
            </span>
          </div>
          <button
            onClick={handleLogout}
            style={{
              padding: "0.5rem 1.25rem",
              borderRadius: "0.5rem",
              border: "1px solid #475569",
              background: "transparent",
              color: "#cbd5e1",
              cursor: "pointer",
              fontWeight: 500,
              fontSize: "0.9rem",
            }}
          >
            Sign Out
          </button>
        </div>
      </nav>

      <main style={{ maxWidth: "1400px", margin: "0 auto" }}>
        <header
          style={{
            marginBottom: "2rem",
            padding: "1.5rem",
            borderRadius: "0.75rem",
            background: "#1e293b",
            border: "1px solid #334155",
          }}
        >
          <h1
            style={{
              fontSize: "clamp(1.5rem, 5vw, 2rem)",
              marginBottom: "0.5rem",
              color: "#f1f5f9",
              fontWeight: 700,
            }}
          >
            Welcome, {user.user_metadata?.full_name || "majid"}! 👋
          </h1>
          <p style={{ color: "#94a3b8", fontSize: "0.9rem" }}>{user.email}</p>
        </header>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "1.5rem",
            marginBottom: "2rem",
          }}
        >
          <section
            style={{
              padding: "1.5rem",
              borderRadius: "0.75rem",
              background: "#1e293b",
              border: "1px solid #334155",
            }}
          >
            <div style={{ marginBottom: "1.5rem" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#f1f5f9" }}>
                📚 Create New Deck
              </h2>
              <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
                Start building your flashcard collection
              </p>
            </div>

            <form onSubmit={handleCreateDeck}>
              <div style={{ marginBottom: "1rem" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.5rem",
                    fontWeight: 600,
                    color: "#cbd5e1",
                  }}
                >
                  Deck Title
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    borderRadius: "0.5rem",
                    border: "1px solid #475569",
                    background: "#0f172a",
                    color: "#f1f5f9",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ marginBottom: "1.25rem" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.5rem",
                    fontWeight: 600,
                    color: "#cbd5e1",
                  }}
                >
                  Description (optional)
                </label>
                <textarea
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    borderRadius: "0.5rem",
                    border: "1px solid #475569",
                    background: "#0f172a",
                    color: "#f1f5f9",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {error && (
                <div
                  style={{
                    padding: "0.75rem",
                    borderRadius: "0.5rem",
                    background: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    marginBottom: "1rem",
                  }}
                >
                  <p style={{ color: "#fca5a5", fontSize: "0.85rem", margin: 0 }}>
                    {error}
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={creating}
                style={{
                  width: "100%",
                  padding: "0.85rem",
                  borderRadius: "0.5rem",
                  border: "none",
                  background: creating ? "#475569" : "#8b5cf6",
                  color: "white",
                  fontWeight: 600,
                  cursor: creating ? "not-allowed" : "pointer",
                }}
              >
                {creating ? "Creating..." : "✨ Create Deck"}
              </button>
            </form>
          </section>

          <section
            style={{
              padding: "1.5rem",
              borderRadius: "0.75rem",
              background: "#1e293b",
              border: "1px solid #334155",
            }}
          >
            <div style={{ marginBottom: "1.5rem" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#f1f5f9" }}>
                📄 Upload Source File
              </h2>
              <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
                Upload a .txt/.pdf/.docx file to generate flashcards automatically
              </p>
            </div>

            <form onSubmit={handleFileUpload}>
              <input
                type="file"
                accept=".txt,.pdf,.docx"
                onChange={(e) => {
                  setSelectedFile(e.target.files?.[0] || null);
                  setUploadError("");
                  setUploadMessage("");
                }}
              />

              <div style={{ height: 12 }} />

              <button
                type="submit"
                disabled={uploading || !selectedFile}
                style={{
                  width: "100%",
                  padding: "0.85rem",
                  borderRadius: "0.5rem",
                  border: "none",
                  background: uploading || !selectedFile ? "#475569" : "#3b82f6",
                  color: "white",
                  fontWeight: 600,
                  cursor: uploading || !selectedFile ? "not-allowed" : "pointer",
                }}
              >
                {uploading ? "⏳ Uploading..." : "📤 Upload File"}
              </button>

              {uploadError && (
                <p style={{ color: "#fca5a5", marginTop: 10 }}>❌ {uploadError}</p>
              )}
              {uploadMessage && (
                <p style={{ color: "#86efac", marginTop: 10 }}>✅ {uploadMessage}</p>
              )}
            </form>
          </section>
        </div>

        {(aiError || aiStatus) && (
          <section
            style={{
              marginBottom: "2rem",
              padding: "1rem",
              borderRadius: "0.75rem",
              background: "#1e293b",
              border: "1px solid #334155",
            }}
          >
            {aiError && <p style={{ color: "#fca5a5", margin: 0 }}>❌ {aiError}</p>}
            {aiStatus && <p style={{ color: "#86efac", margin: 0 }}>✅ {aiStatus}</p>}
          </section>
        )}

        <section
          style={{
            padding: "1.5rem",
            borderRadius: "0.75rem",
            background: "#1e293b",
            border: "1px solid #334155",
            marginBottom: "2rem",
          }}
        >
          <h2
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              marginBottom: "1.5rem",
              color: "#f1f5f9",
            }}
          >
            🎯 Your Deck Collection
          </h2>

          {decks.length === 0 ? (
            <p style={{ color: "#64748b" }}>
              No decks yet — create your first one above!
            </p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: "1.5rem",
              }}
            >
              {decks.map((deck) => (
                <div
                  key={deck.id}
                  style={{
                    padding: "1.5rem",
                    borderRadius: "0.75rem",
                    background: "#0f172a",
                    border: "1px solid #334155",
                  }}
                >
                  <h3 style={{ color: "#f1f5f9", fontWeight: 700 }}>{deck.title}</h3>

                  <button
                    onClick={() => handleGenerateFromUpload(deck.id)}
                    disabled={generatingDeckId === deck.id}
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      borderRadius: "0.5rem",
                      border: "none",
                      background: generatingDeckId === deck.id ? "#475569" : "#8b5cf6",
                      color: "white",
                      fontWeight: 600,
                      marginTop: "1rem",
                      cursor: generatingDeckId === deck.id ? "not-allowed" : "pointer",
                    }}
                  >
                    {generatingDeckId === deck.id ? "🔄 Generating..." : "✨ Generate Cards"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
