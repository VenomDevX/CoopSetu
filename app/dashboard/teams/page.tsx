'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronRight,
  Search,
  Filter,
  Plus,
  Bot,
  Users,
  Briefcase,
  UserCircle,
  BarChart3,
  Calendar,
  Activity,
  GitPullRequest,
  Shield,
  Clock,
  ArrowLeft,
  Mail,
  MapPin,
  Globe,
  Settings,
  MoreVertical,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// --- MOCK DATA ---


function mapTeam(r: any) {
  return {
    id: r.id, name: r.name, manager: r.team_lead_member_id ? 'Lead assigned' : '—',
    department: r.department_id ? 'Department' : '—',
    members: r.team_members?.[0]?.count ?? 0, projects: 0, sprint: '—',
    capacity: Number(r.capacity_hours_per_week) || 0, velocity: 0, openBugs: 0, health: 'Healthy',
  };
}
function mapEmployee(r: any, teamNameById: Record<string, string>) {
  const p = Array.isArray(r.profile) ? r.profile[0] : r.profile;
  const teamId = r.team_members?.[0]?.team_id;
  return {
    id: r.id, name: p?.full_name ?? p?.email ?? 'Member', role: p?.job_title ?? '—',
    department: '—', team: teamId ? (teamNameById[teamId] ?? '—') : '—', manager: '—',
    location: '—', timezone: p?.timezone ?? 'UTC', skills: [] as string[],
    activeTasks: 0, sprint: '—', capacity: 40, workload: 0, recentActivity: '—', github: '—',
  };
}


const getHealthColor = (health: string) => {
  switch (health) {
    case 'Healthy': return 'text-emerald-500 border-emerald-500 bg-emerald-500/10';
    case 'At Risk': return 'text-orange-500 border-orange-500 bg-orange-500/10';
    case 'Critical': return 'text-destructive border-destructive bg-destructive/10';
    default: return 'text-muted-foreground border-border bg-surface';
  }
};

// --- MAIN COMPONENT ---

export default function TeamsPage() {
  const [currentView, setCurrentView] = useState<'directory' | 'resource_planning' | 'team_detail' | 'employee_profile'>('directory');
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [activeTeamTab, setActiveTeamTab] = useState('Overview');
  const [mockTeams, setMockTeams] = useState<ReturnType<typeof mapTeam>[]>([]);
  const [mockEmployees, setMockEmployees] = useState<ReturnType<typeof mapEmployee>[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      const [teamsRes, empRes] = await Promise.all([
        fetch('/api/v1/teams').then((r) => r.json()).catch(() => ({})),
        fetch('/api/v1/employees').then((r) => r.json()).catch(() => ({})),
      ]);
      if (!active) return;
      const teams = Array.isArray(teamsRes?.data) ? teamsRes.data : [];
      const teamNameById: Record<string, string> = {};

      teams.forEach((t: any) => { teamNameById[t.id] = t.name; });
      setMockTeams(teams.map(mapTeam));

      setMockEmployees((Array.isArray(empRes?.data) ? empRes.data : []).map((e: any) => mapEmployee(e, teamNameById)));
    })();
    return () => { active = false; };
  }, []);

  const selectedTeam = mockTeams.find(t => t.id === selectedTeamId);
  const selectedEmployee = mockEmployees.find(e => e.id === selectedEmployeeId);

  const handleTeamClick = (id: string) => {
    setSelectedTeamId(id);
    setCurrentView('team_detail');
  };

  const handleAI = (prompt: string) => {
    alert(`Mock AI Action: ${prompt}`);
  };

  const handleEmployeeClick = (id: string) => {
    setSelectedEmployeeId(id);
    setCurrentView('employee_profile');
  };

  const handleBack = () => {
    if (currentView === 'team_detail' || currentView === 'resource_planning') {
      setCurrentView('directory');
      setSelectedTeamId(null);
    } else if (currentView === 'employee_profile') {
      // Go back to team detail if a team was selected, else directory
      if (selectedTeamId) {
        setCurrentView('team_detail');
      } else {
        setCurrentView('directory');
      }
      setSelectedEmployeeId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 min-h-[calc(100vh-80px)] flex flex-col">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 flex-shrink-0">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
            <span>Administration</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground">Teams</span>
            {currentView === 'team_detail' && selectedTeam && (
              <>
                <ChevronRight className="w-3 h-3" />
                <span className="text-foreground">{selectedTeam.name}</span>
              </>
            )}
            {currentView === 'employee_profile' && selectedEmployee && (
              <>
                <ChevronRight className="w-3 h-3" />
                <span className="text-foreground">{selectedEmployee.name}</span>
              </>
            )}
            {currentView === 'resource_planning' && (
              <>
                <ChevronRight className="w-3 h-3" />
                <span className="text-foreground">Resource Planning</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            {currentView !== 'directory' && (
              <Button variant="outline" size="sm" onClick={handleBack} className="h-8 w-8 p-0 rounded-none border-border">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            <h1 className="text-3xl font-bold tracking-tight uppercase flex items-center gap-3">
              <Users className="w-8 h-8" />
              {currentView === 'directory' && 'Teams Directory'}
              {currentView === 'team_detail' && selectedTeam && selectedTeam.name}
              {currentView === 'employee_profile' && selectedEmployee && selectedEmployee.name}
              {currentView === 'resource_planning' && 'Resource Planning'}
            </h1>
          </div>

          <p className="text-sm text-muted-foreground mt-1 font-mono uppercase tracking-widest">
            {currentView === 'directory' && 'Manage delivery teams, skills, capacity, staffing, and workload allocation.'}
            {currentView === 'team_detail' && 'Team performance, workload, and capacity oversight.'}
            {currentView === 'employee_profile' && 'Employee allocation, skills, and activity profile.'}
            {currentView === 'resource_planning' && 'Cross-team capacity forecasting and skill allocation.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {currentView === 'directory' && (
            <>
              <Button onClick={() => setCurrentView('resource_planning')} variant="outline" className="h-9 px-4 rounded-none text-xs font-mono uppercase tracking-widest border-border text-foreground hover:bg-surface-hover gap-2">
                <BarChart3 className="w-4 h-4" />
                Resource Planning
              </Button>
              <Button variant="outline" className="h-9 px-4 rounded-none text-xs font-mono uppercase tracking-widest border-border text-foreground hover:bg-surface-hover gap-2">
                <UserCircle className="w-4 h-4" />
                Invite Employee
              </Button>
              <Button className="h-9 px-4 rounded-none text-xs font-mono uppercase tracking-widest bg-foreground text-background hover:bg-foreground/90 gap-2">
                <Plus className="w-4 h-4" />
                Create Team
              </Button>
            </>
          )}
          <Button variant="outline" className="h-9 px-4 rounded-none text-xs font-mono uppercase tracking-widest border-border text-accent hover:bg-accent/10 gap-2">
            <Bot className="w-4 h-4" />
            Ask Handoff AI
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        {/* --- TEAMS DIRECTORY VIEW --- */}
        {currentView === 'directory' && (
          <div className="flex flex-col flex-1 bg-background border border-border">
            <div className="p-3 border-b border-border bg-surface-hover flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-2 flex-1">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-3 h-3 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="text" placeholder="SEARCH TEAMS..." className="w-full h-8 pl-9 pr-3 bg-background border border-border text-[10px] font-mono uppercase focus:outline-none focus:border-foreground transition-colors" />
                </div>
                <Button variant="outline" size="sm" className="h-8 px-3 rounded-none text-[10px] font-mono uppercase border-border bg-background">
                  <Filter className="w-3 h-3 mr-2" /> Filters
                </Button>
              </div>
            </div>

            <div className="overflow-auto flex-1 scrollbar-thin">
              <table className="w-full min-w-[800px] text-left text-sm font-mono border-collapse whitespace-nowrap">
                <thead className="sticky top-0 bg-surface-hover z-10 shadow-[0_1px_0_0_var(--border)]">
                  <tr>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Team Name</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Manager</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Department</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Members</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Active Projects</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Current Sprint</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Capacity (hrs)</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Velocity (pts)</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Open Bugs</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-normal">Health</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {mockTeams.map((team) => (
                    <tr
                      key={team.id}
                      className="hover:bg-surface-hover cursor-pointer transition-colors"
                      onClick={() => handleTeamClick(team.id)}
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-accent" />
                          <span className="font-sans font-bold text-sm hover:underline decoration-border underline-offset-4">{team.name}</span>
                        </div>
                      </td>
                      <td className="p-3 text-xs">{team.manager}</td>
                      <td className="p-3 text-xs">{team.department}</td>
                      <td className="p-3 text-xs text-center">{team.members}</td>
                      <td className="p-3 text-xs text-center">{team.projects}</td>
                      <td className="p-3 text-xs text-muted-foreground">{team.sprint}</td>
                      <td className="p-3 text-xs text-center">{team.capacity}</td>
                      <td className="p-3 text-xs text-center">{team.velocity}</td>
                      <td className="p-3 text-xs text-center text-orange-500">{team.openBugs}</td>
                      <td className="p-3">
                        <span className={`text-[10px] px-2 py-0.5 border ${getHealthColor(team.health)} uppercase tracking-widest`}>
                          {team.health}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* --- TEAM DETAIL VIEW --- */}
        {currentView === 'team_detail' && selectedTeam && (
          <div className="flex flex-col flex-1 gap-6">

            {/* Handoff Assistant */}
            <div className="border border-accent/30 bg-accent/5 p-4 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-accent/10 rounded-bl-full pointer-events-none" />
              <div className="flex items-center gap-2 mb-3">
                <Bot className="w-4 h-4 text-accent" />
                <h3 className="font-mono text-[10px] uppercase tracking-widest font-bold text-foreground">Handoff Insights</h3>
              </div>
              <p className="text-sm mb-3">
                {selectedTeam.health === 'At Risk' ? 'Team is currently overloaded. Consider reallocating 2 active projects.' : 'Team capacity is balanced. Velocity is trending upwards.'}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => handleAI('Summarize Health')} variant="outline" size="sm" className="h-7 px-3 rounded-none text-[10px] font-mono uppercase tracking-widest border-border hover:bg-foreground hover:text-background text-foreground">Summarize Health</Button>
                <Button onClick={() => handleAI('Identify Skills Gaps')} variant="outline" size="sm" className="h-7 px-3 rounded-none text-[10px] font-mono uppercase tracking-widest border-border hover:bg-foreground hover:text-background text-foreground">Identify Skills Gaps</Button>
                <Button onClick={() => handleAI('Forecast Capacity')} variant="outline" size="sm" className="h-7 px-3 rounded-none text-[10px] font-mono uppercase tracking-widest border-border hover:bg-foreground hover:text-background text-foreground">Forecast Capacity</Button>
              </div>
            </div>

            {/* Team Tabs */}
            <div className="border-b border-border flex gap-4 overflow-x-auto scrollbar-none">
              {['Overview', 'Members', 'Workload', 'Projects', 'Sprint', 'Skills', 'Repositories', 'Activity'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTeamTab(tab)}
                  className={`pb-3 text-sm font-mono uppercase tracking-widest border-b-2 transition-colors whitespace-nowrap ${activeTeamTab === tab ? 'border-foreground text-foreground font-bold' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Overview Tab Content */}
            {activeTeamTab === 'Overview' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="border border-border p-4 bg-surface">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Members</div>
                      <div className="text-2xl font-bold">{selectedTeam.members}</div>
                    </div>
                    <div className="border border-border p-4 bg-surface">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Capacity</div>
                      <div className="text-2xl font-bold">{selectedTeam.capacity}h</div>
                    </div>
                    <div className="border border-border p-4 bg-surface">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Velocity</div>
                      <div className="text-2xl font-bold">{selectedTeam.velocity}</div>
                    </div>
                    <div className="border border-border p-4 bg-surface">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Health</div>
                      <div className={`text-sm font-bold mt-2 px-2 py-0.5 border inline-block ${getHealthColor(selectedTeam.health)} uppercase tracking-widest`}>{selectedTeam.health}</div>
                    </div>
                  </div>

                  <div className="border border-border bg-background">
                    <div className="p-3 border-b border-border bg-surface-hover font-mono text-xs uppercase tracking-widest font-bold">
                      Team Members Spotlight
                    </div>
                    <div className="divide-y divide-border">
                      {mockEmployees.filter(e => e.team === selectedTeam.name).map(emp => (
                        <div key={emp.id} className="p-3 flex items-center justify-between hover:bg-surface-hover cursor-pointer" onClick={() => handleEmployeeClick(emp.id)}>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-surface border border-border flex items-center justify-center font-mono text-[10px] uppercase">{emp.name.charAt(0)}</div>
                            <div>
                              <div className="font-bold text-sm">{emp.name}</div>
                              <div className="text-xs text-muted-foreground">{emp.role}</div>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="border border-border bg-background p-5 space-y-4">
                    <h3 className="font-mono text-xs uppercase tracking-widest font-bold border-b border-border pb-2">Info</h3>
                    <div>
                      <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1">Manager</div>
                      <div className="text-sm font-bold flex items-center gap-2"><UserCircle className="w-4 h-4 text-muted-foreground" /> {selectedTeam.manager}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1">Department</div>
                      <div className="text-sm">{selectedTeam.department}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1">Mission</div>
                      <div className="text-sm text-muted-foreground italic">&quot;To provide reliable, scalable, and secure payment processing capabilities for all enterprise products.&quot;</div>
                    </div>
                  </div>

                  <div className="border border-border bg-background p-5 space-y-4">
                    <h3 className="font-mono text-xs uppercase tracking-widest font-bold border-b border-border pb-2">Current Sprint</h3>
                    <div className="text-sm font-bold text-accent">{selectedTeam.sprint}</div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span>Sprint Progress</span>
                        <span className="font-mono">65%</span>
                      </div>
                      <div className="h-1.5 w-full bg-surface border border-border overflow-hidden">
                        <div className="h-full bg-foreground w-[65%]" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Other tabs placeholder */}
            {activeTeamTab !== 'Overview' && (
              <div className="flex-1 flex items-center justify-center border border-dashed border-border bg-surface/50">
                <div className="text-center">
                  <Activity className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Select {activeTeamTab} view content</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- EMPLOYEE PROFILE VIEW --- */}
        {currentView === 'employee_profile' && selectedEmployee && (
          <div className="flex flex-col md:flex-row gap-6">
            {/* Left Sidebar Profile */}
            <div className="w-full md:w-80 space-y-6 flex-shrink-0">
              <div className="border border-border bg-background p-6 flex flex-col items-center text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-16 bg-surface-hover border-b border-border" />
                <div className="w-20 h-20 bg-background border-2 border-border flex items-center justify-center font-mono text-2xl font-bold uppercase relative z-10 mb-4 shadow-sm">
                  {selectedEmployee.name.charAt(0)}
                </div>
                <h2 className="text-xl font-bold tracking-tight">{selectedEmployee.name}</h2>
                <p className="text-sm text-accent font-mono mb-1">{selectedEmployee.role}</p>
                <p className="text-xs text-muted-foreground">{selectedEmployee.department}</p>

                <div className="flex gap-2 mt-4">
                  <Button onClick={() => window.location.href = `mailto:team-member@handoff.dev`} variant="outline" size="sm" className="h-8 px-3 rounded-none border-border"><Mail className="w-3 h-3 mr-2" /> Message</Button>
                  <Button onClick={() => alert('Opening calendar integration...')} variant="outline" size="sm" className="h-8 px-3 rounded-none border-border"><Calendar className="w-3 h-3 mr-2" /> Meeting</Button>
                </div>
              </div>

              <div className="border border-border bg-background p-5 space-y-4 text-sm">
                <h3 className="font-mono text-xs uppercase tracking-widest font-bold border-b border-border pb-2">Details</h3>
                <div className="flex items-center gap-3"><Users className="w-4 h-4 text-muted-foreground" /> <span>Team: <span className="font-bold">{selectedEmployee.team}</span></span></div>
                <div className="flex items-center gap-3"><UserCircle className="w-4 h-4 text-muted-foreground" /> <span>Manager: {selectedEmployee.manager}</span></div>
                <div className="flex items-center gap-3"><MapPin className="w-4 h-4 text-muted-foreground" /> <span>{selectedEmployee.location}</span></div>
                <div className="flex items-center gap-3"><Globe className="w-4 h-4 text-muted-foreground" /> <span>{selectedEmployee.timezone}</span></div>
                <div className="flex items-center gap-3"><GitPullRequest className="w-4 h-4 text-muted-foreground" /> <span className="font-mono text-xs">{selectedEmployee.github}</span></div>
              </div>

              <div className="border border-border bg-background p-5 space-y-4">
                <h3 className="font-mono text-xs uppercase tracking-widest font-bold border-b border-border pb-2">Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedEmployee.skills.map(skill => (
                    <span key={skill} className="px-2 py-1 border border-border bg-surface text-[10px] font-mono uppercase tracking-widest">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Main Content */}
            <div className="flex-1 space-y-6">

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="border border-border p-4 bg-surface">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Active Tasks</div>
                  <div className="text-2xl font-bold">{selectedEmployee.activeTasks}</div>
                </div>
                <div className="border border-border p-4 bg-surface">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Capacity</div>
                  <div className="text-2xl font-bold">{selectedEmployee.capacity}h</div>
                </div>
                <div className="border border-border p-4 bg-surface">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Workload</div>
                  <div className={`text-2xl font-bold ${selectedEmployee.workload > selectedEmployee.capacity ? 'text-orange-500' : 'text-foreground'}`}>{selectedEmployee.workload}h</div>
                </div>
                <div className="border border-border p-4 bg-surface">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Sprint</div>
                  <div className="text-lg font-bold mt-1 text-accent">{selectedEmployee.sprint}</div>
                </div>
              </div>

              <div className="border border-border bg-background">
                <div className="p-4 border-b border-border font-mono text-xs uppercase tracking-widest font-bold">
                  Recent Activity
                </div>
                <div className="p-4 space-y-4">
                  <div className="flex gap-4">
                    <div className="w-6 h-6 bg-surface border border-border flex items-center justify-center flex-shrink-0 mt-0.5"><GitPullRequest className="w-3 h-3" /></div>
                    <div>
                      <p className="text-sm">{selectedEmployee.recentActivity}</p>
                      <span className="text-[10px] font-mono text-muted-foreground">2 hours ago</span>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-6 h-6 bg-surface border border-border flex items-center justify-center flex-shrink-0 mt-0.5"><CheckCircle2 className="w-3 h-3 text-emerald-500" /></div>
                    <div>
                      <p className="text-sm">Completed task: Update Auth Service to v2</p>
                      <span className="text-[10px] font-mono text-muted-foreground">Yesterday</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Handoff Assistant */}
              <div className="border border-accent/30 bg-accent/5 p-4 flex items-start gap-4">
                <Bot className="w-5 h-5 text-accent flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-mono text-[10px] uppercase tracking-widest font-bold text-foreground mb-2">Handoff Career & Allocation Insights</h3>
                  <p className="text-sm mb-3 text-muted-foreground">
                    {selectedEmployee.name} is currently allocated at {Math.round((selectedEmployee.workload / selectedEmployee.capacity) * 100)}% capacity. Skills match well with upcoming Q3 architecture projects.
                  </p>
                  <div className="flex gap-2">
                    <Button onClick={() => handleAI('Suggest Best Assignee')} variant="outline" size="sm" className="h-7 px-3 rounded-none text-[10px] font-mono uppercase tracking-widest border-border hover:bg-foreground hover:text-background text-foreground">Suggest Best Assignee</Button>
                    <Button onClick={() => handleAI('Suggest Training Focus')} variant="outline" size="sm" className="h-7 px-3 rounded-none text-[10px] font-mono uppercase tracking-widest border-border hover:bg-foreground hover:text-background text-foreground">Suggest Training Focus</Button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* --- RESOURCE PLANNING VIEW --- */}
        {currentView === 'resource_planning' && (
          <div className="flex flex-col flex-1 gap-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="border border-border p-5 bg-surface">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Total Org Capacity</div>
                <div className="text-3xl font-bold font-mono tracking-tight">2,320h</div>
              </div>
              <div className="border border-border p-5 bg-surface">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Allocated Hours</div>
                <div className="text-3xl font-bold font-mono tracking-tight">2,150h</div>
              </div>
              <div className="border border-border p-5 bg-surface border-orange-500/50">
                <div className="font-mono text-[10px] uppercase tracking-widest text-orange-500 mb-2">Overloaded Employees</div>
                <div className="text-3xl font-bold font-mono tracking-tight text-orange-500">12</div>
              </div>
              <div className="border border-border p-5 bg-surface">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Staffing Requests</div>
                <div className="text-3xl font-bold font-mono tracking-tight">8</div>
              </div>
            </div>

            {/* Handoff Planning Assistant */}
            <div className="border border-accent border-l-4 p-5 bg-accent/5 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
              <div className="max-w-3xl">
                <div className="flex items-center gap-2 mb-2">
                  <Bot className="w-5 h-5 text-accent" />
                  <h3 className="font-mono text-xs uppercase tracking-widest font-bold text-foreground">Handoff Resource Recommendations</h3>
                </div>
                <p className="text-sm">
                  <span className="font-bold text-orange-500">Mobile Banking</span> team is at risk with 110% allocation. Consider shifting 2 developers from <span className="font-bold">Web Platform</span> (currently underutilized) to assist with the React Native migration sprint.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                <Button className="h-9 px-4 rounded-none text-xs font-mono uppercase tracking-widest bg-foreground text-background hover:bg-foreground/90 whitespace-nowrap">
                  Apply Recommendations
                </Button>
                <Button variant="outline" className="h-9 px-4 rounded-none text-xs font-mono uppercase tracking-widest border-border text-foreground hover:bg-surface-hover whitespace-nowrap">
                  Detect Skills Gaps
                </Button>
              </div>
            </div>

            {/* Allocation Table placeholder */}
            <div className="flex-1 border border-border bg-background flex flex-col">
              <div className="p-4 border-b border-border bg-surface flex justify-between items-center">
                <h3 className="font-mono text-xs uppercase tracking-widest font-bold">Allocation Heatmap</h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="h-8 rounded-none border-border">By Team</Button>
                  <Button variant="outline" size="sm" className="h-8 rounded-none border-border">By Project</Button>
                  <Button variant="outline" size="sm" className="h-8 rounded-none border-border">By Skill</Button>
                </div>
              </div>
              <div className="flex-1 p-8 flex flex-col items-center justify-center text-center">
                <BarChart3 className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
                <h4 className="text-lg font-bold mb-2">Resource Heatmap View</h4>
                <p className="text-sm text-muted-foreground max-w-sm">Detailed allocation charts and skill matrices will be rendered here. Use the Handoff recommendations above for immediate actions.</p>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}


