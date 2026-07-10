"use client";

import { motion, type Variants } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';

interface DataIntegrityPanelProps {
  expanded: boolean | null;
}

export function DataIntegrityPanel({ expanded }: DataIntegrityPanelProps) {
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
          <div className="font-mono text-[11px] uppercase tracking-widest text-white/50 flex items-center gap-2">
            <span className="text-white/40">✛</span> PHASE_01 // ARCHITECTURE
          </div>
          <div className="h-[1px] bg-white/20 flex-1" />
        </motion.div>
        
        {/* Title */}
        <motion.h2 variants={itemVariants} className="text-4xl md:text-5xl font-bold tracking-tighter uppercase leading-[0.9] mb-6">
          Data<br />Integrity.
        </motion.h2>

        {/* Subtitle */}
        <motion.p variants={itemVariants} className={`text-white/60 text-sm leading-relaxed mb-10 font-mono tracking-tight transition-opacity ${!expanded && expanded !== null ? 'opacity-0 lg:opacity-100' : ''}`}>
          Every byte is cryptographically hashed and mathematically verified via Merkle trees, ensuring immutable state guarantees across all mutations.
        </motion.p>

        {/* TELEMETRY PANEL */}
        <motion.div variants={itemVariants} className={`w-full relative mb-8 rounded group ${!expanded && expanded !== null ? 'opacity-0 lg:opacity-100' : ''}`}>
          <div className="py-2 flex justify-between items-start">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-widest text-white/50 mb-1">Cipher Protocol</div>
              <div className="text-3xl font-bold tracking-tighter flex items-end gap-1">
                {mounted ? "AES" : "---"}<span className="text-accent mb-1.5 text-xl leading-none">-256</span>
              </div>
            </div>
          </div>
          <div className="flex gap-12 mt-4">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-widest text-white/40 mb-1.5">Redundancy</div>
              <div className="text-[11px] font-mono text-white flex items-center gap-1.5">
                <span className="text-accent">◈</span> Multi-AZ
              </div>
            </div>
            <div>
              <div className="font-mono text-[11px] uppercase tracking-widest text-white/40 mb-1.5">Ledger</div>
              <div className="text-[11px] font-mono text-green-500 flex items-center gap-1.5">
                <span>✓</span> ZERO-KNOWLEDGE
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="mt-auto inline-flex items-center gap-2 text-[11px] text-white/60 hover:text-white transition-colors font-mono uppercase tracking-widest cursor-pointer group relative w-fit">
          EXTRACT DETAILS <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1" />
          <div className="absolute -bottom-1 left-0 w-0 h-[1px] bg-accent transition-all duration-300 group-hover:w-full" />
        </motion.div>
      </div>

      {/* SCOPE PANEL (Cryptographic Graphic) */}
      <motion.div variants={itemVariants} className={`mt-auto flex items-center justify-center w-full aspect-square max-w-[280px] mx-auto relative z-10 opacity-90 transition-all duration-700 ${!expanded && expanded !== null ? 'scale-75 opacity-20 lg:scale-100 lg:opacity-90' : ''}`}>
        

        <div className="absolute inset-0 rounded overflow-hidden relative z-10">
          {/* SVG Merkle Tree Diagram */}
          <svg viewBox="0 0 200 200" className="w-full h-full p-2" style={{ display: 'block', overflow: 'visible' }}>


            {/* Merkle Tree Lines */}
            <g stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeLinejoin="round" fill="none">
              {/* Level 2 to Root */}
              <path d="M 60 70 L 100 40 L 140 70" />
              {/* Level 3 to Level 2 (Left) */}
              <path d="M 30 110 L 60 70 L 90 110" />
              {/* Level 3 to Level 2 (Right) */}
              <path d="M 110 110 L 140 70 L 170 110" />
              {/* Data Blocks to Level 3 */}
              <line x1="30" y1="110" x2="30" y2="150" />
              <line x1="90" y1="110" x2="90" y2="150" />
              <line x1="110" y1="110" x2="110" y2="150" />
              <line x1="170" y1="110" x2="170" y2="150" />
            </g>

            {/* Animated Data Pulses */}
            {!shouldReduceMotion && (
              <>
                {/* Data to Level 3 */}
                <motion.circle cx="30" cy="150" r="2" fill="#7c5cfc" animate={{ cy: [150, 110, 110] }} transition={{ duration: 2, repeat: Infinity, times: [0, 0.4, 1] }} />
                <motion.circle cx="90" cy="150" r="2" fill="#7c5cfc" animate={{ cy: [150, 110, 110] }} transition={{ duration: 2, repeat: Infinity, times: [0, 0.4, 1] }} />
                <motion.circle cx="110" cy="150" r="2" fill="#7c5cfc" animate={{ cy: [150, 110, 110] }} transition={{ duration: 2, repeat: Infinity, times: [0, 0.4, 1] }} />
                <motion.circle cx="170" cy="150" r="2" fill="#7c5cfc" animate={{ cy: [150, 110, 110] }} transition={{ duration: 2, repeat: Infinity, times: [0, 0.4, 1] }} />
                
                {/* Level 3 to Level 2 */}
                <motion.circle cx="60" cy="70" r="2" fill="#7c5cfc" animate={{ cx: [30, 60, 60], cy: [110, 70, 70] }} transition={{ duration: 2, repeat: Infinity, times: [0.4, 0.7, 1] }} />
                <motion.circle cx="60" cy="70" r="2" fill="#7c5cfc" animate={{ cx: [90, 60, 60], cy: [110, 70, 70] }} transition={{ duration: 2, repeat: Infinity, times: [0.4, 0.7, 1] }} />
                <motion.circle cx="140" cy="70" r="2" fill="#7c5cfc" animate={{ cx: [110, 140, 140], cy: [110, 70, 70] }} transition={{ duration: 2, repeat: Infinity, times: [0.4, 0.7, 1] }} />
                <motion.circle cx="140" cy="70" r="2" fill="#7c5cfc" animate={{ cx: [170, 140, 140], cy: [110, 70, 70] }} transition={{ duration: 2, repeat: Infinity, times: [0.4, 0.7, 1] }} />

                {/* Level 2 to Root */}
                <motion.circle cx="100" cy="40" r="2" fill="#7c5cfc" animate={{ cx: [60, 100], cy: [70, 40] }} transition={{ duration: 2, repeat: Infinity, times: [0.7, 1] }} />
                <motion.circle cx="100" cy="40" r="2" fill="#7c5cfc" animate={{ cx: [140, 100], cy: [70, 40] }} transition={{ duration: 2, repeat: Infinity, times: [0.7, 1] }} />
              </>
            )}

            {/* Tree Nodes (Hashes) */}
            {/* Root Hash */}
            <rect x="92" y="32" width="16" height="16" fill="black" stroke="#7c5cfc" strokeWidth="1" />
            <rect x="96" y="36" width="8" height="8" fill="#7c5cfc" opacity="0.4" />
            <text x="100" y="24" fill="rgba(255,255,255,0.6)" fontSize="6" fontFamily="monospace" textAnchor="middle" letterSpacing="0.5">ROOT HASH</text>

            {/* Level 2 Hashes */}
            <rect x="54" y="64" width="12" height="12" fill="black" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
            <rect x="56" y="66" width="8" height="8" fill="rgba(255,255,255,0.1)" />
            <rect x="134" y="64" width="12" height="12" fill="black" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
            <rect x="136" y="66" width="8" height="8" fill="rgba(255,255,255,0.1)" />

            {/* Level 3 Hashes */}
            {[30, 90, 110, 170].map(x => (
              <g key={`l3-${x}`}>
                <rect x={x - 4} y="106" width="8" height="8" fill="black" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
                <rect x={x - 2} y="108" width="4" height="4" fill="rgba(255,255,255,0.1)" />
              </g>
            ))}

            {/* Data Blocks */}
            {[30, 90, 110, 170].map(x => (
              <g key={`data-${x}`}>
                <rect x={x - 12} y="150" width="24" height="10" fill="black" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                <path d={`M ${x - 8} 153 L ${x + 8} 153 M ${x - 8} 157 L ${x + 4} 157`} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
              </g>
            ))}

            <text x="60" y="172" fill="rgba(255,255,255,0.3)" fontSize="6" fontFamily="monospace" textAnchor="middle">BLOCK_A</text>
            <text x="140" y="172" fill="rgba(255,255,255,0.3)" fontSize="6" fontFamily="monospace" textAnchor="middle">BLOCK_B</text>

            {/* Sub-labels */}
            <text x="5" y="195" fill="rgba(255,255,255,0.2)" fontSize="6" fontFamily="monospace">OP: MERKLE_VERIFY</text>
            <text x="195" y="195" fill="rgba(255,255,255,0.2)" fontSize="6" fontFamily="monospace" textAnchor="end">SEC: AES-GCM</text>
          </svg>
        </div>
      </motion.div>
    </motion.div>
  );
}
