import { Loader2 } from 'lucide-react';

export default function DashboardLoading() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center min-h-[400px] animate-in fade-in duration-500 text-muted-foreground">
      <Loader2 className="w-6 h-6 animate-spin mb-4" />
      <div className="text-xs font-mono uppercase tracking-widest">Loading Module...</div>
    </div>
  );
}
