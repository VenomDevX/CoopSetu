'use client';

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, RefreshCw, Smartphone, Key } from 'lucide-react';
import { useEffect, useState, useRef } from "react";
import { motion } from "motion/react";
import QRCode from 'qrcode';
import { TOTP } from 'totp-generator';

export default function DigitalIdCard() {
  const [userId, setUserId] = useState('');
  const [secret, setSecret] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [totpCode, setTotpCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch or generate secret from API on load
  useEffect(() => {
    let mounted = true;
    const loadSecret = async () => {
      try {
        const res = await fetch(`/api/v1/attendance/totp`);
        const j = await res.json();
        if (mounted) {
          if (j?.data?.secret) {
            setSecret(j.data.secret);
            setUserId(j.data.userId);
          } else {
            setError(j.error || 'Failed to load secret');
          }
        }
      } catch (err: any) {
        if (mounted) setError('Network error');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadSecret();
    return () => { mounted = false; };
  }, []);

  // Update TOTP and QR code
  useEffect(() => {
    if (!secret || !userId) return;

    const updateQr = async () => {
      try {
        const { otp: code } = await TOTP.generate(secret);
        setTotpCode(code);
        
        // Format: coopsetu:USER_ID:TOTP_CODE
        const payload = `coopsetu:${userId}:${code}`;
        
        QRCode.toDataURL(payload, {
          width: 300,
          margin: 2,
          color: { dark: '#000000', light: '#ffffff' },
          errorCorrectionLevel: 'H'
        }).then(url => setQrDataUrl(url));

        // Calculate time left in the current 30s window
        const epoch = Math.floor(Date.now() / 1000);
        const remaining = 30 - (epoch % 30);
        setTimeLeft(remaining);

      } catch (err) {
        console.error('QR Gen Error:', err);
      }
    };

    updateQr();
    const interval = setInterval(updateQr, 1000);
    return () => clearInterval(interval);
  }, [secret, userId]);

  return (
    <div className="max-w-md mx-auto space-y-6 pb-24 mt-12">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <h1 className="text-3xl font-bold tracking-tighter uppercase text-foreground mb-2">Digital ID Card</h1>
        <p className="text-sm text-muted-foreground font-mono">Present this live QR to the scanner</p>
      </motion.div>

      {loading ? (
        <Card className="shadow-none border-border rounded bg-background">
          <CardContent className="p-12 flex flex-col items-center justify-center">
             <RefreshCw className="w-8 h-8 text-muted-foreground animate-spin mb-4" />
             <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Generating Secure ID...</p>
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="shadow-none border-red-500/50 rounded bg-background">
          <CardContent className="p-6 text-center">
            <p className="text-red-500 text-sm font-mono">{error}</p>
          </CardContent>
        </Card>
      ) : secret ? (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <Card className="shadow-none border-2 border-foreground rounded bg-background overflow-hidden relative">
            {/* Hologram effect line */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 animate-pulse" />
            
            <CardContent className="p-8 flex flex-col items-center text-center">
              <ShieldCheck className="w-8 h-8 text-foreground mb-6" />
              
              <div className="w-full aspect-square bg-white rounded-xl p-4 flex items-center justify-center mb-6 shadow-xl relative">
                {qrDataUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={qrDataUrl} alt="Live QR" className="w-full h-full object-contain" />
                ) : (
                  <RefreshCw className="w-8 h-8 text-muted-foreground animate-spin" />
                )}
                
                {/* Scanner line overlay for aesthetic */}
                <motion.div 
                  className="absolute left-4 right-4 h-0.5 bg-blue-500/50 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                  animate={{ top: ['10%', '90%', '10%'] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                />
              </div>

              <div className="flex items-center gap-2 mb-2">
                <Smartphone className="w-4 h-4 text-muted-foreground" />
                <span className="font-mono text-sm uppercase text-muted-foreground">Scan at door</span>
              </div>
              
              <div className="text-xs font-mono text-muted-foreground">
                ID: <span className="text-foreground font-bold">{userId.slice(0, 8)}...</span>
              </div>

              <div className="mt-8 flex items-center gap-3 w-full border-t border-border pt-6">
                <div className="flex-1 text-left">
                  <div className="text-[10px] font-mono uppercase text-muted-foreground tracking-widest mb-1">Live Code</div>
                  <div className="text-xl font-mono font-bold tracking-[0.2em]">{totpCode}</div>
                </div>
                <div className="flex-none">
                  <div className="relative w-10 h-10 flex items-center justify-center">
                    <svg className="absolute inset-0 w-full h-full -rotate-90">
                      <circle cx="20" cy="20" r="16" className="stroke-border fill-none" strokeWidth="2" />
                      <motion.circle 
                        cx="20" cy="20" r="16" 
                        className={`${timeLeft < 5 ? 'stroke-red-500' : 'stroke-blue-500'} fill-none transition-colors duration-300`} 
                        strokeWidth="2"
                        strokeDasharray="100"
                        strokeDashoffset={100 - (timeLeft / 30) * 100}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="font-mono text-[10px] absolute">{timeLeft}s</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : null}
    </div>
  );
}
