"use client";

import { useState } from "react";
import { Cormorant_Garamond } from "next/font/google";
import { Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";

const cormorant = Cormorant_Garamond({
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600"],
});

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-950 px-4">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-200/[0.04] blur-[120px]" />

      {/* Card */}
      <div className="relative w-full max-w-md rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-10 backdrop-blur-xl">
        {/* Logo */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-amber-200/30">
            <span className={`${cormorant.className} text-2xl font-medium text-amber-200/90`}>
              V
            </span>
          </div>
          <p className={`${cormorant.className} mt-4 text-2xl font-medium tracking-[0.25em] text-zinc-50`}>
            VOYAGE
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.35em] text-zinc-500">
            Private Club
          </p>
        </div>

        {/* Divider */}
        <div className="mx-auto mt-8 h-px w-12 bg-gradient-to-r from-transparent via-amber-200/40 to-transparent" />

        {/* Form heading */}
        <h1 className={`${cormorant.className} mt-8 text-center text-2xl font-medium text-zinc-50`}>
          Private Access
        </h1>
        <p className="mt-2 text-center text-xs text-zinc-500">
          Введите данные вашего аккаунта
        </p>

        {/* Form */}
        <form className="mt-8 space-y-4">
          {/* Email */}
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-[10px] uppercase tracking-[0.2em] text-zinc-500"
            >
              Email
            </label>
            <div className="relative">
              <Mail
                size={16}
                strokeWidth={1.5}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"
              />
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 py-3 pl-11 pr-4 text-sm text-white placeholder:text-zinc-600 transition-colors focus:border-amber-200/40 focus:outline-none focus:ring-1 focus:ring-amber-200/30"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-[10px] uppercase tracking-[0.2em] text-zinc-500"
            >
              Password
            </label>
            <div className="relative">
              <Lock
                size={16}
                strokeWidth={1.5}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"
              />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 py-3 pl-11 pr-11 text-sm text-white placeholder:text-zinc-600 transition-colors focus:border-amber-200/40 focus:outline-none focus:ring-1 focus:ring-amber-200/30"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 transition-colors hover:text-zinc-300"
              >
                {showPassword ? (
                  <EyeOff size={16} strokeWidth={1.5} />
                ) : (
                  <Eye size={16} strokeWidth={1.5} />
                )}
              </button>
            </div>
          </div>

          {/* Forgot password */}
          <div className="flex justify-end">
            <a
              href="#"
              className="text-xs text-zinc-500 transition-colors hover:text-amber-200/80"
            >
              Forgot password?
            </a>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="group mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-100 py-3 text-sm font-medium tracking-wide text-zinc-950 transition-all hover:bg-amber-200 hover:shadow-[0_0_24px_rgba(252,211,77,0.25)]"
          >
            Enter the Club
            <ArrowRight
              size={15}
              strokeWidth={1.5}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </button>
        </form>

        {/* Footer note */}
        <p className="mt-8 text-center text-[11px] tracking-wide text-zinc-600">
          Access is strictly by invitation only.
        </p>
      </div>
    </main>
  );
}