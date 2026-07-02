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
        className="bg-accent text-accent-foreground border-accent hover:bg-accent/90"
        onClick={() => setShowCreateModal(true)}
      >
        <Plus className="w-4 h-4 mr-2" />
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
