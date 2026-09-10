import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Gift,
  Trophy,
  Zap,
  Rocket,
  Hammer,
  Star,
  Award,
  Crown,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  Lock,
  ArrowRight,
  TrendingUp,
  Flame,
  Layers,
  ChevronRight,
  Loader2,
  Sliders,
  Check,
  FolderGit2,
  Share2,
} from 'lucide-react';
import { Navbar } from '../components/layout/Navbar';
import { Sidebar } from '../components/layout/Sidebar';
import { Footer } from '../components/layout/Footer';
import { Button } from '../components/ui/Button';
import { useAuth } from '../features/auth/AuthContext';
import { progressionApi } from '../services/api/progressionApi';
import { achievementApi } from '../services/api/achievementApi';
import { ProgressionData, Achievement, AchievementCategory } from '../types/progression';

// Level Roadmap Definition with Perks
const LEVEL_ROADMAP = [
  {
    level: 1,
    title: 'Apprentice',
    xp: 0,
    icon: Sparkles,
    badgeColor: 'from-blue-500 to-indigo-600',
    perk: 'Standard BuildFeed Access & AI Discovery Feed',
    description: 'Begin your journey by exploring ideas and saving repositories.',
  },
  {
    level: 2,
    title: 'Junior Builder',
    xp: 100,
    icon: Hammer,
    badgeColor: 'from-indigo-500 to-cyan-600',
    perk: '+5 Daily Feed Limit & Step Checklist Tracker',
    description: 'Start tracking step-by-step implementation milestones.',
  },
  {
    level: 3,
    title: 'Practitioner',
    xp: 250,
    icon: Zap,
    badgeColor: 'from-emerald-500 to-teal-600',
    perk: 'Focus Gate Smart Unlocks & GitHub Workspace Sync',
    description: 'Automate GitHub repo creation directly from saved ideas.',
  },
  {
    level: 4,
    title: 'Engineer',
    xp: 500,
    icon: Layers,
    badgeColor: 'from-amber-500 to-orange-600',
    perk: 'Public Portfolio Showcases & Custom Share Slugs',
    description: 'Publish completed builds to the world with shareable links.',
  },
  {
    level: 5,
    title: 'Architect',
    xp: 1000,
    icon: Star,
    badgeColor: 'from-purple-500 to-pink-600',
    perk: 'AI Architecture Mentor & Custom Workspace Themes',
    description: 'Deep AI step breakdowns and milestone planning assistance.',
  },
  {
    level: 6,
    title: 'Lead Engineer',
    xp: 1750,
    icon: Flame,
    badgeColor: 'from-rose-500 to-red-600',
    perk: 'Priority Feed Ranking & Verified Builder Badge',
    description: 'Display official verified builder badge across showcases.',
  },
  {
    level: 7,
    title: 'Principal Builder',
    xp: 2750,
    icon: Award,
    badgeColor: 'from-fuchsia-500 to-purple-700',
    perk: 'Unlimited Daily Feed Consumption & AI Export Tools',
    description: 'Zero daily feed limits and instant project export.',
  },
  {
    level: 8,
    title: 'Staff Architect',
    xp: 4000,
    icon: ShieldCheck,
    badgeColor: 'from-violet-600 to-indigo-800',
    perk: 'Top Builder Leaderboard Spotlight & Global Feature',
    description: 'Showcase pinned to the top of community leaderboards.',
  },
  {
    level: 9,
    title: 'Distinguished Fellow',
    xp: 5500,
    icon: Rocket,
    badgeColor: 'from-amber-400 to-amber-600',
    perk: 'Grandmaster Architect Crown & Special Profile Aura',
    description: 'Golden profile aura and lifetime builder distinction.',
  },
  {
    level: 10,
    title: 'Grandmaster Fellow',
    xp: 7500,
    icon: Crown,
    badgeColor: 'from-yellow-400 via-amber-500 to-yellow-600',
    perk: 'Max Level Master Tier & All Platform Perks Unlocked',
    description: 'The pinnacle of the BuildFeed engineering hierarchy.',
  },
];

export const RewardsPage: React.FC = () => {
  const { user } = useAuth();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [progression, setProgression] = useState<ProgressionData | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [activeCategory, setActiveCategory] = useState<AchievementCategory | 'all'>('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [progData, achData] = await Promise.allSettled([
          progressionApi.getProgression(),
          achievementApi.getAchievements(),
        ]);

        if (progData.status === 'fulfilled') {
          setProgression(progData.value);
        }
        if (achData.status === 'fulfilled') {
          setAchievements(achData.value.achievements || []);
        }
      } catch (err) {
        console.error('Failed to load rewards data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const currentLevel = progression?.level || 1;
  const currentTitle = progression?.level_title || 'Apprentice';
  const totalXp = progression?.total_xp || 0;
  const progressPercent = progression?.level_progress_percent || 0;
  const xpToNext = progression?.xp_to_next_level || 0;
  const unlockedAchievementsCount = achievements.filter((a) => a.is_unlocked).length;

  const filteredAchievements =
    activeCategory === 'all'
      ? achievements
      : achievements.filter((a) => a.category === activeCategory);

  return (
    <div className="min-h-screen flex bg-paper text-primary">
      {/* Sidebar */}
      <Sidebar isOpen={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <Navbar onOpenMobileSidebar={() => setMobileSidebarOpen(true)} />

        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8">
          {/* Header Title Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-accentLight text-accent mb-2">
                <Gift size={14} />
                <span>Rewards &amp; Level Progression</span>
              </div>
              <h1 className="font-heading text-3xl sm:text-4xl font-bold text-primary tracking-tight">
                Builder Rewards Vault
              </h1>
              <p className="text-secondary text-sm mt-1">
                Level up by shipping projects and completing build milestones to unlock exclusive perks.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link to="/projects">
                <Button variant="accent" size="sm" className="shadow-purple">
                  <Hammer size={14} className="mr-1.5" />
                  <span>Build to Earn XP</span>
                </Button>
              </Link>
            </div>
          </div>

          {isLoading ? (
            <div className="editorial-card p-16 text-center">
              <Loader2 size={32} className="animate-spin text-accent mx-auto mb-3" />
              <p className="text-sm font-semibold text-primary">Loading your rewards vault...</p>
            </div>
          ) : (
            <>
              {/* 1. Hero: Level Status & XP Progress Card */}
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-surface via-surface to-accentLight/30 border border-accent/20 p-6 sm:p-8 shadow-elevated">
                {/* Background Decorative Circles */}
                <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-accent/5 blur-3xl pointer-events-none" />
                <div className="absolute right-1/3 -bottom-20 w-80 h-80 rounded-full bg-purple-500/5 blur-3xl pointer-events-none" />

                <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8">
                  {/* Left: Level Emblem & Details */}
                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
                    {/* Glowing Emblem */}
                    <div className="relative flex-shrink-0">
                      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-tr from-accent to-purple-500 text-white flex flex-col items-center justify-center shadow-purple transform hover:scale-105 transition-transform">
                        <Crown size={36} className="text-yellow-300 drop-shadow mb-0.5" />
                        <span className="font-heading font-extrabold text-xl tracking-tight leading-none">
                          LVL {currentLevel}
                        </span>
                      </div>
                      <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center justify-center border-2 border-surface shadow-sm">
                        <Check size={14} strokeWidth={3} />
                      </div>
                    </div>

                    <div>
                      <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-accent mb-1">
                        <Star size={13} className="fill-accent" />
                        <span>Current Rank</span>
                      </div>
                      <h2 className="font-heading text-2xl sm:text-3xl font-extrabold text-primary">
                        {currentTitle}
                      </h2>
                      <p className="text-secondary text-xs sm:text-sm mt-1 max-w-md">
                        You have earned <strong className="text-primary font-bold">{totalXp.toLocaleString()} XP</strong> across all projects and build milestones.
                      </p>

                      {/* Micro Stats Row */}
                      <div className="flex flex-wrap items-center gap-4 sm:gap-6 mt-4 pt-4 border-t border-borderPaper/70 text-xs">
                        <div className="flex items-center gap-1.5 text-secondary">
                          <Rocket size={15} className="text-accent" />
                          <span>
                            <strong className="text-primary font-semibold">
                              {progression?.completed_projects_count || 0}
                            </strong>{' '}
                            Projects Shipped
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-secondary">
                          <Hammer size={15} className="text-amber-500" />
                          <span>
                            <strong className="text-primary font-semibold">
                              {progression?.completed_steps_count || 0}
                            </strong>{' '}
                            Milestone Steps
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-secondary">
                          <Trophy size={15} className="text-purple-600" />
                          <span>
                            <strong className="text-primary font-semibold">
                              {unlockedAchievementsCount}
                            </strong>{' '}
                            Badges Earned
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right: XP Gauge Box */}
                  <div className="w-full lg:w-80 bg-paper/80 backdrop-blur-md rounded-2xl p-5 border border-borderPaper shadow-subtle flex flex-col justify-between">
                    <div className="flex items-center justify-between text-xs font-semibold text-primary mb-2">
                      <span className="flex items-center gap-1 text-accent">
                        <Zap size={14} className="fill-accent" /> Progress to Level {currentLevel + 1}
                      </span>
                      <span>{progressPercent}%</span>
                    </div>

                    {/* Progress Track */}
                    <div className="w-full h-3 bg-borderPaper/70 rounded-full overflow-hidden mb-3 p-0.5">
                      <div
                        className="h-full bg-gradient-to-r from-accent to-purple-500 rounded-full transition-all duration-700 shadow-sm"
                        style={{ width: `${Math.max(5, progressPercent)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-secondary">
                      <span>{progression?.xp_in_current_level || 0} XP in tier</span>
                      {progression?.is_max_level ? (
                        <span className="text-accent font-bold">Max Level Reached!</span>
                      ) : (
                        <span className="font-semibold text-primary">
                          {xpToNext} XP to Level {currentLevel + 1}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Unlocked Perks & Active Rewards */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-heading text-xl font-bold text-primary flex items-center gap-2">
                      <ShieldCheck size={20} className="text-emerald-500" />
                      Your Active Level Perks
                    </h2>
                    <p className="text-xs text-secondary mt-0.5">
                      Privileges automatically unlocked at your current level ({currentTitle}).
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {LEVEL_ROADMAP.filter((tier) => tier.level <= currentLevel).map((tier) => {
                    const IconComponent = tier.icon;
                    return (
                      <div
                        key={tier.level}
                        className="bg-surface rounded-2xl p-5 border border-emerald-500/30 bg-emerald-500/[0.02] shadow-subtle flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                              <IconComponent size={20} />
                            </div>
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                              <CheckCircle2 size={12} /> Level {tier.level}
                            </span>
                          </div>

                          <h3 className="font-heading text-sm font-bold text-primary mb-1">
                            {tier.perk}
                          </h3>
                          <p className="text-xs text-secondary leading-relaxed">
                            {tier.description}
                          </p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-borderPaper/50 flex items-center justify-between text-[11px] text-emerald-600 font-semibold">
                          <span>Status</span>
                          <span>Active &amp; Unlocked</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 3. 10-Tier Builder Roadmap Timeline */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-heading text-xl font-bold text-primary flex items-center gap-2">
                      <TrendingUp size={20} className="text-accent" />
                      Engineering Level Roadmap
                    </h2>
                    <p className="text-xs text-secondary mt-0.5">
                      Progress through the 10 ranks to unlock advanced engineering perks and distinction.
                    </p>
                  </div>
                </div>

                <div className="editorial-card p-6 sm:p-8 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {LEVEL_ROADMAP.map((tier) => {
                      const isReached = tier.level <= currentLevel;
                      const isCurrent = tier.level === currentLevel;
                      const isNext = tier.level === currentLevel + 1;
                      const IconComponent = tier.icon;

                      return (
                        <div
                          key={tier.level}
                          className={`p-4 rounded-2xl border transition-all duration-200 flex items-start gap-4 ${
                            isCurrent
                              ? 'border-accent bg-accentLight/40 dark:bg-accent/10 shadow-purple'
                              : isReached
                              ? 'border-emerald-500/30 bg-surface'
                              : 'border-borderPaper bg-surface/50 opacity-70'
                          }`}
                        >
                          <div
                            className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold shadow-sm ${
                              isReached
                                ? `bg-gradient-to-tr ${tier.badgeColor}`
                                : 'bg-borderPaper text-muted'
                            }`}
                          >
                            {isReached ? <IconComponent size={20} /> : <Lock size={18} />}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-heading font-bold text-sm text-primary">
                                  Level {tier.level}: {tier.title}
                                </span>
                                {isCurrent && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-accent text-white shadow-sm">
                                    Current
                                  </span>
                                )}
                                {isNext && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/10 text-amber-600 border border-amber-500/20">
                                    Next Tier
                                  </span>
                                )}
                              </div>
                              <span className="text-xs font-mono font-semibold text-secondary">
                                {tier.xp.toLocaleString()} XP
                              </span>
                            </div>

                            <p className="text-xs font-medium text-primary mt-1">
                              {tier.perk}
                            </p>
                            <p className="text-[11px] text-secondary mt-0.5 leading-relaxed">
                              {tier.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 4. Badges & Achievements Section */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="font-heading text-xl font-bold text-primary flex items-center gap-2">
                      <Trophy size={20} className="text-purple-600" />
                      Milestone Badges ({unlockedAchievementsCount}/{achievements.length})
                    </h2>
                    <p className="text-xs text-secondary mt-0.5">
                      Earn achievement badges for completing projects, streak milestones, and exploration.
                    </p>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    {(['all', 'building', 'exploration', 'progression'] as const).map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition-colors ${
                          activeCategory === cat
                            ? 'bg-accent text-white shadow-purple'
                            : 'bg-surface border border-borderPaper text-secondary hover:text-primary'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredAchievements.map((ach) => {
                    const isUnlocked = ach.is_unlocked;
                    return (
                      <div
                        key={ach.id}
                        className={`editorial-card p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
                          isUnlocked
                            ? 'border-accent/40 bg-surface shadow-subtle'
                            : 'opacity-65 bg-surface/60 border-borderPaper'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div
                              className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                                isUnlocked
                                  ? 'bg-accentLight text-accent shadow-purple/30'
                                  : 'bg-borderPaper/60 text-secondary'
                              }`}
                            >
                              {isUnlocked ? <Award size={22} /> : <Lock size={18} />}
                            </div>

                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                isUnlocked
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                  : 'bg-borderPaper text-secondary'
                              }`}
                            >
                              {isUnlocked ? 'Unlocked' : 'In Progress'}
                            </span>
                          </div>

                          <h3 className="font-heading text-sm font-bold text-primary mb-1">
                            {ach.name}
                          </h3>
                          <p className="text-xs text-secondary leading-relaxed mb-3">
                            {ach.description}
                          </p>
                        </div>

                        <div>
                          {/* Progress */}
                          {!isUnlocked ? (
                            <div className="space-y-1">
                              <div className="flex justify-between text-[10px] font-semibold text-secondary">
                                <span>Progress</span>
                                <span>
                                  {ach.current_value} / {ach.threshold} ({ach.progress_percent}%)
                                </span>
                              </div>
                              <div className="w-full h-1.5 bg-borderPaper rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-accent rounded-full transition-all duration-500"
                                  style={{ width: `${ach.progress_percent}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="pt-2 border-t border-borderPaper/60 flex items-center justify-between text-[11px] text-emerald-600 font-medium">
                              <span className="flex items-center gap-1">
                                <CheckCircle2 size={13} /> Completed
                              </span>
                              <span>+100 XP Earned</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 5. XP Earning Guide Card */}
              <div className="rounded-2xl bg-gradient-to-r from-accentLight via-purple-50 to-indigo-50 dark:from-accent/10 dark:via-purple-950/20 dark:to-indigo-950/20 p-6 sm:p-8 border border-accent/20 flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                  <h3 className="font-heading text-lg font-bold text-primary mb-1">
                    How to Earn XP and Level Up Faster
                  </h3>
                  <p className="text-xs sm:text-sm text-secondary max-w-xl leading-relaxed">
                    Every step you complete in a build workspace awards <strong className="text-primary">+10 XP</strong>. Finishing an entire project awards <strong className="text-primary">+100 XP</strong> and unlocks rare badges!
                  </p>
                </div>

                <Link to="/saved" className="flex-shrink-0">
                  <Button variant="accent" size="md" className="shadow-purple whitespace-nowrap">
                    <span>Start Building from Saved</span>
                    <ArrowRight size={16} className="ml-1.5" />
                  </Button>
                </Link>
              </div>
            </>
          )}
        </main>

        <Footer />
      </div>
    </div>
  );
};
