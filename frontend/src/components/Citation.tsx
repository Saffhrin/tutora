import { FileText, Image as ImageIcon, PlayCircle, Presentation } from 'lucide-react';
import { Link } from 'react-router-dom';
import { locationLabel, sourceLink, type Citation as CitationType } from '../api';

const ICONS: Record<string, typeof FileText> = {
  pdf: FileText, slides: Presentation, video: PlayCircle, image: ImageIcon, audio: PlayCircle,
};

export default function Citation({ citation, kind = 'pdf' }: { citation: CitationType; kind?: string }) {
  const Icon = ICONS[kind] ?? FileText;
  return (
    <Link className="citation" to={sourceLink(citation)}>
      <div className="citation-head">
        <Icon size={14} />
        <span>{citation.source_title}</span>
        <b>{citation.location_label ?? locationLabel(citation.location)}</b>
      </div>
      <blockquote>{citation.excerpt.length > 240 ? `${citation.excerpt.slice(0, 240)}…` : citation.excerpt}</blockquote>
      <span className="citation-open">Open exact source →</span>
    </Link>
  );
}