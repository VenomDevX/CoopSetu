'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';

interface MobileNavDrawerProps {
  links: { href: string; label: string }[];
  onSignIn: () => void;
  isNavigating: boolean;
}

export function MobileNavDrawer({ links, onSignIn, isNavigating }: MobileNavDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button 
        variant="ghost" 
        size="icon" 
        className="md:hidden" 
        onClick={() => setIsOpen(true)}
      >
        <Menu className="w-5 h-5" />
      </Button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] md:hidden"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-full max-w-sm bg-background border-l border-border z-[101] flex flex-col md:hidden shadow-2xl"
            >
              <div className="h-16 flex items-center justify-between px-6 border-b border-border">
                <span className="font-mono text-xs uppercase tracking-widest font-bold">Menu</span>
                <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                <nav className="flex flex-col gap-4">
                  {links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="font-mono text-sm uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setIsOpen(false)}
                    >
                      {link.label}
                    </Link>
                  ))}
                </nav>
              </div>

              <div className="p-6 border-t border-border mt-auto">
                <Button
                  onClick={() => {
                    setIsOpen(false);
                    onSignIn();
                  }}
                  disabled={isNavigating}
                  className="w-full bg-foreground text-background hover:bg-foreground/90 rounded-none h-12 text-xs font-mono uppercase tracking-widest transition-all"
                >
                  Sign In
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
