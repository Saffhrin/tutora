import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, FileText, Image as ImageIcon, PlayCircle, Presentation, Upload, Wand2 } from 'lucide-react';
import { api, locationLabel, type Source, type Unit } from '../api';

const KIND_ICON: Record<string, typeof FileText> = {
  pdf: FileText, slides: Presentation, video: PlayCircle, audio: PlayCircle, image: ImageIcon, text: FileText,
};

export default function Library({ onChanged }: { onChanged: () => void }) {
  const [sources, setSources] = useState<Source[]>([]);
  const [detail, setDetail] = useState<{ source: Source; units: Unit[] } | null>(null);
  const [params, setParams] = useSearchParams();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteText, setPasteText] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const focusRef = useRef<HTMLLIElement>(null);
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement>(null);

  const selectedId = params.get('source');
  const focusedUnit = params.get('unit');

  const load = () => api<Source[]>('/sources').then(setSources).catch((e) => setError(e.message));

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    api<{ source: Source; units: Unit[] }>(`/sources/${selectedId}`)
      .then(setDetail)
      .catch((e) => setError(e.message));
  }, [selectedId]);

  useEffect(() => {
    if (focusedUnit && focusRef.current) {
      focusRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    const location = detail?.units.find((unit) => unit.id === focusedUnit)?.location;
    if (mediaRef.current && location?.timestamp_seconds != null) {
      mediaRef.current.currentTime = location.timestamp_seconds;
      mediaRef.current.play().catch(() => undefined);
    }
  }, [detail, focusedUnit]);

  const upload = async (file: File) => {
    setBusy(true);
    setError('');
    setNotice('');
    const body = new FormData();
    body.append('file', file);
    try {
      const created = await api<Source>('/sources/upload', { method: 'POST', body });
      if (created.status === 'failed') {
        setError(created.error || 'Extraction failed.');
      } else {
        setNotice(`Extracted ${created.unit_count} grounded units from ${created.title}.`);
        setParams({ source: created.id });
      }
      await load();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const savePaste = async () => {
    setBusy(true);
    setError('');
    try {
      const created = await api<Source>('/sources/text', {
        method: 'POST', body: JSON.stringify({ title: pasteTitle || 'Pasted notes', text: pasteText }),
      });
      setNotice(`Added “${created.title}” with ${created.unit_count} units.`);
      setPasteOpen(false);
      setPasteText('');
      setPasteTitle('');
      setParams({ source: created.id });
      await load();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const focused = useMemo(
    () => detail?.units.find((unit) => unit.id === focusedUnit) ?? null,
    [detail, focusedUnit],
  );

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Multimodal knowledge base</p>
          <h1>Library</h1>
          <p className="lede">
            Drop in lecture videos, PDFs, slide decks, figures or pasted notes. Every unit keeps its
            exact origin — page, slide number or video timestamp.
          </p>
        </div>
        <div className="head-actions">
          <input
            ref={fileInput}
            type="file"
            hidden
            onChange={(event) => event.target.files?.[0] && upload(event.target.files[0])}
            accept=".txt,.md,.pdf,.pptx,.png,.jpg,.jpeg,.webp,.mp3,.wav,.m4a,.aac,.ogg,.flac,.mp4,.mov,.webm,.mpeg,.mpg"
          />
          <button className="primary" disabled={busy} onClick={() => fileInput.current?.click()}>
            <Upload size={16} /> {busy ? 'Extracting…' : 'Upload material'}
          </button>
          <button className="ghost" onClick={() => setPasteOpen((open) => !open)}>
            <Wand2 size={16} /> Paste notes
          </button>
        </div>
      </header>

      {notice && <div className="banner good">{notice}</div>}
      {error && <div className="banner warn"><AlertTriangle size={14} /> {error}</div>}

      {pasteOpen && (
        <section className="card">
          <h2>Paste text</h2>
          <input placeholder="Title" value={pasteTitle} onChange={(e) => setPasteTitle(e.target.value)} />
          <textarea
            rows={6}
            placeholder="Paste lecture notes. Separate paragraphs with a blank line — each paragraph becomes a citable unit."
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
          />
          <button className="primary" disabled={busy || pasteText.trim().length < 20} onClick={savePaste}>
            Save to library
          </button>
        </section>
      )}

      <div className="library">
        <section className="card">
          <h2>Sources ({sources.length})</h2>
          <ul className="source-list">
            {sources.map((source) => {
              const Icon = KIND_ICON[source.kind] ?? FileText;
              return (
                <li key={source.id}>
                  <button
                    className={source.id === selectedId ? 'source active' : 'source'}
                    onClick={() => setParams({ source: source.id })}
                  >
                    <Icon size={16} />
                    <span>
                      <strong>{source.title}</strong>
                      <small>
                        {source.kind} · {source.unit_count} units
                        {source.status === 'failed' && ' · failed'}
                      </small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card viewer">
          {!detail && <p className="muted">Select a source to inspect its extracted units and original file.</p>}
          {detail && (
            <>
              <h2>{detail.source.title}</h2>
              <p className="muted small">
                {detail.source.kind} · {detail.units.length} units · created {new Date(detail.source.created_at).toLocaleString()}
              </p>
              {detail.source.status === 'failed' && (
                <div className="banner warn">{detail.source.error}</div>
              )}
              <OriginalPane source={detail.source} focus={focused} mediaRef={mediaRef} />
              <h3>Extracted units</h3>
              <ul className="unit-list">
                {detail.units.map((unit) => (
                  <li
                    key={unit.id}
                    ref={unit.id === focusedUnit ? focusRef : undefined}
                    className={unit.id === focusedUnit ? 'unit focused' : 'unit'}
                  >
                    <div className="unit-head">
                      <b>{unit.location.label ?? locationLabel(unit.location)}</b>
                      <span className="chip">{unit.topic_name ?? 'untagged'}</span>
                      {unit.visual_description && <span className="chip alt">figure described</span>}
                    </div>
                    <p>{unit.text.length > 420 ? `${unit.text.slice(0, 420)}…` : unit.text}</p>
                    {unit.visual_description && <p className="muted small">Visual: {unit.visual_description}</p>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function OriginalPane({
  source, focus, mediaRef,
}: {
  source: Source;
  focus: Unit | null;
  mediaRef: React.MutableRefObject<HTMLVideoElement | HTMLAudioElement | null>;
}) {
  const file = `/api/sources/${source.id}/file`;
  const timestamp = focus?.location?.timestamp_seconds;
  if (source.kind === 'pdf') {
    const page = focus?.location?.page ? `#page=${focus.location.page}` : '';
    return (
      <div className="original">
        <div className="unit-head"><b>Original PDF</b><a href={`${file}${page}`} target="_blank" rel="noreferrer">open in new tab</a></div>
        <iframe title={source.title} src={`${file}${page}`} />
      </div>
    );
  }
  if (source.kind === 'video' || source.kind === 'audio') {
    const src = `${file}${timestamp != null ? `#t=${Math.floor(timestamp)}` : ''}`;
    return (
      <div className="original">
        <div className="unit-head">
          <b>{source.kind === 'video' ? 'Lecture recording' : 'Audio brief'}</b>
          {timestamp != null && <span className="chip">jump to {locationLabel({ timestamp_seconds: timestamp })}</span>}
        </div>
        {source.kind === 'video' ? (
          <video ref={mediaRef as React.RefObject<HTMLVideoElement>} controls src={src} />
        ) : (
          <audio ref={mediaRef as React.RefObject<HTMLAudioElement>} controls src={src} />
        )}
      </div>
    );
  }
  if (source.kind === 'slides' || source.kind === 'image') {
    return (
      <div className="original">
        <div className="unit-head">
          <b>{source.kind === 'slides' ? 'Original slide deck' : 'Original figure'}</b>
          <a href={file} target="_blank" rel="noreferrer">open original</a>
        </div>
        <p className="muted small">
          Extracted text for the focused unit is highlighted below — the viewer always shows the exact
          slide or figure description that a citation points to.
        </p>
      </div>
    );
  }
  return null;
}