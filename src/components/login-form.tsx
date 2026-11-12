"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

const demoAccounts = [
  {
    role: "Procurement admin",
    email: "admin@procura.app",
    detail: "Runs the full process",
  },
  {
    role: "Approver",
    email: "manager@procura.app",
    detail: "Approves requests, orders, payments",
  },
  {
    role: "Requester",
    email: "staff@procura.app",
    detail: "Creates purchase requests",
  },
];

const DEMO_PASSWORD = "password123";

export function LoginForm() {
  const [email, setEmail] = useState("admin@procura.app");
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function login(nextEmail: string, nextPassword: string) {
    setPending(true);
    setError("");

    const result = await signIn("credentials", {
      email: nextEmail,
      password: nextPassword,
      redirect: false,
    });

    if (result?.error) {
      setError("That email and password combination did not work.");
      setPending(false);
      return;
    }

    // Full navigation makes sure the new session cookie is picked up.
    window.location.assign("/dashboard");
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-8 lg:hidden">
        <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
          <LogIn className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Sign in to Procura
        </h1>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 hidden lg:block">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Welcome back
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Sign in to manage purchasing and stock.
          </p>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            login(email, password);
          }}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogIn className="h-4 w-4" />
            )}
            Sign in
          </Button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <span className="h-px flex-1 bg-slate-200" />
          <span className="text-[11px] uppercase tracking-wide text-slate-400">
            Demo accounts
          </span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <div className="space-y-2">
          {demoAccounts.map((account) => (
            <button
              key={account.email}
              type="button"
              disabled={pending}
              onClick={() => {
                setEmail(account.email);
                setPassword(DEMO_PASSWORD);
                login(account.email, DEMO_PASSWORD);
              }}
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-left transition-colors hover:border-indigo-300 hover:bg-indigo-50/40 disabled:opacity-60"
            >
              <span>
                <span className="block text-xs font-semibold text-slate-800">
                  {account.role}
                </span>
                <span className="block text-[11px] text-slate-500">
                  {account.detail}
                </span>
              </span>
              <span className="text-[11px] font-medium text-indigo-600">
                Sign in →
              </span>
            </button>
          ))}
        </div>

        <p className="mt-4 text-center text-[11px] text-slate-400">
          All demo accounts use the password{" "}
          <span className="font-medium text-slate-600">{DEMO_PASSWORD}</span>
        </p>
      </div>
    </div>
  );
}
