'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target, Award, BookOpen, Briefcase, Search } from 'lucide-react';
import { useEffect, useState, useCallback } from "react";
import { motion } from "motion/react";
import { useIsNative } from '@/components/native/native-provider';

interface SkillProfile {
  trainee_id: string;
  skills: { skill_id: string; name: string; category: string; proficiency: number; verified: boolean; source: string }[];
  certificates: number;
  coursesCompleted: number;
  employmentReadiness: number;
}

export default function SkillPassportPage() {
  // The native app bar already names this screen, so the page's own <h1> is
  // a duplicate: two h1s on one screen, the second repeating what the sticky
  // bar above it already says. Dropping it in the app reclaims 40px (measured
  // on a Pixel 7) and leaves exactly one h1 on the page.
  const isNative = useIsNative();
  const [traineeId, setTraineeId] = useState('');
  const [profile, setProfile] = useState<SkillProfile | null>(null);
  const [allSkills, setAllSkills] = useState<{ id: string; name: string; category: string }[]>([]);

  const loadSkills = useCallback(() => {
    fetch('/api/v1/skills').then(r => r.json()).then(j => {
      if (j?.data?.skills) setAllSkills(j.data.skills);
    });
  }, []);

  useEffect(() => { loadSkills(); }, [loadSkills]);

  const loadProfile = async () => {
    if (!traineeId) return;
    const res = await fetch(`/api/v1/skills?trainee_id=${traineeId}`);
    const j = await res.json();
    if (j?.data?.profile) setProfile(j.data.profile);
  };

  const categoryColor = (cat: string) => {
    const colors: Record<string, string> = {
      TECHNOLOGY: 'bg-blue-500', FINANCE: 'bg-green-500', COOPERATIVE: 'bg-purple-500',
      DEVELOPMENT: 'bg-orange-500', BUSINESS: 'bg-pink-500', SOFT_SKILLS: 'bg-yellow-500',
      DOMAIN: 'bg-cyan-500', MANAGEMENT: 'bg-indigo-500',
    };
    return colors[cat] || 'bg-muted-foreground';
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-24">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="border-b border-border pb-6">
        <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono uppercase tracking-widest mb-3">
          <div className="w-2 h-2 bg-foreground animate-pulse rounded" />
          Learning_LMS // Digital Skill Passport
        </div>
        {!isNative && (
            <h1 className="text-4xl md:text-5xl font-bold tracking-tighter uppercase text-foreground">Skill Passport</h1>
          )}
        <p className="text-sm text-muted-foreground mt-2 font-mono">Centralized verified skill profile for every trainee</p>
      </motion.div>

      {/* Trainee Lookup */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input className="w-full pl-10 pr-4 py-2 border border-border rounded bg-background text-sm font-mono uppercase tracking-widest" placeholder="Enter Trainee ID to view skill passport..." value={traineeId} onChange={e => setTraineeId(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadProfile()} />
        </div>
        <Button onClick={loadProfile} className="rounded font-mono text-xs uppercase">Load Profile</Button>
      </div>

      {/* Skill Passport Card */}
      {profile && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Overview Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <Card className="shadow-none border-border rounded bg-background hover:border-foreground transition-colors group">
              <CardContent className="p-6">
                <div className="flex items-center justify-between text-muted-foreground mb-4">
                  <span className="font-mono text-[10px] uppercase tracking-widest">Courses Completed</span>
                  <div className="p-2 border border-border rounded group-hover:bg-foreground group-hover:text-background transition-colors"><BookOpen className="w-5 h-5" /></div>
                </div>
                <div className="text-4xl font-bold text-foreground tracking-tighter">{profile.coursesCompleted}</div>
              </CardContent>
            </Card>
            <Card className="shadow-none border-border rounded bg-background hover:border-foreground transition-colors group">
              <CardContent className="p-6">
                <div className="flex items-center justify-between text-muted-foreground mb-4">
                  <span className="font-mono text-[10px] uppercase tracking-widest">Certifications</span>
                  <div className="p-2 border border-border rounded group-hover:bg-foreground group-hover:text-background transition-colors"><Award className="w-5 h-5" /></div>
                </div>
                <div className="text-4xl font-bold text-foreground tracking-tighter">{profile.certificates}</div>
              </CardContent>
            </Card>
            <Card className="shadow-none border-2 border-accent/30 rounded bg-background group">
              <CardContent className="p-6">
                <div className="flex items-center justify-between text-muted-foreground mb-4">
                  <span className="font-mono text-[10px] uppercase tracking-widest">Employment Readiness</span>
                  <div className="p-2 border border-accent/30 rounded"><Briefcase className="w-5 h-5" /></div>
                </div>
                <div className="text-4xl font-bold text-foreground tracking-tighter">{profile.employmentReadiness}%</div>
                <div className="mt-3 w-full bg-border rounded-full h-2">
                  <div className="bg-accent h-2 rounded-full transition-all duration-700" style={{ width: `${profile.employmentReadiness}%` }} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Skills */}
          <Card className="shadow-none border-border rounded bg-background">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-xs font-mono uppercase tracking-widest flex items-center gap-2">
                <Target className="w-4 h-4" /> Skill Profile ({profile.skills.length} skills)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {profile.skills.length === 0 ? (
                <div className="text-center py-8 font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  No skills recorded yet. Skills are added through course completions, assessments, and trainer evaluations.
                </div>
              ) : (
                <div className="space-y-4">
                  {profile.skills.map((skill, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <div className="w-40 shrink-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm text-foreground">{skill.name}</span>
                          {skill.verified && <span className="text-[8px] font-mono uppercase text-green-500 border border-green-500/30 px-1 rounded">✓</span>}
                        </div>
                        <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded text-white ${categoryColor(skill.category)}`}>{skill.category}</span>
                      </div>
                      <div className="flex-1">
                        <div className="w-full bg-border rounded-full h-3 relative">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${skill.proficiency}%` }}
                            transition={{ duration: 0.8, delay: i * 0.1 }}
                            className={`h-3 rounded-full ${categoryColor(skill.category)}`}
                          />
                        </div>
                      </div>
                      <div className="w-12 text-right font-mono text-sm font-bold text-foreground">{skill.proficiency}%</div>
                      <span className="text-[9px] font-mono uppercase text-muted-foreground w-20">{skill.source.replace('_', ' ')}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* All Skills Catalog */}
      {!profile && allSkills.length > 0 && (
        <Card className="shadow-none border-border rounded bg-background">
          <CardHeader className="border-b border-border pb-4"><CardTitle className="text-xs font-mono uppercase tracking-widest">Skills Catalog ({allSkills.length} skills)</CardTitle></CardHeader>
          <CardContent className="p-6">
            <div className="flex flex-wrap gap-2">
              {allSkills.map(skill => (
                <span key={skill.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded text-xs font-mono uppercase tracking-widest text-muted-foreground hover:border-foreground hover:text-foreground transition-colors">
                  <span className={`w-2 h-2 rounded-full ${categoryColor(skill.category)}`} />
                  {skill.name}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
