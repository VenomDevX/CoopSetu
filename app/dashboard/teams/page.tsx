'use client';

import React, { useState, useEffect } from 'react';
import {
  ChevronRight,
  Search,
  Filter,
  Plus,
  Users,
  UserCircle,
  BarChart3,
  Calendar,
  Activity,
  ArrowLeft,
  Mail,
  Globe,
  CheckCircle2,
} from 'lucide-react';
import { AskAiButton } from '@/components/ai/ask-ai-button';
import { Button } from '@/components/ui/button';
import { WorkspaceDataLayout } from '@/components/layout/workspace-data-layout';

function mapTeam(r: any) {
  return {
    id: r.id, name: r.name, manager: r.team_lead?.profile?.full_name ?? '—',
    department: r.department?.name ?? '—',
    members: r.team_members?.[0]?.count ?? 0,
    projects: r.projects ?? 0,
    sprint: r.sprintName ?? '—',
    sprintProgress: typeof r.sprintProgress === 'number' ? r.sprintProgress : null,
    capacity: Number(r.capacity_hours_per_week) || 0,
    velocity: r.velocity ?? 0,
    openBugs: r.openBugs ?? 0,
    // null = no active projects linked yet, i.e. genuinely unknown — never
    // defaulted to a fabricated "Healthy".
    health: r.health ?? null,
  };
}

interface RecentActivityItem { action: string; created_at: string }

function mapEmployee(r: any, teamNameById: Record<string, string>) {
  const p = Array.isArray(r.profile) ? r.profile[0] : r.profile;
  const dept = Array.isArray(r.department) ? r.department[0] : r.department;
  const mgr = Array.isArray(r.manager) ? r.manager[0] : r.manager;
  const mgrProfile = mgr ? (Array.isArray(mgr.profile) ? mgr.profile[0] : mgr.profile) : null;
  const teamId = r.team_members?.[0]?.team_id;
  return {
    id: r.id, name: p?.full_name ?? p?.email ?? 'Member', role: p?.job_title ?? '—',
    email: p?.email ?? null,
    department: dept?.name ?? '—', team: teamId ? (teamNameById[teamId] ?? '—') : '—',
    manager: mgrProfile?.full_name ?? '—',
    timezone: p?.timezone ?? 'UTC',
    activeTasks: r.activeTasks ?? 0,
    workload: r.workload ?? 0,
    // No per-member capacity column exists anywhere in the schema; 40h/week
    // is a standard full-time assumption, not a per-person fabricated value.
    capacity: 40,
    recentActivity: (r.recentActivity ?? []) as RecentActivityItem[],
  };
}

const getHealthColor = (health: string | null) => {
  switch (health) {
    case 'Healthy': return 'text-emerald-500 border-emerald-500 bg-emerald-500/10';
    case 'At Risk': return 'text-orange-500 border-orange-500 bg-orange-500/10';
    case 'Critical': return 'text-destructive border-destructive bg-destructive/10';
    default: return 'text-muted-foreground border-border bg-surface';
  }
};

function humanizeAction(action: string): string {
  const words = action.replace(/[._]/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

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

  // Org-wide resource planning KPIs, derived from the same real per-team/
  // per-employee data already loaded above — no separate fabricated numbers.
  const totalCapacity = mockTeams.reduce((sum, t) => sum + t.capacity, 0);
  const allocatedHours = mockEmployees.reduce((sum, e) => sum + e.workload, 0);
  const overloadedCount = mockEmployees.filter(e => e.workload > e.capacity).length;

  return (
    <WorkspaceDataLayout className="space-y-6 animate-in fade-in duration-500 flex flex-col">
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
              <Button variant="outline" size="sm" onClick={handleBack} className="h-8 w-8 p-0 rounded border-border">
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
            {currentView === 'directory' && 'Manage training teams, skills, capacity, staffing, and workload allocation.'}
            {currentView === 'team_detail' && 'Team performance, workload, and capacity oversight.'}
            {currentView === 'employee_profile' && 'Employee allocation, skills, and activity profile.'}
            {currentView === 'resource_planning' && 'Cross-team capacity forecasting and skill allocation.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {currentView === 'directory' && (
            <>
              <Button onClick={() => setCurrentView('resource_planning')} variant="outline" className="h-9 px-4 rounded text-xs font-mono uppercase tracking-widest border-border text-foreground hover:bg-surface-hover gap-2">
                <BarChart3 className="w-4 h-4" />
                Resource Planning
              </Button>
              <Button variant="outline" className="h-9 px-4 rounded text-xs font-mono uppercase tracking-widest border-border text-foreground hover:bg-surface-hover gap-2">
                <UserCircle className="w-4 h-4" />
                Invite Employee
              </Button>
              <Button className="h-9 px-4 rounded text-xs font-mono uppercase tracking-widest bg-foreground text-background hover:bg-foreground/90 gap-2">
                <Plus className="w-4 h-4" />
                Create Team
              </Button>
            </>
          )}
          {/* summarize-teams is not yet a registered AI intent — clicking
              surfaces a real "unknown intent" error rather than faking a
              response; wiring it is future work, not this phase's scope. */}
          <AskAiButton intent="summarize-teams" title="Team Health Digest" />
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        {/* --- TEAMS DIRECTORY VIEW --- */}
        {currentView === 'directory' && (
          <div className="flex flex-col flex-1 bg-background border border-border rounded">
            <div className="p-3 border-b border-border bg-surface-hover flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-2 flex-1">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-3 h-3 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="text" placeholder="SEARCH TEAMS..." className="w-full h-8 pl-9 pr-3 bg-background border border-border rounded text-[10px] font-mono uppercase focus:outline-none focus:border-foreground transition-colors" />
                </div>
                <Button variant="outline" size="sm" className="h-8 px-3 rounded text-[10px] font-mono uppercase border-border bg-background">
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
                          {team.health ?? 'No Data'}
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
                    <div className="border border-border rounded p-4 bg-surface">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Members</div>
                      <div className="text-2xl font-bold">{selectedTeam.members}</div>
                    </div>
                    <div className="border border-border rounded p-4 bg-surface">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Capacity</div>
                      <div className="text-2xl font-bold">{selectedTeam.capacity}h</div>
                    </div>
                    <div className="border border-border rounded p-4 bg-surface">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Velocity</div>
                      <div className="text-2xl font-bold">{selectedTeam.velocity}</div>
                    </div>
                    <div className="border border-border rounded p-4 bg-surface">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Health</div>
                      <div className={`text-sm font-bold mt-2 px-2 py-0.5 border inline-block ${getHealthColor(selectedTeam.health)} uppercase tracking-widest`}>{selectedTeam.health ?? 'No Data'}</div>
                    </div>
                  </div>

                  <div className="border border-border rounded bg-background">
                    <div className="p-3 border-b border-border bg-surface-hover font-mono text-xs uppercase tracking-widest font-bold">
                      Team Members Spotlight
                    </div>
                    <div className="divide-y divide-border">
                      {mockEmployees.filter(e => e.team === selectedTeam.name).map(emp => (
                        <div key={emp.id} className="p-3 flex items-center justify-between hover:bg-surface-hover cursor-pointer" onClick={() => handleEmployeeClick(emp.id)}>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-surface border border-border rounded flex items-center justify-center font-mono text-[10px] uppercase">{emp.name.charAt(0)}</div>
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
                  <div className="border border-border rounded bg-background p-5 space-y-4">
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
                      <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1">Open Bugs</div>
                      <div className="text-sm">{selectedTeam.openBugs}</div>
                    </div>
                  </div>

                  <div className="border border-border rounded bg-background p-5 space-y-4">
                    <h3 className="font-mono text-xs uppercase tracking-widest font-bold border-b border-border pb-2">Current Sprint</h3>
                    {selectedTeam.sprint !== '—' && selectedTeam.sprintProgress !== null ? (
                      <>
                        <div className="text-sm font-bold text-accent">{selectedTeam.sprint}</div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs">
                            <span>Sprint Progress</span>
                            <span className="font-mono">{selectedTeam.sprintProgress}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-surface border border-border rounded overflow-hidden">
                            <div className="h-full bg-foreground" style={{ width: `${selectedTeam.sprintProgress}%` }} />
                          </div>
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">No active sprint for this team.</p>
                    )}
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
              <div className="border border-border rounded bg-background p-6 flex flex-col items-center text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-16 bg-surface-hover border-b border-border" />
                <div className="w-20 h-20 bg-background border-2 border-border flex items-center justify-center font-mono text-2xl font-bold uppercase relative z-10 mb-4 shadow-sm">
                  {selectedEmployee.name.charAt(0)}
                </div>
                <h2 className="text-xl font-bold tracking-tight">{selectedEmployee.name}</h2>
                <p className="text-sm text-accent font-mono mb-1">{selectedEmployee.role}</p>
                <p className="text-xs text-muted-foreground">{selectedEmployee.department}</p>

                <div className="flex gap-2 mt-4">
                  {selectedEmployee.email && (
                    <Button onClick={() => window.location.href = `mailto:${selectedEmployee.email}`} variant="outline" size="sm" className="h-8 px-3 rounded border-border"><Mail className="w-3 h-3 mr-2" /> Message</Button>
                  )}
                  <Button onClick={() => window.location.href = '/dashboard/calendar'} variant="outline" size="sm" className="h-8 px-3 rounded border-border"><Calendar className="w-3 h-3 mr-2" /> Meeting</Button>
                </div>
              </div>

              <div className="border border-border rounded bg-background p-5 space-y-4 text-sm">
                <h3 className="font-mono text-xs uppercase tracking-widest font-bold border-b border-border pb-2">Details</h3>
                <div className="flex items-center gap-3"><Users className="w-4 h-4 text-muted-foreground" /> <span>Team: <span className="font-bold">{selectedEmployee.team}</span></span></div>
                <div className="flex items-center gap-3"><UserCircle className="w-4 h-4 text-muted-foreground" /> <span>Manager: {selectedEmployee.manager}</span></div>
                <div className="flex items-center gap-3"><Globe className="w-4 h-4 text-muted-foreground" /> <span>{selectedEmployee.timezone}</span></div>
              </div>
            </div>

            {/* Right Main Content */}
            <div className="flex-1 space-y-6">

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="border border-border rounded p-4 bg-surface">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Active Tasks</div>
                  <div className="text-2xl font-bold">{selectedEmployee.activeTasks}</div>
                </div>
                <div className="border border-border rounded p-4 bg-surface">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Capacity</div>
                  <div className="text-2xl font-bold">{selectedEmployee.capacity}h</div>
                </div>
                <div className="border border-border rounded p-4 bg-surface">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Workload</div>
                  <div className={`text-2xl font-bold ${selectedEmployee.workload > selectedEmployee.capacity ? 'text-orange-500' : 'text-foreground'}`}>{selectedEmployee.workload}h</div>
                </div>
              </div>

              <div className="border border-border rounded bg-background">
                <div className="p-4 border-b border-border font-mono text-xs uppercase tracking-widest font-bold">
                  Recent Activity
                </div>
                <div className="p-4 space-y-4">
                  {selectedEmployee.recentActivity.length === 0 ? (
                    <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">No recent activity.</p>
                  ) : (
                    selectedEmployee.recentActivity.map((item, i) => (
                      <div key={i} className="flex gap-4">
                        <div className="w-6 h-6 bg-surface border border-border rounded flex items-center justify-center flex-shrink-0 mt-0.5"><CheckCircle2 className="w-3 h-3 text-emerald-500" /></div>
                        <div>
                          <p className="text-sm">{humanizeAction(item.action)}</p>
                          <span className="text-[10px] font-mono text-muted-foreground">{timeAgo(item.created_at)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- RESOURCE PLANNING VIEW --- */}
        {currentView === 'resource_planning' && (
          <div className="flex flex-col flex-1 gap-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border border-border rounded p-5 bg-surface">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Total Org Capacity</div>
                <div className="text-3xl font-bold font-mono tracking-tight">{totalCapacity.toLocaleString()}h</div>
              </div>
              <div className="border border-border rounded p-5 bg-surface">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Allocated Hours</div>
                <div className="text-3xl font-bold font-mono tracking-tight">{allocatedHours.toLocaleString()}h</div>
              </div>
              <div className={`border rounded p-5 bg-surface ${overloadedCount > 0 ? 'border-orange-500/50' : 'border-border'}`}>
                <div className={`font-mono text-[10px] uppercase tracking-widest mb-2 ${overloadedCount > 0 ? 'text-orange-500' : 'text-muted-foreground'}`}>Overloaded Employees</div>
                <div className={`text-3xl font-bold font-mono tracking-tight ${overloadedCount > 0 ? 'text-orange-500' : ''}`}>{overloadedCount}</div>
              </div>
            </div>

            {/* Allocation Table placeholder */}
            <div className="flex-1 border border-border rounded bg-background flex flex-col">
              <div className="p-4 border-b border-border bg-surface flex justify-between items-center">
                <h3 className="font-mono text-xs uppercase tracking-widest font-bold">Allocation Heatmap</h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="h-8 rounded border-border">By Team</Button>
                  <Button variant="outline" size="sm" className="h-8 rounded border-border">By Project</Button>
                  <Button variant="outline" size="sm" className="h-8 rounded border-border">By Skill</Button>
                </div>
              </div>
              <div className="flex-1 p-8 flex flex-col items-center justify-center text-center">
                <BarChart3 className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
                <h4 className="text-lg font-bold mb-2">Resource Heatmap View</h4>
                <p className="text-sm text-muted-foreground max-w-sm">Detailed allocation charts and skill matrices will be rendered here.</p>
              </div>
            </div>

          </div>
        )}
      </div>
    </WorkspaceDataLayout>
  );
}
