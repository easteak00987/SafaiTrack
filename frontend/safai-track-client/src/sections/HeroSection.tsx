import { motion } from 'motion/react'
import { ArrowRight, MapPin, Truck, AlertTriangle, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

/* ── Floating card that drifts in the background ── */
function FloatingCard({
  icon: Icon,
  label,
  value,
  color,
  className,
  delay,
}: {
  icon: React.ElementType
  label: string
  value: string
  color: string
  className: string
  delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.6, ease: 'easeOut' }}
      className={`absolute rounded-2xl border border-white/30 bg-white/80 backdrop-blur-sm p-4 shadow-xl ${className}`}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ backgroundColor: color + '22' }}
        >
          <Icon className="h-5 w-5" style={{ color }} />
        </div>
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-sm font-semibold text-slate-800">{value}</p>
        </div>
      </div>
    </motion.div>
  )
}

/* ── Animated bin fill bar ── */
function BinVisual() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.4, duration: 0.7, ease: 'easeOut' }}
      className="relative mx-auto w-full max-w-sm rounded-3xl border border-white/40 bg-white/70 backdrop-blur-md p-6 shadow-2xl glow-primary"
    >
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Live Bin Monitor
          </p>
          <p className="mt-0.5 text-lg font-bold text-slate-800">Ward 12 — Gulshan</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
          </span>
        </div>
      </div>

      {/* Bins */}
      {[
        { id: 'BIN-042', level: 87, status: 'Critical', color: '#EF4444' },
        { id: 'BIN-038', level: 64, status: 'High',     color: '#F59E0B' },
        { id: 'BIN-021', level: 31, status: 'Normal',   color: '#10B981' },
        { id: 'BIN-057', level: 52, status: 'Medium',   color: '#F59E0B' },
      ].map((bin, i) => (
        <motion.div
          key={bin.id}
          initial={{ opacity: 0, x: -15 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 + i * 0.1, duration: 0.4 }}
          className="mb-3 last:mb-0"
        >
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600">{bin.id}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold" style={{ color: bin.color }}>
                {bin.level}%
              </span>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                style={{ backgroundColor: bin.color }}
              >
                {bin.status}
              </span>
            </div>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${bin.level}%` }}
              transition={{ delay: 0.8 + i * 0.1, duration: 0.7, ease: 'easeOut' }}
              className="h-full rounded-full"
              style={{ backgroundColor: bin.color }}
            />
          </div>
        </motion.div>
      ))}

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between rounded-xl bg-sky-50 px-3 py-2">
        <span className="text-xs text-sky-700">Route optimization ready</span>
        <span className="text-xs font-semibold text-sky-600">3 bins flagged</span>
      </div>
    </motion.div>
  )
}

export function HeroSection() {
  return (
    <section className="relative min-h-screen overflow-hidden mesh-bg flex flex-col">
      {/* ── Decorative blurred gradient orbs ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(14,165,233,0.18) 0%, transparent 70%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-20 -right-32 h-[400px] w-[400px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(16,185,129,0.14) 0%, transparent 70%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-1/2 h-[300px] w-[600px] -translate-x-1/2 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(245,158,11,0.09) 0%, transparent 70%)',
        }}
      />

      {/* ── Main content ── */}
      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col items-center px-6 pt-28 lg:flex-row lg:gap-16 lg:pt-0 lg:items-center lg:min-h-screen">

        {/* Left: Copy */}
        <div className="flex-1 text-center lg:text-left">
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Badge
              variant="outline"
              className="mb-6 inline-flex gap-1.5 border-sky-200 bg-sky-50 px-3 py-1 text-sky-700 text-xs font-semibold"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-sky-500 inline-block" />
              CSE 3200 Course Project · Group 05
            </Badge>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.65 }}
            className="text-balance text-5xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-6xl lg:text-7xl"
          >
            Smart Waste{' '}
            <span className="gradient-hero-text">
              Collection
            </span>{' '}
            for Dhaka
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22, duration: 0.6 }}
            className="mt-6 max-w-xl text-balance text-lg leading-relaxed text-slate-600 lg:text-xl"
          >
            SafaiTrack replaces fixed, condition-blind truck schedules with
            sensor-driven bin monitoring, algorithmic route optimization, and
            a structured citizen complaint channel — all in one platform.
          </motion.p>

          {/* SDG badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35, duration: 0.5 }}
            className="mt-6 flex flex-wrap justify-center gap-2 lg:justify-start"
          >
            {[
              { label: 'SDG 11', sub: 'Sustainable Cities', color: '#F59E0B', bg: '#FEF3C7' },
              { label: 'SDG 12', sub: 'Responsible Consumption', color: '#10B981', bg: '#D1FAE5' },
            ].map((sdg) => (
              <span
                key={sdg.label}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
                style={{ backgroundColor: sdg.bg, color: sdg.color }}
              >
                <span className="font-bold">{sdg.label}</span>
                <span className="opacity-80">· {sdg.sub}</span>
              </span>
            ))}
          </motion.div>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.5 }}
            className="mt-10 flex flex-wrap items-center justify-center gap-4 lg:justify-start"
          >
            <Button
              size="lg"
              className="gap-2 bg-gradient-to-r from-sky-500 to-emerald-500 px-7 py-6 text-base font-semibold text-white shadow-lg shadow-sky-500/30 hover:shadow-sky-500/50 hover:scale-105 transition-all duration-200"
            >
              Explore the System
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="gap-2 border-slate-300 px-7 py-6 text-base font-semibold text-slate-700 hover:border-sky-400 hover:text-sky-700 transition-all duration-200"
            >
              View on GitHub
            </Button>
          </motion.div>

          {/* Trust stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="mt-12 grid grid-cols-3 gap-4 border-t border-slate-200 pt-8"
          >
            {[
              { value: '18', label: 'DB Entities', color: '#0EA5E9' },
              { value: '4', label: 'User Roles', color: '#10B981' },
              { value: '100%', label: 'Open Source', color: '#F59E0B' },
            ].map((stat) => (
              <div key={stat.label} className="text-center lg:text-left">
                <p className="text-3xl font-extrabold" style={{ color: stat.color }}>
                  {stat.value}
                </p>
                <p className="text-xs text-slate-500">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Right: Live dashboard visual */}
        <div className="relative mt-16 w-full max-w-sm flex-shrink-0 lg:mt-0 lg:max-w-md">
          <BinVisual />

          {/* Floating info cards */}
          <FloatingCard
            icon={Truck}
            label="Active Routes"
            value="3 optimized routes"
            color="#0EA5E9"
            className="-top-8 -left-6 w-52 hidden lg:flex"
            delay={1.0}
          />
          <FloatingCard
            icon={MapPin}
            label="Ward Coverage"
            value="12 wards monitored"
            color="#10B981"
            className="-bottom-8 -right-6 w-52 hidden lg:flex"
            delay={1.1}
          />
          <FloatingCard
            icon={AlertTriangle}
            label="Open Complaints"
            value="7 pending resolution"
            color="#F59E0B"
            className="top-1/2 -right-10 w-52 hidden xl:flex"
            delay={1.2}
          />
        </div>
      </div>

      {/* ── Scroll cue ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4, duration: 0.6 }}
        className="relative z-10 mb-8 flex justify-center"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
          className="flex flex-col items-center gap-1 text-slate-400"
        >
          <span className="text-xs tracking-widest uppercase">Scroll</span>
          <ChevronDown className="h-4 w-4" />
        </motion.div>
      </motion.div>
    </section>
  )
}
