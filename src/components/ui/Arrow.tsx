/** The arrow drawn after a way on: one stroke and its head. Decorative. */
export function Arrow({ className = 'arrow' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M2.5 12h18M14.5 5.5 21 12l-6.5 6.5" />
    </svg>
  );
}
