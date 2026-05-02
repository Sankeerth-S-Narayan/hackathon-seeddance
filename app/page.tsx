'use client'
import { useState, useEffect, useRef, useCallback } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

type View  = 'landing' | 'app'
type Stage = 'pending' | 'uploading' | 'generating_prompt' | 'generating_video' | 'succeeded' | 'failed'

interface JobStatus {
  status:      Stage
  error?:      string
  address?:    string
  price?:      number
  beds?:       number
  baths?:      number
  sqft?:       number
  lot_size?:   string
  year_built?: number
  description?: string
  highlights?: string[]
  url?:        string
}

interface HistoryEntry {
  jobId:     string
  address:   string
  createdAt: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STEPS: { key: Stage; label: string; detail: string }[] = [
  {
    key: 'uploading',
    label: 'Analyzing the property',
    detail: 'Fetching listing details, photos and features — then re-hosting images for video production.',
  },
  {
    key: 'generating_prompt',
    label: 'Crafting the marketing script',
    detail: 'Your AI marketing agent writes a cinematic video script tailored to this property\'s unique selling points.',
  },
  {
    key: 'generating_video',
    label: 'Producing the video',
    detail: 'Rendering a cinematic property reel with smooth motion, voiceover narration, and branded text overlays.',
  },
]

const STEP_ORDER: Stage[] = ['uploading', 'generating_prompt', 'generating_video', 'succeeded']

// ── Helpers ───────────────────────────────────────────────────────────────────

function stepIndex(s: Stage) { return STEP_ORDER.indexOf(s) }

function formatPrice(p?: number) {
  if (!p) return ''
  return p >= 1_000_000
    ? `$${(p / 1_000_000).toFixed(p % 1_000_000 === 0 ? 0 : 1)}M`
    : `$${(p / 1000).toFixed(0)}K`
}

function timeAgo(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000
  if (d < 60)    return 'Just now'
  if (d < 3600)  return `${Math.floor(d / 60)}m ago`
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`
  return `${Math.floor(d / 86400)}d ago`
}

// ── SVG Icons ─────────────────────────────────────────────────────────────────

function IcoArrow()  { return <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/></svg> }
function IcoCheck()  { return <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg> }
function IcoX()      { return <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg> }
function IcoPlay()   { return <svg className="w-6 h-6 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"/></svg> }
function IcoVideo()  { return <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z"/></svg> }
function IcoBed()    { return <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"/></svg> }
function IcoDown()   { return <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg> }
function IcoLink()   { return <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"/></svg> }

// ── Logo mark ─────────────────────────────────────────────────────────────────

function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'sm' ? 'w-6 h-6 rounded-lg' : size === 'lg' ? 'w-10 h-10 rounded-xl' : 'w-8 h-8 rounded-xl'
  const t = size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'
  return (
    <div className={`${s} bg-gradient-to-br from-rose-500 via-pink-500 to-violet-600 flex items-center justify-center shadow-lg shadow-rose-500/30 shrink-0`}>
      <svg className={`${t} text-white`} fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 3C8.5 3 5.5 5.5 5.5 9c0 3 2 5.5 4.5 7.5L12 18l2-1.5C16.5 14.5 18.5 12 18.5 9 18.5 5.5 15.5 3 12 3z"/>
      </svg>
    </div>
  )
}

// ── Landing page ──────────────────────────────────────────────────────────────

function LandingPage({ onStart }: { onStart: () => void }) {
  return (
    <div className="min-h-screen bg-[#06060b] text-white overflow-x-hidden">

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 lg:px-10 py-4 border-b border-white/[0.06] backdrop-blur-2xl bg-[#06060b]/80">
        <div className="flex items-center gap-2.5">
          <Logo size="sm" />
          <span className="font-bold text-sm tracking-tight">RealEstate Dance</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-1.5 text-[11px] bg-white/4 border border-white/8 rounded-full px-3 py-1.5 text-gray-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            AI-powered · Instant · Professional
          </div>
          <button onClick={onStart} className="bg-rose-500 hover:bg-rose-400 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors shadow-lg shadow-rose-500/25">
            Get started free
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-36 pb-28 px-6 text-center overflow-hidden">
        <div className="absolute inset-0 pointer-events-none select-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-rose-600/6 rounded-full blur-[160px]" />
          <div className="absolute top-24 right-1/4 w-[500px] h-[350px] bg-violet-600/5 rounded-full blur-[120px]" />
          <div className="absolute inset-0 opacity-[0.018]"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg,rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '64px 64px' }} />
        </div>

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 rounded-full px-4 py-1.5 text-xs text-rose-300 mb-8 tracking-wide animate-fade-in">
            <span className="font-semibold">Your AI marketing agent</span>
            <span className="w-px h-3 bg-rose-500/40" />
            Cinematic property videos in minutes
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-[5.5rem] font-bold tracking-tight leading-[1.05] mb-6 animate-slide-up">
            Every listing<br />
            <span className="bg-gradient-to-r from-rose-400 via-pink-300 to-violet-400 bg-clip-text text-transparent">
              has a story to tell
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed mb-10 animate-slide-up" style={{ animationDelay: '0.05s' }}>
            RealEstate Dance is the AI marketing agent that turns any property listing
            into a cinematic video reel — automatically. No crew. No editing. No waiting.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-20 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <button onClick={onStart} className="group bg-white text-black font-bold px-8 py-4 rounded-2xl text-base hover:bg-gray-100 transition-colors flex items-center justify-center gap-2 shadow-2xl shadow-white/10">
              Create your first video
              <span className="group-hover:translate-x-0.5 transition-transform"><IcoArrow /></span>
            </button>
            <a href="#how" className="border border-white/10 text-gray-300 font-medium px-8 py-4 rounded-2xl text-base hover:bg-white/5 transition-colors flex items-center justify-center">
              See how it works
            </a>
          </div>

          {/* Real sample video */}
          <div className="relative max-w-3xl mx-auto animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <div className="relative rounded-3xl overflow-hidden border border-white/10 shadow-[0_40px_120px_rgba(0,0,0,0.75)] bg-black">
              <video
                src="/api/video/2ef4862f-072b-4129-9959-ccb72b6c7322"
                autoPlay
                loop
                muted
                playsInline
                className="w-full aspect-video object-cover block"
              />
            </div>
            <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 w-3/4 h-20 bg-rose-600/12 blur-[60px] rounded-full pointer-events-none" />
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="py-28 px-6 max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-xs font-semibold text-rose-400 uppercase tracking-widest mb-3">The problem</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-5 leading-snug">
            Buyers scroll past static listings.<br />Video is the new curb appeal.
          </h2>
          <p className="text-gray-400 max-w-lg mx-auto text-base leading-relaxed">
            Properties with video marketing receive <span className="text-white font-semibold">403% more inquiries</span>. But producing professional video has always been too expensive, too slow, or too complicated — until now.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {[
            {
              title: 'Traditional video production',
              cost: 'Costs $800–$2,500 per listing',
              points: ['Scheduling shoots takes days', 'Editing adds another week', 'Prices make it unscalable'],
              grad: 'from-rose-500/8',
              border: 'border-rose-500/15',
            },
            {
              title: 'Hiring a freelance editor',
              cost: 'Costs $200–$600 per video',
              points: ['Back-and-forth creative briefs', 'Multiple revision rounds', 'Inconsistent quality'],
              grad: 'from-orange-500/8',
              border: 'border-orange-500/15',
            },
            {
              title: 'DIY video tools',
              cost: 'Costs 4–8 hours per listing',
              points: ['Steep learning curve', 'Still looks unprofessional', 'No time for every listing'],
              grad: 'from-amber-500/8',
              border: 'border-amber-500/15',
            },
          ].map(p => (
            <div key={p.title} className={`rounded-2xl bg-gradient-to-b ${p.grad} to-transparent border ${p.border} p-6`}>
              <div className="flex items-start gap-2.5 mb-4">
                <div className="w-5 h-5 rounded-full bg-rose-500/15 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0 mt-0.5">
                  <IcoX />
                </div>
                <div>
                  <p className="font-semibold text-white text-sm">{p.title}</p>
                  <p className="text-[11px] text-rose-300/60 mt-0.5 font-medium">{p.cost}</p>
                </div>
              </div>
              <ul className="space-y-2 pl-7">
                {p.points.map(pt => (
                  <li key={pt} className="text-sm text-gray-500 flex items-start gap-1.5">
                    <span className="text-gray-700 mt-0.5 shrink-0">–</span>{pt}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-28 px-6 max-w-6xl mx-auto scroll-mt-20">
        <div className="text-center mb-16">
          <p className="text-xs font-semibold text-emerald-400 uppercase tracking-widest mb-3">How it works</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-5 leading-snug">
            Paste a URL. Get a<br />professional marketing video.
          </h2>
          <p className="text-gray-400 max-w-lg mx-auto text-base leading-relaxed">
            RealEstate Dance handles everything — research, scripting, production — so you can focus on closing, not content creation.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5 relative">
          <div className="hidden md:block absolute top-[52px] left-[calc(33.33%+16px)] right-[calc(33.33%+16px)] h-px bg-gradient-to-r from-rose-500/30 via-violet-500/40 to-pink-500/30" />
          {[
            {
              n: '01',
              color: 'bg-rose-500/10 border-rose-500/20 text-rose-300',
              title: 'Instant property analysis',
              role: 'No copy-paste required',
              detail: 'Paste any listing URL. RealEstate Dance automatically gathers the property photos, features, description, and unique highlights — building a complete marketing brief in seconds.',
            },
            {
              n: '02',
              color: 'bg-violet-500/10 border-violet-500/20 text-violet-300',
              title: 'AI writes your script',
              role: 'Cinematic direction, tailored to the property',
              detail: 'Your AI marketing agent analyzes the property\'s unique selling points and crafts a cinematic script — specifying the right camera movements, narration tone, and on-screen messaging.',
            },
            {
              n: '03',
              color: 'bg-pink-500/10 border-pink-500/20 text-pink-300',
              title: 'Cinematic video rendered',
              role: 'Professional cinematic marketing reel',
              detail: 'A professional-grade property video is produced — with smooth cinematic motion across multiple property photos, warm color grading, voiceover narration, and branded text overlays.',
            },
          ].map(s => (
            <div key={s.n} className="group relative bg-white/[0.025] border border-white/8 rounded-2xl p-6 hover:border-white/14 hover:bg-white/[0.035] transition-all">
              <div className="flex items-center justify-between mb-5">
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 font-bold text-sm ${s.color}`}>
                  {s.n}
                </div>
                <span className="text-4xl font-black text-white/[0.03] group-hover:text-white/[0.06] transition-colors font-mono">{s.n}</span>
              </div>
              <h3 className="font-bold text-white mb-1">{s.title}</h3>
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3">{s.role}</p>
              <p className="text-gray-400 text-sm leading-relaxed">{s.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="py-14 border-y border-white/[0.05] bg-white/[0.01]">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 px-6 text-center">
          {[
            { value: '< 3 min', label: 'Listing URL to finished video' },
            { value: 'Cinematic', label: 'Smooth motion & AI voiceover' },
            { value: '4 shots', label: 'Multi-image AI production' },
            { value: '403%', label: 'More inquiries with video*' },
          ].map(s => (
            <div key={s.label}>
              <p className="text-3xl font-bold text-white mb-1.5">{s.value}</p>
              <p className="text-xs text-gray-500 leading-snug">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Who it's for */}
      <section className="py-28 px-6 max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-xs font-semibold text-violet-400 uppercase tracking-widest mb-3">Built for</p>
          <h2 className="text-3xl font-bold text-white mb-5">Who this is for</h2>
          <p className="text-gray-400 max-w-md mx-auto text-base leading-relaxed">
            Anyone in real estate who needs professional video marketing — at any volume, instantly.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { role: 'Real estate agents', desc: 'Stand out in every market. Give every listing a professional marketing video — before the competition even books a shoot.' },
            { role: 'Listing coordinators', desc: 'Multiply your throughput. Create video marketing assets for every listing in the time it takes to make coffee.' },
            { role: 'Brokerages & teams', desc: 'Build a consistent brand. Every agent, every listing — the same polished, professional video output.' },
            { role: 'Property managers', desc: 'Fill vacancies faster. Video listings outperform static photo-only posts by 2–3× on every major platform.' },
            { role: 'New construction & developers', desc: 'Market at scale. Generate a video for every unit, every floor plan, every phase — automatically.' },
            { role: 'PropTech platforms', desc: 'Embed AI video into your product. Our pipeline is composable and ready to integrate into any real estate platform.' },
          ].map(u => (
            <div key={u.role} className="bg-white/[0.025] border border-white/7 rounded-2xl p-5 hover:border-white/12 transition-colors group">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-400 group-hover:bg-rose-300 transition-colors" />
                <p className="font-semibold text-white text-sm">{u.role}</p>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">{u.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 px-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-rose-600/7 blur-[140px] rounded-full" />
        </div>
        <div className="relative max-w-xl mx-auto">
          <Logo size="lg" />
          <div className="mt-6 mb-4">
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4 leading-snug">
              Ready to market<br />smarter?
            </h2>
            <p className="text-gray-400 text-lg leading-relaxed">
              Your AI marketing agent is standing by. Paste a listing URL and get a professional video in minutes.
            </p>
          </div>
          <div className="mt-10">
            <button onClick={onStart} className="group bg-white text-black font-bold px-10 py-4 rounded-2xl text-base hover:bg-gray-100 transition-colors inline-flex items-center gap-2.5 shadow-2xl shadow-white/10">
              Start creating for free
              <span className="group-hover:translate-x-0.5 transition-transform"><IcoArrow /></span>
            </button>
            <p className="text-xs text-gray-600 mt-5">No account required · Takes ~3 minutes</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.05] py-8 px-6 flex flex-col sm:flex-row items-center justify-between gap-4 max-w-6xl mx-auto text-xs text-gray-600">
        <div className="flex items-center gap-2">
          <Logo size="sm" />
          <span className="text-gray-500 font-medium">RealEstate Dance</span>
          <span className="text-gray-700">· AI Real Estate Marketing Agent</span>
        </div>
        <p className="text-gray-700">*Based on NAR &amp; Inman video engagement research</p>
      </footer>
    </div>
  )
}

// ── Sidebar ────────────────────────────────────────────────────────────────────

function Sidebar({
  history, activeJobId, onSelect, onNew,
}: {
  history: HistoryEntry[]
  activeJobId: string | null
  onSelect: (h: HistoryEntry) => void
  onNew: () => void
}) {
  const [collapsed, setCollapsed] = useState(false)

  if (collapsed) {
    return (
      <aside className="w-12 shrink-0 bg-[#08080e] border-r border-white/[0.06] flex flex-col items-center py-3 gap-3 h-full transition-all">
        <button onClick={() => setCollapsed(false)} title="Expand sidebar" className="w-7 h-7 rounded-lg bg-white/6 hover:bg-white/12 border border-white/8 text-gray-400 hover:text-white flex items-center justify-center transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
        </button>
        <button onClick={onNew} title="New video" className="w-7 h-7 rounded-lg bg-white/6 hover:bg-white/12 border border-white/8 text-gray-400 hover:text-white flex items-center justify-center text-base transition-colors">
          +
        </button>
      </aside>
    )
  }

  return (
    <aside className="w-60 shrink-0 bg-[#08080e] border-r border-white/[0.06] flex flex-col h-full transition-all">
      {/* Brand */}
      <div className="px-4 py-4 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <Logo size="sm" />
          <div className="min-w-0">
            <p className="font-bold text-white text-[13px] leading-none truncate">RealEstate Dance</p>
            <p className="text-[10px] text-gray-600 mt-0.5">AI Real Estate Marketing Agent</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onNew} title="New video" className="w-7 h-7 rounded-lg bg-white/6 hover:bg-white/12 border border-white/8 text-white flex items-center justify-center text-base transition-colors">
            +
          </button>
          <button onClick={() => setCollapsed(true)} title="Collapse sidebar" className="w-7 h-7 rounded-lg bg-white/6 hover:bg-white/12 border border-white/8 text-gray-400 hover:text-white flex items-center justify-center transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
          </button>
        </div>
      </div>

      {/* History */}
      <div className="flex-1 overflow-y-auto py-2 min-h-0">
        {history.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <div className="w-10 h-10 rounded-xl bg-white/4 border border-white/6 flex items-center justify-center mx-auto mb-3 text-gray-600">
              <IcoVideo />
            </div>
            <p className="text-gray-600 text-xs font-medium">No videos yet</p>
            <p className="text-gray-700 text-[11px] mt-1 leading-snug">Your generated reels appear here</p>
          </div>
        ) : (
          <>
            <p className="px-4 mb-2 text-[10px] text-gray-600 uppercase tracking-widest font-semibold">Recent videos</p>
            <ul className="space-y-0.5 px-2">
              {history.map(h => {
                const active = h.jobId === activeJobId
                return (
                  <li key={h.jobId}>
                    <button
                      onClick={() => onSelect(h)}
                      className={`w-full text-left px-3 py-3 rounded-xl transition-all ${
                        active
                          ? 'bg-rose-500/12 border border-rose-500/20'
                          : 'hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      <p className={`text-xs font-semibold leading-snug line-clamp-1 ${active ? 'text-white' : 'text-gray-300'}`}>
                        {h.address?.split(',')[0] || 'Property'}
                      </p>
                      <p className="text-[10px] text-gray-600 mt-0.5">
                        {h.address?.split(',').slice(1, 2).join('').trim() || ''}
                      </p>
                      <p className="text-[10px] text-gray-700 mt-1">{timeAgo(h.createdAt)}</p>
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>
    </aside>
  )
}

// ── Step progress ─────────────────────────────────────────────────────────────

function StepProgress({ status, elapsedSec }: { status: Stage; elapsedSec: number }) {
  const cur = stepIndex(status)
  return (
    <div className="w-full max-w-xl mx-auto animate-slide-up">
      <div className="flex items-center gap-4 mb-10">
        <div className="relative w-10 h-10 shrink-0">
          <svg className="animate-spin-slow w-10 h-10 absolute inset-0" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="16" stroke="white" strokeOpacity="0.06" strokeWidth="3" />
            <path d="M20 4 a16 16 0 0 1 16 16" stroke="url(#sp2)" strokeWidth="3" strokeLinecap="round" />
            <defs>
              <linearGradient id="sp2" x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#fb7185" /><stop offset="1" stopColor="#a78bfa" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-rose-400" />
          </div>
        </div>
        <div>
          <p className="font-bold text-white text-base">Your AI agent is working</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {Math.floor(elapsedSec / 60)}:{String(elapsedSec % 60).padStart(2, '0')} elapsed
            <span className="text-gray-700 ml-2">· typically 4–6 min</span>
          </p>
        </div>
      </div>

      <div className="space-y-1">
        {STEPS.map((step, i) => {
          const done   = cur > i
          const active = cur === i
          const future = cur < i
          return (
            <div key={step.key} className={`flex gap-4 transition-opacity duration-300 ${future ? 'opacity-25' : 'opacity-100'}`}>
              <div className="flex flex-col items-center pt-0.5">
                <div className={`relative w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all duration-500 ${
                  done   ? 'bg-emerald-500 text-white'
                  : active ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/40'
                  : 'bg-white/6 text-gray-600 border border-white/10'
                }`}>
                  {done ? <IcoCheck /> : <span>{i + 1}</span>}
                  {active && <span className="absolute inset-0 rounded-full bg-rose-500/30 animate-ping" />}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`w-px flex-1 my-1 min-h-[28px] transition-colors duration-700 ${done ? 'bg-emerald-500/40' : 'bg-white/6'}`} />
                )}
              </div>
              <div className="pb-5 flex-1 min-w-0 last:pb-0">
                <p className={`font-semibold text-sm mb-0.5 ${active ? 'text-white' : done ? 'text-gray-400' : 'text-gray-600'}`}>
                  {step.label}
                </p>
                {active && (
                  <>
                    <p className="text-[11px] text-gray-500 leading-snug mb-2">{step.detail}</p>
                    <div className="h-0.5 w-32 rounded-full overflow-hidden bg-white/6">
                      <div className="h-full step-shimmer rounded-full w-full" />
                    </div>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Video + property detail result ────────────────────────────────────────────

function VideoResult({ jobId, job }: { jobId: string; job: JobStatus }) {
  const proxyUrl = `/api/video/${jobId}`
  const [copied, setCopied] = useState(false)

  function copyLink() {
    navigator.clipboard.writeText(window.location.origin + proxyUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2200)
  }

  const city = job.address?.split(',').slice(1, 2).join('').trim() ?? ''
  const stateZip = job.address?.split(',').slice(2).join('').trim() ?? ''

  return (
    <div className="w-full max-w-5xl mx-auto animate-slide-up">
      {/* Two-column layout: video left, details right */}
      <div className="grid lg:grid-cols-[1fr_380px] gap-5">

        {/* Left: video */}
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl overflow-hidden border border-white/8 shadow-2xl shadow-black/60 bg-black">
            <video src={proxyUrl} controls autoPlay loop playsInline className="w-full aspect-video bg-black block" />
          </div>

          {/* Action buttons */}
          <div className="flex gap-2.5">
            <a
              href={proxyUrl}
              download="property_reel.mp4"
              className="flex-1 flex items-center justify-center gap-2 bg-white text-black font-semibold py-3 rounded-xl hover:bg-gray-100 transition-colors text-sm"
            >
              <IcoDown /> Download MP4
            </a>
            <button
              onClick={copyLink}
              className={`flex-1 flex items-center justify-center gap-2 border font-semibold py-3 rounded-xl transition-all text-sm ${
                copied
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                  : 'border-white/10 bg-white/6 text-white hover:bg-white/10'
              }`}
            >
              <IcoLink /> {copied ? 'Link copied!' : 'Share link'}
            </button>
          </div>

          {/* Attribution */}
          <div className="flex items-center justify-center gap-2 text-[11px] text-gray-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/60" />
            AI-generated marketing video · RealEstate Dance
          </div>
        </div>

        {/* Right: property detail */}
        <div className="flex flex-col gap-4">

          {/* Address + stats card */}
          <div className="rounded-2xl border border-white/8 bg-[#0d0d18] p-5">
            <div className="mb-4">
              <h2 className="font-bold text-xl text-white leading-tight">
                {job.address?.split(',')[0]}
              </h2>
              {(city || stateZip) && (
                <p className="text-gray-500 text-sm mt-0.5">{[city, stateZip].filter(Boolean).join(', ')}</p>
              )}
            </div>

            {!!job.price && (
              <p className="text-3xl font-bold text-white mb-4">{formatPrice(job.price)}</p>
            )}

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2 text-sm mb-4">
              {[
                job.beds       && job.beds > 0       && { label: 'Bedrooms',    value: `${job.beds}` },
                job.baths      && job.baths > 0      && { label: 'Bathrooms',   value: `${job.baths}` },
                job.sqft       && job.sqft > 0       && { label: 'Living area', value: `${job.sqft.toLocaleString()} sqft` },
                job.lot_size                         && { label: 'Lot size',    value: job.lot_size },
                job.year_built && job.year_built > 0 && { label: 'Year built',  value: `${job.year_built}` },
              ].filter(Boolean).map((s: any) => (
                <div key={s.label} className="bg-white/4 border border-white/6 rounded-xl px-3 py-2.5">
                  <p className="text-[10px] text-gray-600 uppercase tracking-wider font-semibold mb-0.5">{s.label}</p>
                  <p className="text-white font-semibold text-sm">{s.value}</p>
                </div>
              ))}
            </div>

            {/* Highlights */}
            {(job.highlights ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {job.highlights!.slice(0, 6).map((h, i) => (
                  <span key={i} className="bg-white/5 border border-white/8 text-gray-400 text-[11px] px-2.5 py-1 rounded-full">
                    {h}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Description card */}
          {job.description && (
            <div className="rounded-2xl border border-white/8 bg-[#0d0d18] p-5">
              <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider mb-3">About this property</p>
              <p className="text-gray-400 text-xs leading-relaxed line-clamp-8">
                {job.description}
              </p>
            </div>
          )}

          {/* Original listing link */}
          {job.url && (
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 border border-white/8 bg-white/3 hover:bg-white/6 text-gray-400 hover:text-gray-200 transition-all text-xs font-medium py-3 rounded-xl"
            >
              <IcoLink /> View original listing
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Input form ─────────────────────────────────────────────────────────────────

function InputForm({ onSubmit, disabled }: { onSubmit: (url: string) => void; disabled: boolean }) {
  const [val, setVal] = useState('')
  const isUrl = val.startsWith('http') && val.includes('.')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (val.trim() && isUrl) onSubmit(val.trim())
  }

  return (
    <div className="w-full max-w-2xl mx-auto animate-slide-up">
      <div className="mb-10 text-center">
        <div className="flex justify-center mb-5">
          <Logo size="md" />
        </div>
        <h2 className="text-3xl font-bold text-white mb-2.5">Create a marketing video</h2>
        <p className="text-gray-500 text-sm leading-relaxed max-w-sm mx-auto">
          Paste any property listing URL. Your AI marketing agent will analyze the listing and produce a cinematic video reel — automatically.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600">
            <IcoLink />
          </div>
          <input
            value={val}
            onChange={e => setVal(e.target.value)}
            disabled={disabled}
            placeholder="Paste your property listing URL here…"
            className="w-full bg-white/[0.04] border border-white/10 rounded-2xl pl-10 pr-28 py-4 text-white placeholder-gray-600 focus:outline-none focus:border-rose-500/40 focus:bg-white/[0.06] transition-all text-sm"
          />
          {val && (
            <div className={`absolute right-4 top-1/2 -translate-y-1/2 text-[11px] font-medium transition-colors ${isUrl ? 'text-emerald-400' : 'text-gray-600'}`}>
              {isUrl ? '✓ valid URL' : 'paste a URL'}
            </div>
          )}
        </div>
        <button
          type="submit"
          disabled={disabled || !isUrl}
          className="w-full bg-rose-500 hover:bg-rose-400 active:bg-rose-600 disabled:opacity-35 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl transition-colors text-sm shadow-lg shadow-rose-500/20"
        >
          {disabled ? 'Your agent is working…' : 'Generate marketing video →'}
        </button>
      </form>

      <div className="mt-8 grid grid-cols-3 gap-3">
        {[
          { n: '01', label: 'Property analysis',    sub: 'Extracts photos, features & details automatically' },
          { n: '02', label: 'AI script writing',    sub: 'Crafts a cinematic marketing script for this property' },
          { n: '03', label: 'Video production',     sub: 'Renders a professional cinematic marketing reel' },
        ].map(f => (
          <div key={f.label} className="bg-white/[0.025] border border-white/7 rounded-xl p-4 text-center">
            <span className="text-[11px] font-bold text-rose-400/70 font-mono">{f.n}</span>
            <p className="text-xs font-semibold text-gray-300 mt-1 leading-snug">{f.label}</p>
            <p className="text-[10px] text-gray-600 mt-1 leading-snug">{f.sub}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── App view ───────────────────────────────────────────────────────────────────

function AppView() {
  const [activeJobId, setActiveJobId]   = useState<string | null>(null)
  const [job, setJob]                   = useState<JobStatus | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [history, setHistory]           = useState<HistoryEntry[]>([])
  const [elapsed, setElapsed]           = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const elapsedRef  = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadHistory = useCallback(() => {
    fetch('/api/history').then(r => r.json()).then((data: any[]) => {
      setHistory(data.map(h => ({ jobId: h.jobId, address: h.address, createdAt: h.createdAt })))
    }).catch(() => {})
  }, [])

  useEffect(() => { loadHistory() }, [loadHistory])

  function startElapsed() {
    setElapsed(0)
    elapsedRef.current && clearInterval(elapsedRef.current)
    elapsedRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
  }
  function stopElapsed() { elapsedRef.current && clearInterval(elapsedRef.current) }

  async function handleSubmit(url: string) {
    setIsGenerating(true); setError(null); setActiveJobId(null)
    // Show progress immediately — scraping takes ~20s before the API responds
    setJob({ status: 'uploading' })
    startElapsed()
    const res  = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) })
    const data = await res.json()
    if (!res.ok) { setError(data.error); setIsGenerating(false); setJob(null); stopElapsed(); return }
    setActiveJobId(data.jobId)
    setJob(prev => prev?.status === 'uploading' ? { status: 'uploading' } : prev)
  }

  useEffect(() => {
    if (!activeJobId || !isGenerating) return
    intervalRef.current = setInterval(async () => {
      const res  = await fetch(`/api/status/${activeJobId}`)
      const data: JobStatus = await res.json()
      setJob(data)
      if (data.status === 'succeeded' || data.status === 'failed') {
        clearInterval(intervalRef.current!); setIsGenerating(false); stopElapsed(); loadHistory()
      }
    }, 5000)
    return () => clearInterval(intervalRef.current!)
  }, [activeJobId, isGenerating, loadHistory])

  async function handleSelectHistory(h: HistoryEntry) {
    setActiveJobId(h.jobId)
    setIsGenerating(false); setError(null); stopElapsed()
    intervalRef.current && clearInterval(intervalRef.current)
    // Fetch full details from status API
    try {
      const res  = await fetch(`/api/status/${h.jobId}`)
      const data: JobStatus = await res.json()
      setJob({ ...data, status: 'succeeded' })
    } catch {
      setJob({ status: 'succeeded', address: h.address })
    }
  }

  function handleNew() {
    setActiveJobId(null); setJob(null); setIsGenerating(false); setError(null); stopElapsed()
    intervalRef.current && clearInterval(intervalRef.current)
  }

  const showInput    = !isGenerating && job?.status !== 'succeeded'
  const showProgress = isGenerating && job && job.status !== 'succeeded' && job.status !== 'failed'
  const showResult   = job?.status === 'succeeded' && activeJobId

  return (
    <div className="flex h-screen bg-[#09090f] overflow-hidden">
      <Sidebar history={history} activeJobId={activeJobId} onSelect={handleSelectHistory} onNew={handleNew} />

      <main className="flex-1 overflow-y-auto flex flex-col">
        <div className={`flex-1 flex flex-col items-center px-8 py-12 min-h-full ${showResult ? 'justify-start' : 'justify-center'}`}>

          {error && (
            <div className="w-full max-w-2xl mb-6 animate-slide-up">
              <div className="bg-red-950/40 border border-red-800/40 rounded-2xl p-4 flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center shrink-0 mt-0.5 text-red-400"><IcoX /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-red-300 text-sm font-semibold mb-0.5">Something went wrong</p>
                  <p className="text-red-400/70 text-xs leading-relaxed">{error}</p>
                </div>
                <button onClick={handleNew} className="text-xs text-red-400 hover:text-red-300 underline shrink-0">Try again</button>
              </div>
            </div>
          )}

          {showInput    && <InputForm onSubmit={handleSubmit} disabled={isGenerating} />}
          {showProgress && <StepProgress status={job.status} elapsedSec={elapsed} />}
          {showResult   && <VideoResult jobId={activeJobId} job={job} />}
        </div>
      </main>
    </div>
  )
}

// ── Root ───────────────────────────────────────────────────────────────────────

export default function Home() {
  const [view, setView] = useState<View>('landing')
  return view === 'landing'
    ? <LandingPage onStart={() => setView('app')} />
    : <AppView />
}
