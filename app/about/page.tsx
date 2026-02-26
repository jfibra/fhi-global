import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { TopBar } from "@/components/topbar"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import {
  Building2, TrendingUp, Users, Globe, Award, Shield,
  CheckCircle2, MapPin, ArrowRight, Star, Zap, Heart
} from "lucide-react"

export const metadata: Metadata = {
  title: "About FHI Global | Dubai Real Estate Excellence",
  description: "Learn about FHI Global — Dubai's trusted real estate platform connecting buyers with the finest residential and commercial developments.",
  openGraph: {
    title: "About FHI Global | Dubai Real Estate Excellence",
    description: "Dubai's trusted real estate platform connecting buyers with the finest developments.",
    type: "website",
  },
}

const STATS = [
  { icon: Building2, value: "100+",  label: "Verified Developers" },
  { icon: TrendingUp, value: "500+",  label: "Premium Projects" },
  { icon: Users,      value: "10K+",  label: "Happy Clients" },
  { icon: Globe,      value: "25+",   label: "Countries Served" },
]

const VALUES = [
  {
    icon: Shield,
    title:  "Trust & Transparency",
    desc:   "Every developer and project on our platform is thoroughly verified. We believe in honest, clear information so clients can decide with confidence.",
    color:  "#001f3f",
  },
  {
    icon: Zap,
    title:  "Innovation First",
    desc:   "We continuously build smarter tools — from real-time project tracking to commission dashboards — so our agents always stay ahead.",
    color:  "#d6b357",
  },
  {
    icon: Heart,
    title:  "Client-Centered",
    desc:   "Every feature we build starts with one question: how does this make life easier for our clients and agents in Dubai?",
    color:  "#001f3f",
  },
  {
    icon: Globe,
    title:  "Global Reach",
    desc:   "We connect international buyers with Dubai's finest properties, bridging cultures and creating seamless cross-border transactions.",
    color:  "#d6b357",
  },
]

const TEAM = [
  {
    name:  "Khalid Al Mansoori",
    role:  "Chief Executive Officer",
    bio:   "20+ years in UAE real estate. Former head of EMAAR sales division.",
    initials: "KM",
  },
  {
    name:  "Sara Lindqvist",
    role:  "Chief Operating Officer",
    bio:   "Nordic efficiency meets Dubai ambition. Operations leader with PropTech background.",
    initials: "SL",
  },
  {
    name:  "Ravi Shankar",
    role:  "Chief Technology Officer",
    bio:   "Built scalable platforms for leading Gulf financial institutions for 15 years.",
    initials: "RS",
  },
  {
    name:  "Aisha Mohammed",
    role:  "Head of Developer Relations",
    bio:   "Deep relationships with Dubai's top 50 developers built over a decade.",
    initials: "AM",
  },
]

const MILESTONES = [
  { year: "2015", title: "Founded in Dubai", desc: "FHI Global was established with a vision to modernise real estate sales in the UAE." },
  { year: "2018", title: "100+ Developers", desc: "Reached our first major milestone — onboarding over a hundred verified Dubai developers." },
  { year: "2021", title: "Platform Launch", desc: "Launched our proprietary CRM platform, transforming how agents track and close deals." },
  { year: "2024", title: "Global Expansion", desc: "Extended our reach to 25+ countries, helping international buyers access Dubai property." },
]

export default function AboutPage() {
  return (
    <div className="relative min-h-screen bg-[#fafafa] font-sans overflow-x-hidden">
      {/* Ambient blobs */}
      <div className="fixed top-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-20 blur-[120px] -z-10 bg-[radial-gradient(circle,rgb(200,245,255)_0%,rgba(255,255,255,0)_70%)]" />
      <div className="fixed bottom-0 right-[-5%] w-[500px] h-[500px] rounded-full opacity-15 blur-[120px] -z-10 bg-[radial-gradient(circle,rgb(250,240,210)_0%,rgba(255,255,255,0)_70%)]" />

      <TopBar />
      <Header />

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative bg-gradient-to-br from-[#001f3f] via-[#002a52] to-[#001428] pt-20 pb-24 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "28px 28px" }}
        />
        <div className="absolute top-[-80px] left-[-80px] w-[500px] h-[500px] rounded-full opacity-25 blur-[130px] bg-[radial-gradient(circle,#d6b357,transparent)]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full opacity-15 blur-[100px] bg-[radial-gradient(circle,#4bb8f0,transparent)]" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#d6b357]/50 to-transparent" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 border border-white/20 rounded-full text-xs font-medium text-white/80 mb-6 backdrop-blur-sm">
            <MapPin className="w-3.5 h-3.5 text-[#d6b357]" />
            Based in Dubai, UAE
          </div>

          <h1
            className="font-['Space_Grotesk'] text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-[1.1] tracking-tight mb-6"
            style={{ textShadow: "0 2px 30px rgba(0,0,0,0.4)" }}
          >
            We Are{" "}
            <span className="italic font-normal text-transparent bg-clip-text bg-gradient-to-r from-[#d6b357] to-[#f0d890]">
              FHI Global
            </span>
          </h1>

          <p className="text-white/60 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed mb-10">
            Dubai&apos;s most trusted real estate platform — connecting visionary developers,
            dedicated agents, and global buyers since 2015.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/developers"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-[#d6b357] to-[#f0d890] text-[#001f3f] rounded-full font-bold text-sm hover:translate-y-[-2px] hover:shadow-[0_12px_28px_rgba(214,179,87,0.4)] transition-all duration-300"
            >
              Browse Developers <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white/10 border border-white/20 backdrop-blur-sm text-white rounded-full font-semibold text-sm hover:bg-white/15 hover:border-white/35 transition-all duration-300"
            >
              Get in Touch
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats bar ─────────────────────────────────────────── */}
      <section className="bg-white border-b border-[#e8eaed]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-0 md:divide-x divide-[#f0f0f0]">
          {STATS.map(({ icon: Icon, value, label }) => (
            <div key={label} className="flex flex-col items-center text-center px-6">
              <div className="w-10 h-10 rounded-xl bg-[#001f3f]/6 flex items-center justify-center mb-3">
                <Icon className="w-5 h-5 text-[#001f3f]" />
              </div>
              <p className="font-['Space_Grotesk'] text-3xl font-bold text-[#001f3f] leading-none mb-1">{value}</p>
              <p className="text-xs text-[#9ca3af] font-medium uppercase tracking-wider">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Our Story ─────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-flex items-center px-3 py-1.5 bg-white border border-[#e5e5e5] rounded-full text-xs font-semibold uppercase tracking-wider mb-5 shadow-sm">
              <span className="w-2 h-2 bg-[#d6b357] rounded-full mr-2" /> Our Story
            </div>
            <h2 className="font-['Space_Grotesk'] text-4xl md:text-5xl font-bold text-[#0d1117] leading-tight tracking-tight mb-6">
              A Decade of{" "}
              <span className="italic font-normal text-transparent bg-clip-text bg-gradient-to-r from-[#001f3f] to-[#d6b357]">
                Building Trust
              </span>
            </h2>
            <div className="space-y-4 text-[#374151] leading-relaxed">
              <p>
                FHI Global was born from a simple frustration: Dubai&apos;s incredible real estate market was
                fragmented, opaque, and difficult to navigate — for agents, developers, and buyers alike.
              </p>
              <p>
                We set out to change that. Starting with a small team in DIFC, we built the relationships,
                the technology, and the trust that today powers hundreds of transactions every month.
              </p>
              <p>
                Today, FHI Global is the backbone of Dubai property sales for over 100 premium developers
                and thousands of agents across the globe. Our platform tracks every deal, every commission,
                and every milestone — in real time.
              </p>
            </div>
          </div>

          {/* Timeline */}
          <div className="relative">
            <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-[#d6b357]/50 via-[#001f3f]/20 to-transparent" />
            <div className="space-y-8">
              {MILESTONES.map(({ year, title, desc }) => (
                <div key={year} className="flex items-start gap-6 pl-14 relative">
                  <div className="absolute left-0 w-12 h-12 rounded-xl bg-gradient-to-br from-[#001f3f] to-[#002a52] border border-[#d6b357]/30 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-[#d6b357] tracking-wider">{year}</span>
                  </div>
                  <div>
                    <h3 className="font-['Space_Grotesk'] font-bold text-[#0d1117] mb-1">{title}</h3>
                    <p className="text-sm text-[#6b7280] leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Values ────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-[#001f3f] via-[#002a52] to-[#001428] py-20 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "28px 28px" }}
        />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#d6b357]/40 to-transparent" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <div className="inline-flex items-center px-3 py-1.5 bg-white/10 border border-white/20 rounded-full text-xs font-semibold uppercase tracking-wider mb-5 text-white/70 backdrop-blur-sm">
              <span className="w-2 h-2 bg-[#d6b357] rounded-full mr-2" /> Our Values
            </div>
            <h2 className="font-['Space_Grotesk'] text-4xl md:text-5xl font-bold text-white leading-tight tracking-tight">
              What We Stand For
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {VALUES.map(({ icon: Icon, title, desc, color }) => (
              <div
                key={title}
                className="group bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#d6b357]/30 rounded-[24px] p-7 transition-all duration-300 hover:translate-y-[-4px]"
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 transition-transform group-hover:scale-110 duration-300"
                  style={{ backgroundColor: `${color}20`, border: `1px solid ${color}30` }}
                >
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <h3 className="font-['Space_Grotesk'] font-bold text-white mb-3 text-lg">{title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Awards & Recognition ──────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-14">
          <div className="inline-flex items-center px-3 py-1.5 bg-white border border-[#e5e5e5] rounded-full text-xs font-semibold uppercase tracking-wider mb-5 shadow-sm">
            <span className="w-2 h-2 bg-[#d6b357] rounded-full mr-2" /> Recognition
          </div>
          <h2 className="font-['Space_Grotesk'] text-4xl md:text-5xl font-bold text-[#0d1117] leading-tight tracking-tight">
            Industry{" "}
            <span className="italic font-normal text-transparent bg-clip-text bg-gradient-to-r from-[#001f3f] to-[#d6b357]">
              Awards
            </span>
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { award: "Best PropTech Platform", org: "Dubai Land Department", year: "2023", icon: Award },
            { award: "Top Real Estate CRM", org: "Gulf Real Estate Awards", year: "2022", icon: Star },
            { award: "Innovation Excellence", org: "GITEX Technology Week",  year: "2023", icon: Zap },
          ].map(({ award, org, year, icon: Icon }) => (
            <div
              key={award}
              className="group flex items-start gap-5 p-6 bg-white rounded-[24px] border border-[#e8eaed] shadow-sm hover:shadow-lg hover:border-[#d6b357]/30 hover:translate-y-[-4px] transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#d6b357]/15 to-[#f0d890]/10 border border-[#d6b357]/20 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-[#d6b357]" />
              </div>
              <div>
                <p className="font-['Space_Grotesk'] font-bold text-[#0d1117] mb-0.5">{award}</p>
                <p className="text-sm text-[#6b7280]">{org}</p>
                <span className="inline-block mt-2 px-2 py-0.5 rounded-full bg-[#f7f8fa] border border-[#e8eaed] text-[10px] font-bold text-[#9ca3af] uppercase tracking-wider">{year}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Leadership Team ───────────────────────────────────── */}
      <section className="bg-[#f5f3ef] py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <div className="inline-flex items-center px-3 py-1.5 bg-white border border-[#e5e5e5] rounded-full text-xs font-semibold uppercase tracking-wider mb-5 shadow-sm">
              <span className="w-2 h-2 bg-[#d6b357] rounded-full mr-2" /> Leadership
            </div>
            <h2 className="font-['Space_Grotesk'] text-4xl md:text-5xl font-bold text-[#0d1117] leading-tight tracking-tight">
              Meet the{" "}
              <span className="italic font-normal text-transparent bg-clip-text bg-gradient-to-r from-[#001f3f] to-[#d6b357]">
                Team
              </span>
            </h2>
            <p className="text-[#6b7280] text-lg max-w-xl mx-auto mt-4">
              Experienced professionals united by a passion for Dubai real estate and technology.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {TEAM.map(({ name, role, bio, initials }) => (
              <div
                key={name}
                className="group bg-white rounded-[24px] border border-[#e8eaed] p-7 shadow-sm hover:shadow-xl hover:border-[#d6b357]/20 hover:translate-y-[-6px] transition-all duration-300"
              >
                {/* Avatar */}
                <div className="w-16 h-16 rounded-[18px] bg-gradient-to-br from-[#001f3f] to-[#002a52] flex items-center justify-center mb-5 shadow-md">
                  <span className="font-['Space_Grotesk'] text-lg font-bold text-[#d6b357]">{initials}</span>
                </div>
                <h3 className="font-['Space_Grotesk'] font-bold text-[#0d1117] mb-0.5">{name}</h3>
                <p className="text-xs font-semibold text-[#d6b357] uppercase tracking-wider mb-3">{role}</p>
                <p className="text-sm text-[#6b7280] leading-relaxed">{bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trusted by ────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-white/40 backdrop-blur-2xl rounded-[32px] border border-white border-opacity-60 shadow-xl shadow-black/5 p-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div>
              <div className="inline-flex items-center px-3 py-1.5 bg-white border border-[#e5e5e5] rounded-full text-xs font-semibold uppercase tracking-wider mb-5 shadow-sm">
                <span className="w-2 h-2 bg-[#d6b357] rounded-full mr-2" /> Trusted Partner
              </div>
              <h2 className="font-['Space_Grotesk'] text-3xl md:text-4xl font-bold text-[#0d1117] leading-tight mb-4">
                Preferred by Dubai&apos;s{" "}
                <span className="italic font-normal text-transparent bg-clip-text bg-gradient-to-r from-[#001f3f] to-[#d6b357]">
                  Best Developers
                </span>
              </h2>
              <p className="text-[#6b7280] leading-relaxed mb-6">
                From EMAAR and DAMAC to the newest boutique developers, FHI Global is the platform they trust to handle their sales operations.
              </p>
              <div className="space-y-2.5">
                {[
                  "Dedicated account managers for every developer",
                  "Real-time sales and commission tracking",
                  "Branded portals and marketing support",
                ].map((point) => (
                  <div key={point} className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-[#d6b357] shrink-0" />
                    <span className="text-sm text-[#374151]">{point}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-center lg:justify-end">
              <Image
                src="/FHI_Branding.png"
                alt="FHI Global"
                width={220}
                height={66}
                className="object-contain opacity-80"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="relative bg-gradient-to-br from-[#001f3f] via-[#002a52] to-[#001428] rounded-[40px] overflow-hidden p-1">
          <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
          <div className="absolute top-[-80px] left-[-80px] w-[400px] h-[400px] rounded-full opacity-30 blur-[120px] bg-[radial-gradient(circle,#d6b357,transparent)]" />
          <div className="relative bg-white/5 rounded-[38px] backdrop-blur-sm p-14 md:p-20 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 border border-white/20 rounded-full text-xs font-medium text-white/70 mb-6 backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-[#d6b357] animate-pulse" />
              Join Our Network
            </div>
            <h2
              className="font-['Space_Grotesk'] text-4xl md:text-6xl font-bold text-white leading-tight tracking-tight mb-4"
              style={{ textShadow: "0 2px 20px rgba(0,0,0,0.3)" }}
            >
              Ready to{" "}
              <span className="italic font-normal text-transparent bg-clip-text bg-gradient-to-r from-[#d6b357] to-[#f0d890]">
                Get Started?
              </span>
            </h2>
            <p className="text-white/55 text-lg max-w-xl mx-auto mb-10">
              Whether you&apos;re a developer, an agent, or an investor — FHI Global has the tools and the team to take you further.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 px-9 py-[18px] bg-gradient-to-r from-[#d6b357] to-[#f0d890] text-[#001f3f] rounded-full font-bold hover:translate-y-[-2px] hover:shadow-[0_12px_28px_rgba(214,179,87,0.4)] transition-all duration-300"
              >
                Create Account <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 px-9 py-[18px] bg-[rgba(255,255,255,0.08)] border border-white/20 text-white rounded-full font-semibold hover:bg-white/15 hover:border-white/35 transition-all duration-300"
              >
                Talk to Us
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
