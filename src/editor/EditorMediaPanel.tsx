import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog } from '../components/Dialog';
import { publicResourceUrl } from '../media/logopedie/resolveAvatar';
import {
  applyStagedMedia,
  isErikBasisPath,
  isLogopedieMediaPath,
  listLogopedieMedia,
  mediaRowTestId,
  type LogopedieMediaItem,
  type StagedMediaOp,
} from './logopedieMedia';

interface EditorMediaPanelProps {
  staged: StagedMediaOp[];
  onStage: (op: StagedMediaOp) => void;
  previewPath: string | null;
}

export function EditorMediaPanel({ staged, onStage, previewPath }: EditorMediaPanelProps) {
  const addInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<LogopedieMediaItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [pendingReplace, setPendingReplace] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [pendingBasis, setPendingBasis] = useState<string | null>(null);

  useEffect(() => {
    if (import.meta.env.MODE === 'test') {
      return;
    }
    let cancelled = false;
    void listLogopedieMedia()
      .then((list) => {
        if (!cancelled) {
          setItems(list);
          setLoadError(null);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Media kon niet worden geladen.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const listed = useMemo(() => applyStagedMedia(items, staged), [items, staged]);
  const selected =
    listed.find((item) => item.relativePath === selectedPath) ??
    listed.find((item) => item.relativePath === previewPath) ??
    listed[0];
  const previewSrc =
    selected?.previewUrl ?? (selected ? publicResourceUrl(selected.relativePath) : null);

  function stageAdd(file: File | undefined) {
    if (!file) {
      return;
    }
    const relativePath = `logopedie/avatar/${file.name}`;
    if (!isLogopedieMediaPath(relativePath)) {
      setLoadError('Alleen afbeeldingen in resources/logopedie/ zijn toegestaan.');
      return;
    }
    if (isErikBasisPath(relativePath)) {
      setLoadError('erik_basis.png kun je alleen vervangen via Vervangen.');
      return;
    }
    const exists = listed.some((item) => item.relativePath === relativePath);
    onStage({
      type: exists ? 'replace' : 'add',
      relativePath,
      file,
      previewUrl: URL.createObjectURL(file),
      replaceBasis: false,
    });
    setSelectedPath(relativePath);
  }

  function stageReplace(relativePath: string, file: File | undefined, replaceBasis: boolean) {
    if (!file) {
      return;
    }
    if (!isLogopedieMediaPath(relativePath)) {
      setLoadError('Alleen afbeeldingen in resources/logopedie/ zijn toegestaan.');
      return;
    }
    onStage({
      type: 'replace',
      relativePath,
      file,
      previewUrl: URL.createObjectURL(file),
      replaceBasis,
    });
    setSelectedPath(relativePath);
  }

  return (
    <section className="editor-media" data-testid="editor-media">
      <div className="editor-media-head">
        <h2>Logopedie-media</h2>
        <button
          type="button"
          className="btn btn-secondary"
          data-testid="btn-media-add"
          onClick={() => addInputRef.current?.click()}
        >
          Toevoegen
        </button>
        <input
          ref={addInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/avif,.png,.jpg,.jpeg,.webp,.avif"
          className="visually-hidden"
          data-testid="input-media-add"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            stageAdd(file);
          }}
        />
        <input
          ref={replaceInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/avif,.png,.jpg,.jpeg,.webp,.avif"
          className="visually-hidden"
          data-testid="input-media-replace"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (pendingReplace) {
              stageReplace(pendingReplace, file, pendingReplace === pendingBasis);
            }
            setPendingReplace(null);
            setPendingBasis(null);
          }}
        />
      </div>
      <p className="muted">
        Alleen bestanden onder resources/logopedie/. Verpleegkunde-video’s blijven ongewijzigd.
        erik_basis.png wordt niet overschreven tenzij je expres Vervangen kiest.
      </p>
      {loadError ? (
        <p className="editor-open-error" data-testid="editor-media-error" role="alert">
          {loadError}
        </p>
      ) : null}
      <div className="editor-media-layout">
        <ul className="editor-media-list" data-testid="editor-media-list">
          {listed.map((item) => (
            <li key={item.relativePath}>
              <button
                type="button"
                className={item.relativePath === selected?.relativePath ? 'is-active' : undefined}
                data-testid={mediaRowTestId(item.relativePath)}
                onClick={() => setSelectedPath(item.relativePath)}
              >
                {item.relativePath}
                {item.stagedType ? ` (${item.stagedType})` : ''}
              </button>
            </li>
          ))}
        </ul>
        <div className="editor-media-preview-wrap">
          {selected && previewSrc ? (
            <>
              <div className="editor-media-preview" data-testid="editor-media-preview">
                <img
                  src={previewSrc}
                  alt={selected.relativePath}
                  className="editor-media-preview-img"
                  data-testid="editor-media-preview-image"
                />
              </div>
              <div className="editor-media-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  data-testid="btn-media-replace"
                  onClick={() => {
                    if (isErikBasisPath(selected.relativePath)) {
                      setPendingBasis(selected.relativePath);
                      return;
                    }
                    setPendingReplace(selected.relativePath);
                    replaceInputRef.current?.click();
                  }}
                >
                  Vervangen
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  data-testid="btn-media-delete"
                  onClick={() => setPendingDelete(selected.relativePath)}
                >
                  Verwijderen
                </button>
              </div>
            </>
          ) : (
            <p className="muted">Geen Logopedie-afbeelding geselecteerd.</p>
          )}
        </div>
      </div>

      {pendingBasis ? (
        <Dialog
          title="erik_basis.png vervangen?"
          testId="dialog-replace-basis"
          onClose={() => setPendingBasis(null)}
        >
          <p>
            Dit overschrijft erik_basis.png. Er wordt eerst een .bak van het huidige bestand
            gemaakt.
          </p>
          <div className="stack" style={{ marginTop: 24 }}>
            <button
              type="button"
              className="btn"
              data-testid="btn-confirm-replace-basis"
              onClick={() => {
                setPendingReplace(pendingBasis);
                replaceInputRef.current?.click();
              }}
            >
              Vervangen
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setPendingBasis(null)}
            >
              Annuleren
            </button>
          </div>
        </Dialog>
      ) : null}

      {pendingDelete ? (
        <Dialog
          title="Afbeelding verwijderen?"
          testId="dialog-delete-media"
          onClose={() => setPendingDelete(null)}
        >
          <p>
            Verwijder {pendingDelete}? Dit geldt pas na Opslaan en blijft binnen
            resources/logopedie/.
          </p>
          <div className="stack" style={{ marginTop: 24 }}>
            <button
              type="button"
              className="btn btn-danger"
              data-testid="btn-confirm-delete-media"
              onClick={() => {
                onStage({ type: 'delete', relativePath: pendingDelete });
                setPendingDelete(null);
              }}
            >
              Verwijderen
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              data-testid="btn-cancel-delete-media"
              onClick={() => setPendingDelete(null)}
            >
              Annuleren
            </button>
          </div>
        </Dialog>
      ) : null}
    </section>
  );
}
