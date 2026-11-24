'use client';

export type ImageSource = 'detail' | 'sentinel' | 'archive';
export type SourceAvailability=Partial<Record<ImageSource,{disabled:boolean;reason:string;hidden?:boolean}>>;
export function ImageryChoice({
  value,
  onChange,
  detailLabel = 'Esri',
  availability,
  archiveLabel='INEGI',
}: {
  value: ImageSource;
  onChange: (source: ImageSource) => void;
  detailLabel?: string;
  availability?:SourceAvailability;
  archiveLabel?:string;
}) {
  return (
    <fieldset className="imagery-choice" aria-label="Fuente de imágenes">
      {!availability?.detail?.hidden&&<button
        aria-pressed={value === 'detail'}
        disabled={availability?.detail?.disabled} title={availability?.detail?.reason}
        onClick={() => onChange('detail')}
      >
        {detailLabel}
      </button>}
      {!availability?.sentinel?.hidden&&<button
        aria-pressed={value === 'sentinel'}
        disabled={availability?.sentinel?.disabled} title={availability?.sentinel?.reason}
        onClick={() => onChange('sentinel')}
      >
        Sentinel
      </button>}
      {!availability?.archive?.hidden&&<button aria-pressed={value === 'archive'} disabled={availability?.archive?.disabled} title={availability?.archive?.reason} onClick={() => onChange('archive')}>
        {archiveLabel}
      </button>}
    </fieldset>
  );
}
