'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { CreateReleaseModal } from '@/components/repositories/create-release-modal';
import { useRouter } from 'next/navigation';

export function ClientReleasesActions() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const router = useRouter();

  return (
    <>
      <Button
        variant="default"
        className="h-9 px-4 rounded text-xs font-mono uppercase tracking-widest bg-accent text-accent-foreground border-accent hover:bg-accent/90 gap-2"
        onClick={() => setShowCreateModal(true)}
      >
        <Plus className="w-4 h-4" />
        Create Release
      </Button>

      {showCreateModal && (
        <CreateReleaseModal 
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
