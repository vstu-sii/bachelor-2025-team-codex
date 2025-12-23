"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

export default function RegisterPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullName.trim() },
        },
      });

      if (error) {
        setError(error.message);
        return;
      }

      // حسب إعداد Confirm email في Supabase:
      // - إذا Confirm email ON => user موجود لكن session = null (لا يوجد token بعد)
      // - إذا OFF => user + session (تقدر تدخل مباشرة)
      // (راجع توثيق Supabase) :contentReference[oaicite:3]{index=3}
      if (data?.session?.access_token) {
        router.push("/profile");
        return;
      }

      setInfo(
        "تم إنشاء الحساب. تحقق من بريدك لتأكيد الإيميل، ثم سجّل الدخول."
      );
      router.push("/login");
    } catch (err) {
      setError(err?.message || "Unexpected error during sign up");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
        padding: "1rem",
      }}
    >
      <form
        onSubmit={handleRegister}
        style={{
          width: "100%",
          maxWidth: "400px",
          padding: "2rem",
          borderRadius: "1rem",
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
          background: "white",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", marginBottom: "1.5rem" }}>
          Create account
        </h1>

        <label style={{ display: "block", marginBottom: "0.5rem" }}>
          Full name
        </label>
        <input
          type="text"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          style={{
            width: "100%",
            padding: "0.6rem 0.8rem",
            borderRadius: "0.5rem",
            border: "1px solid #ddd",
            marginBottom: "1rem",
          }}
        />

        <label style={{ display: "block", marginBottom: "0.5rem" }}>Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            width: "100%",
            padding: "0.6rem 0.8rem",
            borderRadius: "0.5rem",
            border: "1px solid #ddd",
            marginBottom: "1rem",
          }}
        />

        <label style={{ display: "block", marginBottom: "0.5rem" }}>
          Password
        </label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            width: "100%",
            padding: "0.6rem 0.8rem",
            borderRadius: "0.5rem",
            border: "1px solid #ddd",
            marginBottom: "1rem",
          }}
        />

        {error && (
          <p style={{ color: "red", marginBottom: "1rem", fontSize: "0.9rem" }}>
            {error}
          </p>
        )}
        {info && (
          <p
            style={{
              color: "#0f766e",
              marginBottom: "1rem",
              fontSize: "0.9rem",
            }}
          >
            {info}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "0.7rem 1rem",
            borderRadius: "0.5rem",
            border: "none",
            background: "#2563eb",
            color: "white",
            fontWeight: 600,
            cursor: "pointer",
            marginBottom: "0.75rem",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Creating account..." : "Sign up"}
        </button>

        <button
          type="button"
          onClick={() => router.push("/login")}
          style={{
            width: "100%",
            padding: "0.7rem 1rem",
            borderRadius: "0.5rem",
            border: "1px solid #ddd",
            background: "white",
            cursor: "pointer",
          }}
        >
          Already have an account? Login
        </button>
      </form>
    </div>
  );
}
