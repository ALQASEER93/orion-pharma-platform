"use client";

import Link from "next/link";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import type { OperatorSessionState } from "@/lib/operator-session";

type OperatorRoute = {
  href: string;
  label: string;
};

const operatorRoutes: OperatorRoute[] = [
  { href: "/", label: "الرئيسية Home" },
  { href: "/products", label: "الأصناف Products" },
  { href: "/pos", label: "نقطة البيع POS" },
  { href: "/suppliers", label: "الموردون Suppliers" },
  { href: "/purchase-orders", label: "طلبات الشراء Purchase Orders" },
  { href: "/stock", label: "المخزون Stock" },
  { href: "/sales/invoices", label: "فواتير البيع Invoices" },
];

export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function ShellNotice({
  title,
  body,
  tone = "slate",
}: {
  title: string;
  body: string;
  tone?: "slate" | "success" | "warning" | "error";
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-50"
      : tone === "warning"
        ? "border-amber-400/35 bg-amber-500/10 text-amber-50"
        : tone === "error"
          ? "border-rose-400/35 bg-rose-500/10 text-rose-50"
          : "border-slate-700 bg-slate-900/70 text-slate-100";

  return (
    <div className={cn("rounded-2xl border px-4 py-3", toneClass)}>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-80">
        {title}
      </p>
      <p className="mt-1 text-sm leading-6">{body}</p>
    </div>
  );
}

export function SectionCard({
  title,
  subtitle,
  actions,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[28px] border border-slate-800/80 bg-slate-950/80 p-5 shadow-[0_30px_70px_rgba(15,23,42,0.35)]",
        className,
      )}
    >
      <div className="flex flex-col gap-3 border-b border-slate-800/80 pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-50">{title}</h2>
          {subtitle ? (
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
              {subtitle}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400"
    >
      {children}
    </label>
  );
}

export function InputField({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "h-11 w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-500/15",
        className,
      )}
    />
  );
}

export function SelectField({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "h-11 w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-500/15",
        className,
      )}
    >
      {children}
    </select>
  );
}

export function TextAreaField({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "min-h-[120px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-500/15",
        className,
      )}
    />
  );
}

export function PrimaryButton({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "rounded-2xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300",
        className,
      )}
    />
  );
}

export function SecondaryButton({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
    />
  );
}

export function EmptyState({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-700/80 bg-slate-950/60 px-5 py-8 text-center">
      <p className="text-base font-semibold text-slate-100">{title}</p>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-400">
        {body}
      </p>
    </div>
  );
}

function SessionStatus({ session }: { session: OperatorSessionState }) {
  if (session.status === "ready") {
    return (
      <ShellNotice
        title="جاهزية التشغيل Session Ready"
        body={`المشغل ${session.user?.email ?? session.email} على ${session.branchName}${session.registerId ? `، ${session.registerLabel}` : ""}.`}
        tone="success"
      />
    );
  }

  if (session.status === "error") {
    return (
      <ShellNotice
        title="Session Needs Attention"
        body={session.error}
        tone="error"
      />
    );
  }

  return (
    <ShellNotice
      title="Preparing Session"
      body="جاري تجهيز جلسة التشغيل المحلية وربط الفرع وسياق المستخدم."
      tone="slate"
    />
  );
}

export function OperatorSupportPanel({
  session,
  onRefresh,
  children,
}: {
  session: OperatorSessionState;
  onRefresh: () => void;
  children?: ReactNode;
}) {
  return (
    <details className="rounded-[24px] border border-slate-800 bg-slate-950/70 p-4">
      <summary className="cursor-pointer list-none text-sm font-semibold text-slate-100">
        Support context and recovery tools
      </summary>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Resolved context
            </p>
            <div className="mt-3 space-y-2 text-sm text-slate-200">
              <p>Operator: {session.user?.email ?? session.email}</p>
              <p>Branch: {session.branchName}</p>
              <p>Register: {session.registerLabel}</p>
              <p>API base: {session.apiBase}</p>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-300">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Support record
            </p>
            <div className="mt-3 space-y-2 break-all font-mono text-xs text-slate-400">
              <p>Tenant: {session.tenantId}</p>
              <p>Branch: {session.branchId}</p>
              <p>Register: {session.registerId ?? "n/a"}</p>
              <p>Legal entity: {session.legalEntityId ?? "n/a"}</p>
            </div>
          </div>
          <SecondaryButton type="button" onClick={onRefresh}>
            Reconnect local session
          </SecondaryButton>
        </div>
        {children ? <div>{children}</div> : null}
      </div>
    </details>
  );
}

export function OperatorFrame({
  currentPath,
  title,
  eyebrow,
  description,
  session,
  children,
}: {
  currentPath: string;
  title: string;
  eyebrow: string;
  description: string;
  session: OperatorSessionState;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.16),_transparent_26%),linear-gradient(180deg,#07111b_0%,#0f172a_52%,#020617_100%)] text-slate-100">
      <div className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="overflow-hidden rounded-[32px] border border-slate-800/80 bg-slate-950/70 shadow-[0_30px_70px_rgba(2,6,23,0.35)] backdrop-blur">
          <div className="border-b border-slate-800/80 px-5 py-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-300">
                  {eyebrow}
                </p>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-50">
                  {title}
                </h1>
                <p className="max-w-3xl text-sm leading-6 text-slate-300">
                  {description}
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[460px]">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Operator
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-slate-100">
                    {session.user?.email ?? session.email}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Branch
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-slate-100">
                    {session.branchName}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Counter
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-slate-100">
                    {session.registerLabel}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <nav className="flex flex-wrap gap-2 px-5 py-4">
            {operatorRoutes.map((route) => {
              const active = route.href === currentPath;
              return (
                <Link
                  key={route.href}
                  href={route.href}
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm font-medium transition",
                    active
                      ? "border-cyan-400/60 bg-cyan-500/12 text-cyan-100"
                      : "border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-500 hover:text-slate-100",
                  )}
                >
                  {route.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <SessionStatus session={session} />
        {children}
      </div>
    </main>
  );
}
