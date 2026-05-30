import { useEffect, useRef } from 'react';
import type { Person } from '../../types';
import { renderTemplate, type BlobUrls } from '../../lib/template/render';

interface CardProps {
  person: Person;
  urls: BlobUrls;
  html: string;
  className?: string;
}

export function Card({ person, urls, html, className }: CardProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<ShadowRoot | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    if (!shadowRef.current) {
      shadowRef.current = hostRef.current.attachShadow({ mode: 'open' });
    }
    const rendered = html
      ? renderTemplate(html, person, urls)
      : '<div style="padding:12px;color:#94a3b8;font-family:sans-serif;font-size:11px;">Aucun template</div>';
    shadowRef.current.innerHTML = rendered;
  }, [html, person, urls]);

  return <div ref={hostRef} className={className} />;
}
