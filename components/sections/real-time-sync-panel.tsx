"use client";

import { motion, type Variants } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';

interface RealTimeSyncPanelProps {
  expanded: boolean | null;
}

export function RealTimeSyncPanel({ expanded }: RealTimeSyncPanelProps) {
  const shouldReduceMotion = false;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration-safe mount guard
    setMounted(true);
  }, []);

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 10 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] }
    }
  };

  return (
    <motion.div 
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-100px" }}
      variants={containerVariants}
      className={`shrink-0 flex flex-col p-8 md:p-10 h-full relative z-20 bg-surface transition-all duration-[800ms] ${
        expanded ? 'lg:w-[calc(50%-1.25rem)]' : 'w-full'
      }`}
    >
      <div className="mb-12 relative z-10 flex flex-col items-start w-full flex-1">
        {/* Eyebrow */}
        <motion.div variants={itemVariants} className="flex items-center gap-3 w-full mb-6">
          <div className="font-mono text-[11px] uppercase tracking-widest text-foreground/50 flex items-center gap-2">
            <span className="text-foreground/40">✛</span> PHASE_03 // VELOCITY
          </div>
          <div className="h-[1px] bg-foreground/20 flex-1" />
        </motion.div>
        
        {/* Title */}
        <motion.h2 variants={itemVariants} className="text-4xl md:text-5xl font-bold tracking-tighter uppercase leading-[0.9] mb-6">
          Real-Time<br />Sync.
        </motion.h2>

        {/* Subtitle */}
        <motion.p variants={itemVariants} className={`text-foreground/60 text-sm leading-relaxed mb-10 font-mono tracking-tight transition-opacity ${!expanded && expanded !== null ? 'opacity-0 lg:opacity-100' : ''}`}>
          Deterministic CRDT engine resolves edits simultaneously without locking. Sub-millisecond state propagation across all nodes globally.
        </motion.p>

        {/* TELEMETRY PANEL */}
        <motion.div variants={itemVariants} className={`w-full relative mb-8 rounded group ${!expanded && expanded !== null ? 'opacity-0 lg:opacity-100' : ''}`}>
          <div className="py-2 flex justify-between items-start">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-widest text-foreground/50 mb-1">Throughput</div>
              <div className="text-3xl font-bold tracking-tighter flex items-end gap-1">
                {mounted ? "5M" : "0"}<span className="text-accent mb-1.5 text-xl leading-none">/s</span>
              </div>
            </div>
          </div>
          <div className="flex gap-12 mt-4">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-widest text-foreground/40 mb-1.5">Latency</div>
              <div className="text-[11px] font-mono text-foreground flex items-center gap-1.5">
                <span className="text-accent">⚡</span> {'<'} 12ms
              </div>
            </div>
            <div>
              <div className="font-mono text-[11px] uppercase tracking-widest text-foreground/40 mb-1.5">Conflicts</div>
              <div className="text-[11px] font-mono text-green-500 flex items-center gap-1.5">
                <span>✓</span> 0.00%
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="mt-auto inline-flex items-center gap-2 text-[11px] text-foreground/60 hover:text-foreground transition-colors font-mono uppercase tracking-widest cursor-pointer group relative w-fit">
          EXTRACT DETAILS <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1" />
          <div className="absolute -bottom-1 left-0 w-0 h-[1px] bg-accent transition-all duration-300 group-hover:w-full" />
        </motion.div>
      </div>

      {/* SCOPE PANEL (Event Stream Graphic) */}
      <motion.div variants={itemVariants} className={`mt-auto flex items-center justify-center w-full aspect-square max-w-[280px] mx-auto relative z-10 opacity-90 transition-all duration-700 ${!expanded && expanded !== null ? 'scale-75 opacity-20 lg:scale-100 lg:opacity-90' : ''}`}>
        

        <div className="absolute inset-0 rounded overflow-hidden relative z-10">
          {/* SVG Event Stream Diagram */}
          <svg viewBox="0 0 200 200" className="w-full h-full p-2 text-foreground" style={{ display: 'block', overflow: 'visible' }}>


            {/* Stream Lanes */}
            {[
              { id: "CH_01", y: 40, offset: 0, dur: 1.2, speed: 40, active: true },
              { id: "CH_02", y: 70, offset: 0.3, dur: 1.8, speed: 20, active: false },
              { id: "CH_03", y: 100, offset: 0.6, dur: 1.0, speed: 60, active: true },
              { id: "CH_04", y: 130, offset: 0.1, dur: 1.5, speed: 30, active: true },
              { id: "CH_05", y: 160, offset: 0.8, dur: 1.6, speed: 25, active: false },
            ].map((lane, i) => (
              <g key={lane.id}>
                {/* Lane Background Line */}
                <line x1="20" y1={lane.y} x2="180" y2={lane.y} stroke="currentColor" strokeOpacity={0.1} strokeWidth="1" strokeDasharray="2 2" />
                
                {/* Lane Label */}
                <text x="18" y={lane.y + 2.5} fill="currentColor" fillOpacity={0.4} fontSize="7" fontFamily="monospace" textAnchor="end" letterSpacing="0.5">
                  {lane.id}
                </text>

                {/* Left/Right Brackets */}
                <path d={`M 24 ${lane.y - 4} L 22 ${lane.y - 4} L 22 ${lane.y + 4} L 24 ${lane.y + 4}`} fill="none" stroke="currentColor" strokeOpacity={0.3} strokeWidth="1" />
                <path d={`M 176 ${lane.y - 4} L 178 ${lane.y - 4} L 178 ${lane.y + 4} L 176 ${lane.y + 4}`} fill="none" stroke="currentColor" strokeOpacity={0.3} strokeWidth="1" />

                {/* Animated Data Packets */}
                {!shouldReduceMotion && (
                  <motion.g
                    initial={{ x: 25 }}
                    animate={{ x: 175 }}
                    transition={{
                      duration: lane.dur,
                      repeat: Infinity,
                      ease: "linear",
                      delay: lane.offset
                    }}
                  >
                    {/* Packet Body */}
                    <rect x="-6" y={lane.y - 2.5} width="12" height="5" fill={lane.active ? "#7c5cfc" : "var(--color-muted-foreground)"} />
                    <rect x="-4" y={lane.y - 1} width="2" height="2" fill="var(--color-background)" opacity="0.5" />
                    <rect x="0" y={lane.y - 1} width="2" height="2" fill="var(--color-background)" opacity="0.5" />
                  </motion.g>
                )}

                {/* Status Dot */}
                <circle cx="190" cy={lane.y} r="1.5" fill={lane.active ? "#7c5cfc" : "var(--color-border-strong)"} />
              </g>
            ))}

            {/* Vertical Sync Line indicator (Scanning) */}
            {!shouldReduceMotion && (
              <motion.line
                x1="0" y1="20" x2="0" y2="180"
                stroke="#7c5cfc" strokeWidth="0.5" opacity="0.6"
                initial={{ x: 20 }}
                animate={{ x: 180 }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "linear",
                }}
              />
            )}

            {/* Sub-labels */}
            <text x="5" y="195" fill="currentColor" fillOpacity={0.2} fontSize="6" fontFamily="monospace">SYNC: CRDT-EVT-01</text>
            <text x="195" y="195" fill="currentColor" fillOpacity={0.2} fontSize="6" fontFamily="monospace" textAnchor="end">PKT. LOSS: 0.00%</text>
          </svg>
        </div>
      </motion.div>
    </motion.div>
  );
}
