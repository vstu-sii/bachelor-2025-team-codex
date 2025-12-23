"use client";

import { supabase } from "./supabaseClient";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

export async function apiFetch(path, options = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token || null;

  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");

  // مهم: إرسال Bearer token للـBackend حتى لا يرجع 401
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  return res;
}
