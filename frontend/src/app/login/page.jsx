// frontend/src/app/login/page.js
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    router.push("/profile");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-slate-50 shadow-xl"
      >
        <h1 className="text-xl font-semibold mb-6">Login to Auto-Flashcards</h1>

        <label className="block text-sm text-slate-300 mb-2">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-sky-500 mb-4"
        />

        <label className="block text-sm text-slate-300 mb-2">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-sky-500 mb-4"
        />

        {errorMsg && (
          <div className="mb-4 rounded-lg border border-red-700 bg-red-950/60 px-3 py-2 text-sm text-red-200">
            {errorMsg}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 px-4 py-2 text-sm font-semibold transition-colors"
        >
          {loading ? "Logging in..." : "Login"}
        </button>

        <button
          type="button"
          onClick={() => router.push("/register")}
          className="mt-3 w-full rounded-lg border border-slate-700 bg-transparent hover:bg-slate-800/60 px-4 py-2 text-sm transition-colors"
        >
          Create new account
        </button>
      </form>
    </div>
  );
}
