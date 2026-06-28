"use client";

import { motion, type Variants } from "motion/react";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";

export function GlobalScalePanel({ expanded }: { expanded: boolean }) {
  const shouldReduceMotion = false;
  const [mounted, setMounted] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (shouldReduceMotion) {
      setCount(24);
      return;
    }
    const end = 24;
    const duration = 700;
    const startTime = performance.now();
    
    const animateCount = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      setCount(Math.floor(easeOut * end));
      
      if (progress < 1) {
        requestAnimationFrame(animateCount);
      }
    };
    
    requestAnimationFrame(animateCount);
  }, [shouldReduceMotion]);

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.06 }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }
  };

  const nodes = [
    { label: "EU-WEST", r: 85, angle: 0 },
    { label: "AP-NE", r: 65, angle: 45 },
    { label: "US-WEST", r: 85, angle: 90 },
    { label: "SA-EAST", r: 65, angle: 135 },
    { label: "AF-SOUTH", r: 85, angle: 180 },
    { label: "ME-SOUTH", r: 65, angle: 225 },
    { label: "AP-SE", r: 85, angle: 270 },
    { label: "US-CENT", r: 65, angle: 315 },
  ];

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
          <div className="font-mono text-[11px] uppercase tracking-widest text-white/50 flex items-center gap-2">
            <span className="text-white/40">✛</span> PHASE_02 // DISTRIBUTION
          </div>
          <div className="h-[1px] bg-white/20 flex-1" />
        </motion.div>
        
        {/* Title */}
        <motion.h2 variants={itemVariants} className="text-4xl md:text-5xl font-bold tracking-tighter uppercase leading-[0.9] mb-6">
          Global<br />Scale.
        </motion.h2>

        {/* Subtitle */}
        <motion.p variants={itemVariants} className={`text-white/60 text-sm leading-relaxed mb-10 font-mono tracking-tight transition-opacity ${!expanded && expanded !== null ? 'opacity-0 lg:opacity-100' : ''}`}>
          Distributed across 24 edge regions. Requests are routed to the nearest core instantly.
        </motion.p>

        {/* TELEMETRY PANEL */}
        <motion.div variants={itemVariants} className={`w-full relative mb-8 rounded-none group ${!expanded && expanded !== null ? 'opacity-0 lg:opacity-100' : ''}`}>
          <div className="py-2 flex justify-between items-start">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-widest text-white/50 mb-1">Active Regions</div>
              <div className="text-3xl font-bold tracking-tighter flex items-end gap-1">
                {mounted ? count : 0}<span className="text-accent mb-1.5 text-xl leading-none">·</span>
              </div>
            </div>
          </div>
          <div className="flex gap-12 mt-4">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-widest text-white/40 mb-1.5">Latency</div>
              <div className="text-[11px] font-mono text-white flex items-center gap-1.5">
                <span className="text-accent">⚡</span> {'<'} 12ms
              </div>
            </div>
            <div>
              <div className="font-mono text-[11px] uppercase tracking-widest text-white/40 mb-1.5">Uptime</div>
              <div className="text-[11px] font-mono text-green-500 flex items-center gap-1.5">
                <span>✓</span> 99.999%
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="mt-auto inline-flex items-center gap-2 text-[11px] text-white/60 hover:text-white transition-colors font-mono uppercase tracking-widest cursor-pointer group relative w-fit">
          EXTRACT DETAILS <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1" />
          <div className="absolute -bottom-1 left-0 w-0 h-[1px] bg-accent transition-all duration-300 group-hover:w-full" />
        </motion.div>
      </div>

      {/* SCOPE PANEL (Radar) */}
      <motion.div variants={itemVariants} className={`mt-auto flex items-center justify-center w-full aspect-square max-w-[280px] mx-auto relative z-10 opacity-90 transition-all duration-700 ${!expanded && expanded !== null ? 'scale-75 opacity-20 lg:scale-100 lg:opacity-90' : ''}`}>
        <div className="absolute inset-0 rounded-none overflow-hidden">
          {/* SVG H-Tree Topology Diagram */}
          <svg viewBox="0 0 200 200" className="w-full h-full p-2" style={{ display: 'block', overflow: 'visible' }}>


            {/* Main Bus Backbone */}
            <path d="M 80 40 L 80 160" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
            <path d="M 120 40 L 120 160" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
            <path d="M 80 100 L 120 100" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />

            {/* Bus registration ticks */}
            {[40, 80, 120, 160].map(y => (
              <g key={`tick-${y}`}>
                <circle cx="80" cy={y} r="1" fill="white" opacity="0.4" />
                <circle cx="120" cy={y} r="1" fill="white" opacity="0.4" />
              </g>
            ))}

            {/* Left Nodes & Branches */}
            {[
              { label: "US-WEST", y: 40, delay: 0 },
              { label: "US-CENT", y: 80, delay: 1.5 },
              { label: "SA-EAST", y: 120, delay: 3 },
              { label: "EU-WEST", y: 160, delay: 0.5 },
            ].map(node => (
              <g key={node.label}>
                <line x1="40" y1={node.y} x2="80" y2={node.y} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                
                {/* Node Socket */}
                <rect x="38" y={node.y - 2} width="4" height="4" fill="black" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
                <rect x="39" y={node.y - 1} width="2" height="2" fill="rgba(255,255,255,0.7)" />
                <text x="31" y={node.y + 2.5} fill="rgba(255,255,255,0.4)" fontSize="7" fontFamily="monospace" textAnchor="end" letterSpacing="0.5">
                  {node.label}
                </text>

                {/* Animated Trace Pulse */}
                {!shouldReduceMotion && (
                  <motion.path
                    d={`M 40 ${node.y} L 80 ${node.y} L 80 100 L 94 100`}
                    fill="none"
                    stroke="#7c5cfc"
                    strokeWidth="1.5"
                    pathLength="100"
                    strokeDasharray="10 100"
                    initial={{ strokeDashoffset: 110 }}
                    animate={{ strokeDashoffset: -10 }}
                    transition={{
                      duration: 2.5,
                      repeat: Infinity,
                      ease: "linear",
                      delay: node.delay
                    }}
                  />
                )}
              </g>
            ))}

            {/* Right Nodes & Branches */}
            {[
              { label: "AF-SOUTH", y: 40, delay: 2 },
              { label: "ME-SOUTH", y: 80, delay: 0.2 },
              { label: "AP-NE", y: 120, delay: 2.5 },
              { label: "AP-SE", y: 160, delay: 1 },
            ].map(node => (
              <g key={node.label}>
                <line x1="160" y1={node.y} x2="120" y2={node.y} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                
                {/* Node Socket */}
                <rect x="158" y={node.y - 2} width="4" height="4" fill="black" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
                <rect x="159" y={node.y - 1} width="2" height="2" fill="rgba(255,255,255,0.7)" />
                <text x="169" y={node.y + 2.5} fill="rgba(255,255,255,0.4)" fontSize="7" fontFamily="monospace" textAnchor="start" letterSpacing="0.5">
                  {node.label}
                </text>

                {/* Animated Trace Pulse */}
                {!shouldReduceMotion && (
                  <motion.path
                    d={`M 160 ${node.y} L 120 ${node.y} L 120 100 L 106 100`}
                    fill="none"
                    stroke="#7c5cfc"
                    strokeWidth="1.5"
                    pathLength="100"
                    strokeDasharray="10 100"
                    initial={{ strokeDashoffset: 110 }}
                    animate={{ strokeDashoffset: -10 }}
                    transition={{
                      duration: 2.5,
                      repeat: Infinity,
                      ease: "linear",
                      delay: node.delay
                    }}
                  />
                )}
              </g>
            ))}

            {/* Center Core */}
            <rect x="94" y="94" width="12" height="12" fill="black" stroke="#7c5cfc" strokeWidth="1" />
            <rect x="97" y="97" width="6" height="6" fill="#7c5cfc" opacity="0.4" />
            <rect x="99" y="99" width="2" height="2" fill="#7c5cfc" />
            
            {/* Core Box Outline */}
            <rect x="88" y="88" width="24" height="24" fill="none" stroke="rgba(124, 92, 252, 0.3)" strokeWidth="1" strokeDasharray="1 2" />
            <text x="100" y="82" fill="#7c5cfc" fontSize="8" fontFamily="monospace" textAnchor="middle" letterSpacing="0.5">CORE-1</text>

            {/* Sub-labels */}
            <text x="5" y="195" fill="rgba(255,255,255,0.2)" fontSize="6" fontFamily="monospace">SYS.OP. NORMAL</text>
            <text x="195" y="195" fill="rgba(255,255,255,0.2)" fontSize="6" fontFamily="monospace" textAnchor="end">LAT. 12ms</text>
          </svg>
        </div>
      </motion.div>
    </motion.div>
  );
}
