import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUIStore } from '@renderer/stores/uiStore';

export function useKeyboardShortcuts(): void {
  const navigate = useNavigate();
  const setCreateModalOpen = useUIStore((s) => s.setCreateModalOpen);
  const createModalOpen = useUIStore((s) => s.createModalOpen);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      const mod = e.ctrlKey || e.metaKey;
      // Ctrl+N / Cmd+N → new project
      if (mod && e.key === 'n') {
        e.preventDefault();
        setCreateModalOpen(true);
        return;
      }
      // Ctrl+, / Cmd+, → settings
      if (mod && e.key === ',') {
        e.preventDefault();
        navigate('/settings');
        return;
      }
      // Esc → close modals
      if (e.key === 'Escape' && createModalOpen) {
        setCreateModalOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, setCreateModalOpen, createModalOpen]);
}
