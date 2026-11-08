import useOwner from '../hooks/useOwner';

export default function Loading() {
  const { copy } = useOwner();
  return (
    <div className="loading" role="status">
      <span className="loading-dots" aria-hidden="true">
        <span className="loading-dot" />
        <span className="loading-dot" />
        <span className="loading-dot" />
      </span>
      <span className="loading-label">{copy.loading}…</span>
    </div>
  );
}
