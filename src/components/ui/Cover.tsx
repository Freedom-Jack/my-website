import type { CSSProperties } from 'react';

/**
 * A scene cut from the painting, at the head of a leaf (styles/leaves.css .cover): the place's own still, shown
 * close. `scene` names the still (public/scenes/band/<scene>-wide-a, the file the band fetches on that place's
 * page; a phone takes its phone cut); `x` is where along it to look (0 west to 100 east), `zoom` how close (the
 * still's width against the leaf's, in per cent). Decorative.
 */
export function Cover({
  scene,
  x = 50,
  y,
  zoom,
  ratio,
  className,
}: {
  scene: 'home' | 'work' | 'case' | 'writing' | 'article' | 'resume' | 'contact';
  x?: number;
  y?: number;
  zoom?: number;
  ratio?: string;
  className?: string;
}) {
  const at = (f: string) => `url("/scenes/band/${scene}-${f}.webp")`;
  return (
    <div
      className={className ? `cover ${className}` : 'cover'}
      aria-hidden="true"
      style={
        {
          '--cover-1x': at('wide-a@1x'),
          '--cover-2x': at('wide-a@2x'),
          '--cover-phone': at('phone-a'),
          '--cover-x': `${x}%`,
          ...(y !== undefined ? { '--cover-y': `${y}%` } : {}),
          ...(zoom !== undefined ? { '--cover-zoom': `${zoom}%` } : {}),
          ...(ratio ? { '--cover-ratio': ratio } : {}),
        } as CSSProperties
      }
    />
  );
}
