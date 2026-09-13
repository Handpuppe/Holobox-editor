import { useState } from 'react';
import { Dialog } from '../components/Dialog';
import { copy } from '../content/nl';
import { NOTE_FIELDS, sanitizeNotes } from '../domain/notes';
import { NOTES_MAX_LENGTH, type StudentNotes } from '../domain/types';

interface NotesPanelProps {
  notes: StudentNotes;
  onSave: (notes: StudentNotes) => void;
  onClose: () => void;
}

export function NotesPanel({ notes, onSave, onClose }: NotesPanelProps) {
  const [draft, setDraft] = useState(notes);

  return (
    <Dialog title={copy.notesTitle} testId="dialog-notes" onClose={onClose}>
      <p className="muted">{copy.notesLimit}</p>
      <form
        className="stack-lg"
        style={{ marginTop: 16 }}
        onSubmit={(event) => {
          event.preventDefault();
          onSave(sanitizeNotes(draft));
          onClose();
        }}
      >
        {NOTE_FIELDS.map((field) => (
          <div className="field" key={field.id}>
            <label htmlFor={`note-${field.id}`}>{field.label}</label>
            <p className="muted" id={`hint-${field.id}`}>
              {field.hint}
            </p>
            <textarea
              id={`note-${field.id}`}
              data-testid={`note-${field.id}`}
              aria-describedby={`hint-${field.id}`}
              maxLength={NOTES_MAX_LENGTH}
              value={draft[field.id]}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  [field.id]: event.target.value.slice(0, NOTES_MAX_LENGTH),
                }))
              }
            />
          </div>
        ))}
        <div className="stack">
          <button type="submit" className="btn" data-testid="btn-save-notes">
            {copy.saveNotes}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {copy.close}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
