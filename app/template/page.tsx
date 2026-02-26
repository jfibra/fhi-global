"use client"

import {
  Search,
  ShoppingBag,
  ArrowRight,
  Menu,
  X,
  ArrowUp,
  Check,
  Mail,
  User,
  Info,
  AlertCircle,
  ChevronRight,
} from "lucide-react"
import { useState, useEffect } from "react"

export default function StyleGuide() {
  const [showScrollTop, setShowScrollTop] = useState(false)

  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 400)
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <div className="relative min-h-screen bg-[#fafafa] text-[#111] overflow-x-hidden font-sans">
      {/* Ambient backgrounds to match homepage */}
      <div className="blob blob-1 fixed top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full opacity-40 blur-[100px] -z-10 bg-[radial-gradient(circle,rgb(200,245,255)_0%,rgba(255,255,255,0)_70%)]" />
      <div className="blob blob-2 fixed bottom-0 right-[-10%] w-[600px] h-[600px] rounded-full opacity-40 blur-[100px] -z-10 bg-[radial-gradient(circle,rgb(250,240,210)_0%,rgba(255,255,255,0)_70%)]" />

      {/* Navigation - Minimal for style guide */}
      <header className="fixed top-0 z-[1000] w-full h-20 flex justify-between items-center px-4 md:px-12 bg-[rgba(250,250,250,0.85)] backdrop-blur-xl border-b border-[rgba(0,0,0,0.03)]">
        <div className="font-['Space_Grotesk'] font-bold text-xl md:text-2xl tracking-[-0.03em]">
          glow<span className="text-[#001f3f]">.</span>co <span className="text-sm font-normal text-muted-foreground ml-2">Style Guide</span>
        </div>
        <a href="/" className="text-sm font-medium hover:text-[#001f3f] transition-colors flex items-center gap-2">
          View Homepage <ArrowRight className="w-4 h-4" />
        </a>
      </header>

      <main className="relative max-w-[1200px] w-full mx-auto pt-32 pb-32 px-4 md:px-12">
        {/* Hero Section */}
        <section className="mb-24">
          <div className="inline-flex items-center px-3 py-1.5 bg-white border border-[#e5e5e5] rounded-full text-xs font-semibold uppercase tracking-wider mb-6 shadow-sm">
            <span className="w-2 h-2 bg-[#001f3f] rounded-full mr-2 animate-pulse" />
            V2.0 Design System
          </div>
          <h1 className="font-['Space_Grotesk'] text-5xl md:text-7xl leading-[1.1] font-bold tracking-tight mb-6">
            Everything is <br />
            <span className="bg-gradient-to-r from-[#001f3f] to-[#d6b357] bg-clip-text text-transparent">
              Built with Intention.
            </span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl">
            This page documents the reusable components, base styles, and interactive elements used throughout the platform to ensure visual consistency.
          </p>
        </section>

        <hr className="mb-24 opacity-10" />

        {/* Typography Section */}
        <section className="mb-24">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-12 flex items-center gap-4">
            01. Typography
            <span className="h-px flex-1 bg-border" />
          </h2>
          <div className="grid gap-12">
            <div className="grid md:grid-cols-3 items-baseline gap-8">
              <span className="text-xs font-mono text-muted-foreground">Heading 1 / Space Grotesk Bold</span>
              <h1 className="md:col-span-2 font-['Space_Grotesk'] text-5xl md:text-6xl font-bold tracking-tight">Main Heading Display</h1>
            </div>
            <div className="grid md:grid-cols-3 items-baseline gap-8">
              <span className="text-xs font-mono text-muted-foreground">Heading 2 / Space Grotesk SemiBold</span>
              <h2 className="md:col-span-2 font-['Space_Grotesk'] text-4xl font-semibold tracking-tight">Section Title Header</h2>
            </div>
            <div className="grid md:grid-cols-3 items-baseline gap-8">
              <span className="text-xs font-mono text-muted-foreground">Body Large / Geist Sans</span>
              <p className="md:col-span-2 text-xl leading-relaxed">
                Experience the next generation of botanical skincare formulas, designed specifically for your unique skin barrier and lifestyle.
              </p>
            </div>
            <div className="grid md:grid-cols-3 items-baseline gap-8">
              <span className="text-xs font-mono text-muted-foreground">Body Base / Geist Sans</span>
              <p className="md:col-span-2 text-base leading-relaxed text-[#555]">
                Our products are 100% vegan, cruelty-free, and radically transparent. We believe that true beauty starts with health and honesty, which is why we list every single ingredient and its purpose clearly on our packaging.
              </p>
            </div>
          </div>
        </section>

        {/* Color Palette */}
        <section className="mb-24">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-12 flex items-center gap-4">
            02. Color Palette
            <span className="h-px flex-1 bg-border" />
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            <div className="space-y-3">
              <div className="h-24 w-full bg-[#111] rounded-2xl" />
              <div>
                <span className="text-sm font-bold block">Ink Black</span>
                <span className="text-xs font-mono text-muted-foreground">#111111</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="h-24 w-full bg-[#001f3f] rounded-2xl" />
              <div>
                <span className="text-sm font-bold block">Main Cyan</span>
                <span className="text-xs font-mono text-muted-foreground">#001f3f</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="h-24 w-full bg-[#d6b357] rounded-2xl" />
              <div>
                <span className="text-sm font-bold block">Secondary Gold</span>
                <span className="text-xs font-mono text-muted-foreground">#D6B357</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="h-24 w-full bg-[#95292a] rounded-2xl" />
              <div>
                <span className="text-sm font-bold block">Deep Red</span>
                <span className="text-xs font-mono text-muted-foreground">#95292A</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="h-24 w-full bg-gradient-to-r from-[#001f3f] to-[#d6b357] rounded-2xl" />
              <div>
                <span className="text-sm font-bold block">Brand Gradient</span>
                <span className="text-xs font-mono text-muted-foreground">Horizontal</span>
              </div>
            </div>
          </div>
        </section>

        {/* Buttons Section */}
        <section className="mb-24">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-12 flex items-center gap-4">
            03. Interactive Buttons
            <span className="h-px flex-1 bg-border" />
          </h2>
          <div className="flex flex-wrap gap-6 items-end">
            <div className="space-y-3 text-center">
              <button className="bg-[#111] text-white px-9 py-[18px] rounded-full font-semibold text-base transition-all duration-300 hover:translate-y-[-2px] hover:shadow-[0_10px_20px_rgba(0,0,0,0.15)] hover:bg-[#222]">
                Shop Primary
              </button>
              <span className="text-[10px] font-mono uppercase text-muted-foreground block">Primary Large</span>
            </div>
            <div className="space-y-3 text-center">
              <button className="bg-gradient-to-r from-[#001f3f] to-[#d6b357] text-white px-7 py-3 rounded-full font-semibold text-sm transition-all duration-300 hover:translate-y-[-1px] hover:shadow-lg shadow-md border-0">
                Action Gradient
              </button>
              <span className="text-[10px] font-mono uppercase text-muted-foreground block">Gradient Base</span>
            </div>
            <div className="space-y-3 text-center">
              <button className="px-9 py-[18px] rounded-full font-semibold text-base bg-[rgba(255,255,255,0.5)] border border-[#e5e5e5] transition-all hover:bg-white hover:border-black">
                Outline Style
              </button>
              <span className="text-[10px] font-mono uppercase text-muted-foreground block">Outline Secondary</span>
            </div>
            <div className="space-y-3 text-center">
              <button className="p-4 rounded-full bg-white shadow-md hover:scale-110 shadow-black/5 text-[#001f3f] transition-all">
                <Search className="w-6 h-6" />
              </button>
              <span className="text-[10px] font-mono uppercase text-muted-foreground block">Icon Pill</span>
            </div>
          </div>
        </section>

        {/* Inputs Section */}
        <section className="mb-24">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-12 flex items-center gap-4">
            04. Form Controls
            <span className="h-px flex-1 bg-border" />
          </h2>
          <div className="grid md:grid-cols-2 gap-12">
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider ml-1">Full Name</label>
                <div className="relative">
                  <User className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Enter your name"
                    className="w-full pl-13 pr-6 py-4 rounded-2xl border border-[#e5e5e5] bg-white transition-all focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider ml-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type="email"
                    placeholder="hello@example.com"
                    className="w-full pl-13 pr-6 py-4 rounded-2xl border border-[#e5e5e5] bg-white transition-all focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider ml-1">Message</label>
                <textarea
                  placeholder="How can we help?"
                  rows={5}
                  className="w-full px-6 py-4 rounded-2xl border border-[#e5e5e5] bg-white transition-all focus:outline-none focus:border-[#001f3f] focus:ring-4 focus:ring-[#001f3f]/5 resize-none"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Cards & Surfaces */}
        <section className="mb-24">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-12 flex items-center gap-4">
            05. Surfaces & Feedback
            <span className="h-px flex-1 bg-border" />
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Glass Card */}
            <div className="bg-white/40 backdrop-blur-2xl p-8 rounded-[32px] border border-white border-opacity-60 shadow-xl shadow-black/5 flex flex-col gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#001f3f]/10 flex items-center justify-center text-[#001f3f]">
                <Info className="w-6 h-6" />
              </div>
              <h3 className="font-['Space_Grotesk'] text-xl font-bold">Glassmorphism Surface</h3>
              <p className="text-sm text-[#555] leading-relaxed">
                Used for floating elements and high-contrast sections over images or colorful backgrounds.
              </p>
              <div className="mt-auto pt-4">
                <span className="text-xs font-mono text-[#001f3f]">backdrop-blur-2xl</span>
              </div>
            </div>

            {/* Standard Product Card */}
            <div className="group bg-white rounded-[24px] p-6 border border-[#eee] transition-all duration-300 hover:translate-y-[-10px] hover:shadow-2xl shadow-sky-950/5">
              <div className="w-full aspect-square rounded-2xl bg-[#f5f5f5] mb-5 overflow-hidden flex items-center justify-center text-muted-foreground">
                [ PRODUCT IMAGE ]
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-bold">Product Title</h4>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest">Category</p>
                </div>
                <span className="text-lg font-bold font-['Space_Grotesk']">$48</span>
              </div>
            </div>

            {/* Alert/Status */}
            <div className="flex flex-col gap-4">
              <div className="bg-green-50 border border-green-100 p-4 rounded-2xl flex items-center gap-3 text-green-700">
                <div className="bg-white p-1 rounded-full shadow-sm"><Check className="w-3 h-3" /></div>
                <span className="text-sm font-medium">Action successful</span>
              </div>
              <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex items-center gap-3 text-rose-700">
                <div className="bg-white p-1 rounded-full shadow-sm"><AlertCircle className="w-3 h-3" /></div>
                <span className="text-sm font-medium">Critical error occurred</span>
              </div>
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex items-center gap-3 text-blue-700">
                <div className="bg-white p-1 rounded-full shadow-sm"><Info className="w-3 h-3" /></div>
                <span className="text-sm font-medium">Update available</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#111] text-white py-12 px-4 text-center">
        <p className="text-sm text-muted-foreground mb-4">glow.co — Design System v2.0</p>
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-all"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      </footer>
    </div>
  )
}
