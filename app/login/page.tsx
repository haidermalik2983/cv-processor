"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { storage } from "@/lib/storage";


export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const router = useRouter();
  const supabase =  createClient();

  const loadSavedCvDefaults = async (userId: string) => {
    const { data, error } = await supabase
      .from("user_cv_defaults")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    
    if (error) {
      console.error("Error loading saved CV defaults:", error);
      return null;
    }
    if (!data) return;

    const { created_at, updated_at, user_id, id, ...defaults } = data;
    storage.savedDefaults({
      header: defaults.header as Record<string, string>,
      sections: defaults.sections as Record<string, string>,
      section_titles: defaults.section_titles as Record<string, string>
    });
  }

  const handleLogin = async (e: React.FormEvent) => {
    setSigningIn(true);
    e.preventDefault();
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      alert(`Error signing in: ${error.message}`);
    } else {
      try {
        if( data.user) await loadSavedCvDefaults(data.user.id);
      } catch (err) {
        console.error("Error loading saved CV defaults after login:", err);
      }
      setEmail("");
      setPassword("");
      router.push("/");
    }
    setSigningIn(false);

  };
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        router.push("/");
      }
    });
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-center text-2xl font-semibold text-zinc-900">
          Sign in
        </h1>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-zinc-700"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-zinc-700"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              placeholder="Your password"
            />
          </div>

          <button
            type="submit"
            disabled ={signingIn}
            
            className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2"
          >
            {signingIn ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-600">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-medium text-zinc-900 underline hover:text-zinc-700"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
