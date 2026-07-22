import { useState } from 'react';
import type { RoutineFolder } from '@/data/types';
import { t } from '@/i18n/fr';
import { Button, Input, Sheet } from '@/ui';

type Props = {
  open: boolean;
  onClose: () => void;
  /** Absent = creating. Present = renaming that folder. */
  folder?: RoutineFolder;
  onSubmit: (name: string) => void;
};

/**
 * One field and one verb. Creating and renaming a folder are the same form, so
 * they are the same sheet — the only thing that differs is what it starts with.
 */
export function FolderFormSheet({ open, onClose, folder, onSubmit }: Props) {
  const [name, setName] = useState('');
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // Adjusted during render, not in an effect: an effect would paint one frame of
  // the previous folder's name. Keyed on identity so reopening re-reads.
  const key = open ? (folder?.id ?? 'new') : null;
  if (loadedFor !== key) {
    setLoadedFor(key);
    setName(folder?.name ?? '');
  }

  const trimmed = name.trim();

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={folder === undefined ? t('routines.newFolder') : t('routines.folderRename')}
    >
      <div className="flex flex-col gap-5 pb-2">
        <Input
          label={t('routines.folderNameLabel')}
          placeholder={t('routines.folderNamePlaceholder')}
          value={name}
          enterKeyHint="done"
          onChange={(event) => setName(event.target.value)}
        />
        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={trimmed === ''}
          onClick={() => {
            onSubmit(trimmed);
            onClose();
          }}
        >
          {folder === undefined ? t('routines.folderCreate') : t('routines.folderSave')}
        </Button>
      </div>
    </Sheet>
  );
}
