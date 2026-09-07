'use client';

import { useEffect, useRef, useState } from 'react';
import type { Task } from '@/lib/types';

type Props = {
  task: Task;
  onClose: () => void;
  onSave: (text: string) => void;
  onDelete: () => void;
};

/**
 * What the long press opens. Edit and delete live here rather than as chrome
 * on every line, so the list stays loose lines on open paper.
 *
 * Delete is immediate and has no confirm dialog: a browser confirm() blocks
 * everything, and a task is cheap to retype. The destructive ink is the
 * warning.
 */
export default function ActionSheet({ task, onClose, onSave, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.text);
  const inputRef = useRef<HTMLInputElement>(null);
  const firstRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
    else firstRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = () => {
    const text = draft.trim();
    if (!text || text === task.text) {
      onClose();
      return;
    }
    onSave(text);
  };

  return (
    <div
      className="scrim"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Task actions">
        {editing ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
          >
            <input
              ref={inputRef}
              className="editInput"
              value={draft}
              maxLength={500}
              onChange={(event) => setDraft(event.target.value)}
              aria-label="Task text"
            />
            <div className="sheetActions">
              <button type="submit" className="sheetBtn">
                Save
              </button>
              <button type="button" className="sheetBtn" onClick={onClose}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="sheetTitle">{task.text}</div>
            <button
              ref={firstRef}
              type="button"
              className="actionRow"
              onClick={() => setEditing(true)}
            >
              Edit
            </button>
            <button type="button" className="actionRow destructive" onClick={onDelete}>
              Delete
            </button>
            <div className="sheetActions" style={{ marginTop: 14 }}>
              <button type="button" className="sheetBtn" onClick={onClose}>
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
