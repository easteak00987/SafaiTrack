import { motion } from 'motion/react'
import { Trash2, Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'SDG Alignment', href: '#sdg' },
  { label: 'Team', href: '#team' },
]

export function Navbar() {
  const [open, setOpen] = useState(false)

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between border-b border-white/30 bg-white/80 backdrop-blur-md px-6 py-4 shadow-sm"
    >
      {/* Logo */}
      <a href="/" className="flex items-center gap-2.5 font-extrabold text-slate-900 text-lg">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-emerald-500">
          <Trash2 className="h-4 w-4 text-white" />
        </div>
        <span>
          Safai<span className="gradient-hero-text">Track</span>
        </span>
      </a>

      {/* Desktop nav */}
      <nav className="hidden items-center gap-6 md:flex">
        {NAV_LINKS.map((link) => (
          <a
            key={link.label}
            href={link.href}
            className="text-sm font-medium text-slate-600 transition-colors hover:text-sky-600"
          >
            {link.label}
          </a>
        ))}
      </nav>

      {/* CTA */}
      <div className="hidden items-center gap-3 md:flex">
        <Button variant="ghost" size="sm" className="text-slate-600">
          Sign In
        </Button>
        <Button
          size="sm"
          className="bg-gradient-to-r from-sky-500 to-emerald-500 text-white shadow-md shadow-sky-500/25 hover:shadow-sky-500/40 hover:scale-105 transition-all duration-200"
        >
          Get Started
        </Button>
      </div>

      {/* Mobile menu toggle */}
      <button
        className="flex items-center md:hidden text-slate-600"
        onClick={() => setOpen((o) => !o)}
        aria-label="Toggle menu"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile dropdown */}
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-full left-0 right-0 border-b border-slate-100 bg-white/95 backdrop-blur-md px-6 py-4 shadow-lg md:hidden"
        >
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block py-2 text-sm font-medium text-slate-700 hover:text-sky-600"
            >
              {link.label}
            </a>
          ))}
          <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
            <Button variant="outline" size="sm" className="flex-1">Sign In</Button>
            <Button size="sm" className="flex-1 bg-gradient-to-r from-sky-500 to-emerald-500 text-white">
              Get Started
            </Button>
          </div>
        </motion.div>
      )}
    </motion.header>
  )
}
