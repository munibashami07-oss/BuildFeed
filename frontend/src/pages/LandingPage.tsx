/**
 * BuildFeed Landing Page — dark-only redesign.
 *
 * Matches the reference screenshot:
 *  • Deep slate/indigo dark background (#0b0f19)
 *  • Sticky nav: logo + tagline + search bar + Login + Get Started
 *  • Hero: mountain-silhouette banner with violet glow + "Build > Learn > Grow" pill
 *  • Feed filter tabs row
 *  • 3 sample content cards (platform badge + relevance pill + tags + meta bar)
 *  • How-it-works 6-step section
 *  • Features grid
 *  • Final CTA
 *
 * All existing API hooks / auth context / routing are preserved.
 */

import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Layers,
  Search,
  ArrowRight,
  Github,
  Youtube,
  FileText,
  Bookmark,
  Heart,
  MoreHorizontal,
  Sparkles,
  CheckCircle2,
  Zap,
  Target,
  Map,
  TrendingUp,
  Presentation,
  Users,
  BrainCircuit,
  Hammer,
  LayoutTemplate,
  Shield,
  Code,
  Brain,
} from 'lucide-react';
import { useAuth } from '../features/auth/AuthContext';

// ─── tiny helpers ──────────────────────────────────────────────────────────
const Pill: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase ${className}`}>
    {children}
  </span>
);

const Tag: React.FC<{ label: string }> = ({ label }) => (
  <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#1e293b] border border-[#2d3a58] text-[#94a3b8]">
    {label}
  </span>
);

// ─── Sample card data (static demo only — real feed is behind auth) ────────
const DEMO_CARDS = [
  {
    id: 1,
    platform: 'GitHub',
    platformIcon: <Github size={11} />,
    platformCls: 'bg-slate-500/15 text-slate-300',
    relevance: 'Directly relevant',
    relevanceCls: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25',
    title: 'OWASP Top 10 for Beginners — Learn Web Application Security',
    desc: 'A simple and clear guide to the OWASP Top 10 vulnerabilities with real-world examples and mitigation steps.',
    tags: ['Cybersecurity', 'Beginner', 'Web Security', 'OWASP'],
    domain: 'github.com',
    age: '2 days ago',
    likes: 842,
  },
  {
    id: 2,
    platform: 'YouTube',
    platformIcon: <Youtube size={11} />,
    platformCls: 'bg-red-500/15 text-red-400',
    relevance: 'Directly relevant',
    relevanceCls: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25',
    title: 'Port Scanning and Nmap Tutorial for Beginners',
    desc: 'Learn how to use Nmap for network scanning and vulnerability discovery with easy step-by-step examples.',
    tags: ['Cybersecurity', 'Beginner', 'Networking', 'Nmap'],
    domain: 'YouTube',
    age: '1 day ago',
    likes: 621,
  },
  {
    id: 3,
    platform: 'Article',
    platformIcon: <FileText size={11} />,
    platformCls: 'bg-amber-500/15 text-amber-400',
    relevance: 'Related',
    relevanceCls: 'bg-amber-500/10 text-amber-400 border border-amber-500/25',
    title: 'Build Your First Web App with Flask (Beginner Friendly)',
    desc: 'A complete, beginner-friendly tutorial to build a simple web application using Flask, Python and HTML/CSS.',
    tags: ['Web Development', 'Beginner', 'Python', 'Flask'],
    domain: 'dev.to',
    age: '3 days ago',
    likes: 412,
  },
];

// ─── Demo content card ─────────────────────────────────────────────────────
const DemoCard: React.FC<typeof DEMO_CARDS[0]> = ({
  platform, platformIcon, platformCls,
  relevance, relevanceCls,
  title, desc, tags, domain, age, likes,
}) => (
  <div className="bg-[#131927] border border-[#1e293b] rounded-xl p-4 hover:border-[#2d3a58] hover:shadow-[0_4px_28px_rgba(0,0,0,0.5)] transition-all duration-200 cursor-pointer">
    <div className="flex gap-3">
      {/* Thumbnail */}
      <div className="w-[80px] h-[80px] rounded-xl flex-shrink-0 bg-gradient-to-br from-[#0f1523] via-[#161f33] to-[#1a1040]
                      flex items-center justify-center border border-[#1e293b]">
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${platformCls}`}>
          {platformIcon}
        </span>
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        {/* Badges row */}
        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
          <Pill className={platformCls}>
            {platformIcon}
            {platform}
          </Pill>
          <Pill className={relevanceCls}>
            <Sparkles size={8} />
            {relevance}
          </Pill>
        </div>

        {/* Title */}
        <h3 className="text-sm font-bold text-white leading-snug line-clamp-2 mb-1">{title}</h3>

        {/* Description */}
        <p className="text-[11px] text-[#94a3b8] leading-relaxed line-clamp-2 mb-2">{desc}</p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mb-2">
          {tags.map(t => <Tag key={t} label={t} />)}
        </div>

        {/* Meta bar */}
        <div className="flex items-center justify-between pt-1.5 border-t border-[#1e293b]/60">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-[#4b5a70]">{domain}</span>
            <span className="text-[10px] text-[#4b5a70]">• {age}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button className="p-1 rounded text-[#4b5a70] hover:text-[#94a3b8] transition-colors">
              <Bookmark size={13} />
            </button>
            <button className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold text-[#94a3b8] hover:text-white transition-colors">
              <Heart size={12} />
              {likes}
            </button>
            <button className="p-1 rounded text-[#4b5a70] hover:text-[#94a3b8] transition-colors">
              <MoreHorizontal size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
);

// ─── Main component ────────────────────────────────────────────────────────
export const LandingPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const ctaDest = isAuthenticated ? '/dashboard' : '/register';

  // Scroll-reveal
  const revealRef = useRef<HTMLElement[]>([]);
  useEffect(() => {
    const io = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('active'); }),
      { threshold: 0.1 },
    );
    document.querySelectorAll('.reveal').forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white font-sans">

      {/* ══════════════════════════════════════════════════════════════════
          TOP NAV
         ══════════════════════════════════════════════════════════════════ */}
      <nav className="sticky top-0 z-50 border-b border-[#1e293b] bg-[#0b0f19]/90 backdrop-blur-md">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-7 h-7 rounded-lg bg-[#6366f1] flex items-center justify-center shadow-[0_0_12px_rgba(99,102,241,0.4)]">
              <Layers size={15} className="text-white" />
            </div>
            <span className="font-bold text-sm text-white tracking-tight">BuildFeed</span>
          </Link>

          <span className="text-[#1e293b] select-none hidden md:block">|</span>
          <span className="text-[10px] text-[#4b5a70] font-medium hidden md:block whitespace-nowrap">
            From Scrolling to Building
          </span>

          {/* Search */}
          <div className="flex-1 max-w-[480px] hidden sm:flex items-center relative mx-2">
            <Search size={14} className="absolute left-3 text-[#4b5a70] pointer-events-none" />
            <input
              type="text"
              placeholder="Search for articles, repos, videos, or topics..."
              readOnly
              onClick={() => { if (!isAuthenticated) window.location.href = '/login'; else window.location.href = '/search'; }}
              className="w-full bg-[#131927] border border-[#1e293b] rounded-lg pl-9 pr-14 py-1.5 text-xs
                         text-[#4b5a70] placeholder:text-[#4b5a70] cursor-pointer
                         focus:outline-none focus:border-[#6366f1] transition-colors"
            />
            <div className="absolute right-2.5 flex items-center gap-0.5 text-[9px] font-mono text-[#4b5a70]
                            bg-[#1e293b] px-1.5 py-0.5 rounded border border-[#2d3a58] pointer-events-none">
              ⌘ K
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            {/* Login */}
            <Link
              to="/login"
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-[#94a3b8]
                         border border-[#1e293b] hover:border-[#6366f1]/50 hover:text-white
                         transition-all duration-150"
            >
              Login
            </Link>
            {/* Get Started / Dashboard */}
            <Link
              to={ctaDest}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white
                         bg-[#6366f1] hover:bg-[#4f46e5]
                         shadow-[0_0_16px_rgba(99,102,241,0.35)]
                         hover:shadow-[0_0_20px_rgba(99,102,241,0.5)]
                         transition-all duration-150"
            >
              {isAuthenticated ? 'Dashboard' : 'Get Started'}
            </Link>
          </div>
        </div>
      </nav>

      {/* ══════════════════════════════════════════════════════════════════
          HERO — mountain banner
         ══════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden">
        {/* Dark gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0f1523] via-[#111827] to-[#0d0f1a]" />
        {/* Violet/indigo glow */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: `
            radial-gradient(ellipse 75% 65% at 50% 115%, rgba(99,102,241,0.32) 0%, transparent 70%),
            radial-gradient(ellipse 35% 35% at 82% 18%,  rgba(139,92,246,0.18) 0%, transparent 55%)
          `
        }} />
        {/* Mountain SVG silhouette */}
        <div className="absolute bottom-0 inset-x-0 pointer-events-none" aria-hidden>
          <svg viewBox="0 0 1200 220" preserveAspectRatio="none" className="w-full h-[120px] sm:h-[160px]">
            <polygon points="0,220 0,150 120,90 240,120 390,45 540,105 630,30 750,90 870,60 990,105 1110,75 1200,120 1200,220"
              fill="rgba(30,41,59,0.45)" />
            <polygon points="0,220 0,175 150,135 270,155 390,105 510,145 630,82 780,130 900,112 1050,145 1140,128 1200,145 1200,220"
              fill="rgba(15,23,42,0.65)" />
            <polygon points="0,220 0,195 90,180 200,192 320,168 450,185 570,162 720,180 840,168 990,182 1110,172 1200,180 1200,220"
              fill="rgba(11,15,26,0.92)" />
          </svg>
          {/* Flag on peak */}
          <div className="absolute" style={{ left: '52.5%', bottom: '90px' }}>
            <div className="w-0.5 h-8 bg-red-500/80" />
            <div className="w-4 h-2.5 bg-red-500/90 -mt-0.5 ml-0.5" style={{ clipPath: 'polygon(0 0,100% 50%,0 100%)' }} />
          </div>
        </div>

        {/* Content */}
        <div className="relative max-w-[1280px] mx-auto px-4 sm:px-6 pt-10 pb-24 sm:pb-32">
          {/* Top pill */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-5
                          bg-white/6 border border-white/10 text-[10px] font-bold
                          text-white/60 uppercase tracking-widest">
            Build &gt; Learn &gt; Grow
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div className="max-w-xl">
              <h1 className="font-bold text-3xl sm:text-4xl md:text-5xl text-white leading-tight mb-3">
                Curated for your goals,
                <br />
                <span className="text-[#818cf8]">not just your interests.</span>
              </h1>
              <p className="text-sm text-white/50 leading-relaxed mb-6">
                Discover the right content, build real projects,
                and turn your curiosity into skills.
              </p>
              <Link
                to={ctaDest}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
                           bg-[#6366f1] text-white text-sm font-bold
                           hover:bg-[#4f46e5] shadow-[0_0_20px_rgba(99,102,241,0.4)]
                           hover:shadow-[0_0_28px_rgba(99,102,241,0.55)]
                           transition-all duration-150"
              >
                Continue Your Project →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          FEED SECTION (filter tabs + demo cards)
         ══════════════════════════════════════════════════════════════════ */}
      <section className="max-w-[1280px] mx-auto px-4 sm:px-6 py-10">
        <div className="flex flex-col lg:flex-row gap-6">

          {/* ── Left sidebar preview ── */}
          <div className="hidden lg:flex flex-col gap-1 w-[200px] flex-shrink-0 pt-0.5">
            <p className="text-[9px] font-bold uppercase tracking-widest text-[#4b5a70] px-2 mb-1">Discover</p>
            {[
              { icon: <Sparkles size={15} />, label: 'For You',  active: true  },
              { icon: <TrendingUp size={15} />, label: 'Trending', active: false },
              { icon: <Search size={15} />,    label: 'Explore',  active: false },
              { icon: <Bookmark size={15} />,  label: 'Saved',    active: false },
              { icon: <Hammer size={15} />,    label: 'Projects', active: false },
              { icon: <TrendingUp size={15} />,label: 'Progress', active: false },
              { icon: <LayoutTemplate size={15} />, label: 'Portfolio', active: false },
            ].map(item => (
              <Link
                key={item.label}
                to={ctaDest}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                  item.active
                    ? 'bg-[#6366f1]/15 text-[#818cf8]'
                    : 'text-[#94a3b8] hover:bg-[#131927] hover:text-white'
                }`}
              >
                <span className="opacity-80">{item.icon}</span>
                {item.label}
              </Link>
            ))}

            <div className="mt-4">
              <p className="text-[9px] font-bold uppercase tracking-widest text-[#4b5a70] px-2 mb-2">Your Interests</p>
              {[
                { icon: <Shield size={10} />,  label: 'Cybersecurity',     color: 'text-blue-400'   },
                { icon: <Code   size={10} />,  label: 'Web Development',    color: 'text-green-400'  },
                { icon: <Brain  size={10} />,  label: 'AI & Machine Learning', color: 'text-purple-400' },
              ].map(i => (
                <div key={i.label}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#131927] border border-[#1e293b] mb-1.5 text-[11px] font-semibold text-[#94a3b8]">
                  <span className={i.color}>{i.icon}</span>
                  {i.label}
                  <span className="ml-auto text-[#4b5a70] cursor-pointer hover:text-white text-xs">×</span>
                </div>
              ))}
            </div>

            <div className="mt-4">
              <p className="text-[9px] font-bold uppercase tracking-widest text-[#4b5a70] px-2 mb-2">Your Level</p>
              {['Beginner', 'Intermediate', 'Advanced'].map((lvl, idx) => (
                <div key={lvl}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg mb-1 text-[11px] font-semibold transition-all ${
                    idx === 0
                      ? 'bg-[#6366f1]/12 border border-[#6366f1]/25 text-[#818cf8]'
                      : 'text-[#4b5a70] hover:text-[#94a3b8] cursor-pointer'
                  }`}
                >
                  {idx === 0 && <span className="w-1.5 h-1.5 rounded-full bg-[#818cf8] flex-shrink-0" />}
                  {lvl}
                </div>
              ))}
            </div>

            {/* Progress card */}
            <div className="mt-4 rounded-xl bg-gradient-to-br from-[#6366f1]/18 via-[#6366f1]/8 to-transparent border border-[#6366f1]/20 p-3">
              <div className="w-8 h-8 rounded-lg bg-[#6366f1]/25 border border-[#6366f1]/30 flex items-center justify-center mb-2">
                <Rocket size={16} className="text-[#818cf8]" />
              </div>
              <p className="text-[11px] font-bold text-white mb-0.5">Small steps.</p>
              <p className="text-[11px] font-bold text-white mb-1.5">Big progress.</p>
              <p className="text-[9px] text-[#94a3b8] mb-2">Keep exploring, keep building!</p>
              <div className="flex items-center justify-between text-[9px] mb-1 text-[#4b5a70]">
                <span>3/10 content viewed today</span>
              </div>
              <div className="w-full h-1 bg-[#1e293b] rounded-full overflow-hidden">
                <div className="h-full bg-[#6366f1] rounded-full" style={{ width: '30%' }} />
              </div>
            </div>
          </div>

          {/* ── Center: filter bar + cards ── */}
          <div className="flex-1 min-w-0">
            {/* Filter tabs */}
            <div className="flex items-center gap-1.5 mb-4 flex-wrap">
              {['For You', 'Articles', 'GitHub', 'YouTube'].map((tab, i) => (
                <Link
                  key={tab}
                  to={ctaDest}
                  className={`flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    i === 0
                      ? 'bg-[#6366f1] border-[#6366f1] text-white shadow-[0_2px_12px_rgba(99,102,241,0.3)]'
                      : 'bg-transparent border-[#1e293b] text-[#94a3b8] hover:border-[#6366f1]/50 hover:text-white'
                  }`}
                >
                  {i === 0 && <Sparkles size={11} />}
                  {tab}
                </Link>
              ))}
              <Link
                to={ctaDest}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold
                           border border-[#1e293b] text-[#94a3b8] hover:border-[#6366f1]/50 hover:text-white transition-all"
              >
                Most Relevant ▾
              </Link>
            </div>

            {/* Cards */}
            <div className="space-y-3">
              {DEMO_CARDS.map(card => (
                <Link key={card.id} to={ctaDest} className="block">
                  <DemoCard {...card} />
                </Link>
              ))}
              {/* CTA nudge */}
              <div className="py-8 text-center">
                <p className="text-sm text-[#4b5a70] mb-3">Sign in to see your personalised feed →</p>
                <Link
                  to={ctaDest}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
                             bg-[#6366f1] text-white text-sm font-bold
                             hover:bg-[#4f46e5] shadow-[0_0_16px_rgba(99,102,241,0.35)]
                             transition-all duration-150"
                >
                  Get Your Feed <ArrowRight size={15} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          HOW IT WORKS
         ══════════════════════════════════════════════════════════════════ */}
      <section className="py-20 border-t border-[#1e293b]">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6">
          <div className="text-center mb-14 reveal">
            <p className="text-[10px] font-bold text-[#6366f1] uppercase tracking-widest mb-2">The Core Loop</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">How curiosity becomes reality</h2>
            <p className="text-sm text-[#94a3b8] max-w-lg mx-auto">
              A seamless pipeline from the moment of inspiration to a published portfolio piece.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { icon: <Search     size={20} />, step: '01', label: 'Discover'   },
              { icon: <Bookmark   size={20} />, step: '02', label: 'Save'       },
              { icon: <BrainCircuit size={20}/>,step: '03', label: 'Understand' },
              { icon: <Hammer     size={20} />, step: '04', label: 'Build'      },
              { icon: <CheckCircle2 size={20}/>,step: '05', label: 'Complete'   },
              { icon: <LayoutTemplate size={20}/>,step:'06',label: 'Showcase'  },
            ].map((s, i) => (
              <div
                key={s.step}
                className="flex flex-col items-center text-center p-4 rounded-xl bg-[#131927] border border-[#1e293b]
                           hover:border-[#6366f1]/40 transition-all reveal"
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <div className="w-11 h-11 rounded-xl bg-[#6366f1]/15 border border-[#6366f1]/25 text-[#818cf8]
                                flex items-center justify-center mb-3">
                  {s.icon}
                </div>
                <p className="text-[9px] font-bold text-[#6366f1] mb-1">{s.step}</p>
                <p className="text-xs font-semibold text-white">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          FEATURES
         ══════════════════════════════════════════════════════════════════ */}
      <section className="py-20 border-t border-[#1e293b]">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6">
          <div className="text-center mb-14 reveal">
            <p className="text-[10px] font-bold text-[#6366f1] uppercase tracking-widest mb-2">The Toolkit</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Everything you need to grow</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: <Sparkles   size={20} />, title: 'AI-Powered Discovery',   desc: 'Never browse aimlessly. Our engine surfaces the perfect next challenge from millions of repos and papers.' },
              { icon: <Target     size={20} />, title: 'Skill-Based Matching',   desc: 'Projects categorised by difficulty and stack. Always work on things that push your limits without being overwhelming.' },
              { icon: <Map        size={20} />, title: 'Interactive Roadmaps',   desc: 'Turn any idea into a structured plan. Complex repos broken into digestible, buildable milestones.' },
              { icon: <TrendingUp size={20} />, title: 'Progress Tracking',      desc: 'Visualise growth with XP, levels, and skill streaks. Stay motivated with a game-like building experience.' },
              { icon: <Presentation size={20}/>,title: 'Portfolio Showcase',     desc: 'Every finished project is polished and added to your public profile automatically.' },
              { icon: <Users      size={20} />, title: 'Builder Network',        desc: 'Connect with others building similar projects. Share insights and learn from the community.' },
            ].map((f, i) => (
              <div
                key={f.title}
                className="p-5 rounded-xl bg-[#131927] border border-[#1e293b]
                           hover:border-[#6366f1]/40 transition-all reveal"
                style={{ transitionDelay: `${i * 60}ms` }}
              >
                <div className="w-10 h-10 rounded-lg bg-[#6366f1]/15 border border-[#6366f1]/25 text-[#818cf8]
                                flex items-center justify-center mb-3">
                  {f.icon}
                </div>
                <h3 className="text-sm font-bold text-white mb-1.5">{f.title}</h3>
                <p className="text-xs text-[#94a3b8] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          FINAL CTA
         ══════════════════════════════════════════════════════════════════ */}
      <section className="py-20 border-t border-[#1e293b]">
        <div className="max-w-[600px] mx-auto px-4 text-center reveal">
          <div className="w-12 h-12 rounded-2xl bg-[#6366f1] flex items-center justify-center mx-auto mb-5
                          shadow-[0_0_24px_rgba(99,102,241,0.45)]">
            <Zap size={22} className="text-white" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
            Start turning inspiration into projects.
          </h2>
          <p className="text-sm text-[#94a3b8] mb-7">
            Join thousands of developers who use BuildFeed to stop bookmarking and start building.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to={ctaDest}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl
                         bg-[#6366f1] text-white text-sm font-bold
                         hover:bg-[#4f46e5] shadow-[0_0_20px_rgba(99,102,241,0.4)]
                         transition-all duration-150"
            >
              {isAuthenticated ? 'Go to Dashboard' : 'Start Building Free'}
              <ArrowRight size={16} />
            </Link>
            <Link
              to="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl
                         border border-[#1e293b] text-[#94a3b8] text-sm font-semibold
                         hover:border-[#6366f1]/50 hover:text-white transition-all duration-150"
            >
              Login
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1e293b] py-6 text-center">
        <p className="text-[11px] text-[#4b5a70]">
          © 2026 BuildFeed · From Scrolling to Building
        </p>
      </footer>
    </div>
  );
};

// tiny helper used inside sidebar preview
const Rocket: React.FC<{ size: number; className?: string }> = ({ size, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
    <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
  </svg>
);
