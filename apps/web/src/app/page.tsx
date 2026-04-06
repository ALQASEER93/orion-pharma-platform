'use client';

import Link from 'next/link';
import {
  OperatorFrame,
  OperatorSupportPanel,
  SectionCard,
} from '@/components/operator-shell';
import { useOperatorSession } from '@/lib/operator-session';

const workflowCards = [
  {
    href: '/pos',
    title: 'نقطة البيع POS',
    summary:
      'ابدأ البيع اليومي، راجع الفواتير المفتوحة، وأنهِ الفاتورة من شاشة الكاشير.',
    tone: 'from-emerald-500/20 to-cyan-500/5',
  },
  {
    href: '/products',
    title: 'الأصناف Products',
    summary:
      'جهز بيانات الصنف والباركود والتصنيف والتسعير من مساحة موجهة للمشغل.',
    tone: 'from-sky-500/20 to-indigo-500/5',
  },
  {
    href: '/purchase-orders',
    title: 'طلبات الشراء Purchase Orders',
    summary:
      'أنشئ طلب شراء جديداً، تابع الكميات المتوقعة، وراجع أوامر اليوم بسرعة.',
    tone: 'from-amber-500/20 to-orange-500/5',
  },
  {
    href: '/suppliers',
    title: 'الموردون Suppliers',
    summary:
      'راجع الموردين المعتمدين وحدّث بيانات التواصل من دون التعامل مع حقول تقنية.',
    tone: 'from-fuchsia-500/20 to-rose-500/5',
  },
  {
    href: '/stock',
    title: 'المخزون Stock',
    summary:
      'افحص رصيد الفرع الحالي واختر الصنف بالاسم قبل الدخول في أي حركة تصحيح.',
    tone: 'from-cyan-500/20 to-slate-500/5',
  },
  {
    href: '/sales/invoices',
    title: 'فواتير البيع Invoices',
    summary:
      'راجع الفواتير النهائية والمسودات بسرعة مع تنسيق أوضح للتاريخ والمبالغ.',
    tone: 'from-violet-500/20 to-slate-500/5',
  },
];

export default function HomePage() {
  const session = useOperatorSession({ requireRegister: true });

  return (
    <OperatorFrame
      currentPath="/"
      eyebrow="ORION Pharma Operations"
      title="Operational landing page for daily pharmacy work"
      description="ابدأ من المهام اليومية الرئيسية بدل شاشة إطلاق داخلية. السياق الحالي للفرع والمشغل يُحل محلياً في الخلفية ويبقى متاحاً للمساندة فقط عند الحاجة."
      session={session}
    >
      <SectionCard
        title="Start the next shift with the shortest path"
        subtitle="هذه الصفحة تجمع أهم مسارات اليوم التشغيلي: البيع، تجهيز الأصناف، الشراء، المخزون، والمراجعة السريعة للفواتير."
      >
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {workflowCards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className={`group rounded-[28px] border border-slate-800 bg-gradient-to-br ${card.tone} p-5 transition hover:-translate-y-0.5 hover:border-slate-600`}
            >
              <p className="text-lg font-semibold text-slate-50">{card.title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {card.summary}
              </p>
              <div className="mt-5">
                <span className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
                  Open workflow
                </span>
              </div>
            </Link>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="What is ready in this local runtime"
        subtitle="The current branch and counter are already resolved for the local accepted runtime, so the operator can move straight into work."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Branch
            </p>
            <p className="mt-2 text-xl font-semibold text-slate-50">
              {session.branchName}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Change by branch name when needed, without exposing raw identifiers
              on the operator surface.
            </p>
          </div>
          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Counter
            </p>
            <p className="mt-2 text-xl font-semibold text-slate-50">
              {session.registerLabel}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              POS continues to use the accepted register context from the local
              runtime.
            </p>
          </div>
          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Operator session
            </p>
            <p className="mt-2 text-xl font-semibold text-slate-50">
              {session.user?.email ?? session.email}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              The page reconnects locally when needed and keeps support details
              secondary.
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/pos"
            className="rounded-2xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
          >
            Open selling counter
          </Link>
          <Link
            href="/products"
            className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-800"
          >
            Open product preparation desk
          </Link>
        </div>
      </SectionCard>

      <OperatorSupportPanel
        session={session}
        onRefresh={() => {
          void session.refreshSession();
        }}
      />
    </OperatorFrame>
  );
}
