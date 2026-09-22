import { useNavigate } from 'react-router-dom';
import { copy } from '../content/nl';

export function goBackOnePage(navigate: ReturnType<typeof useNavigate>, fallback = '/'): void {
  if (typeof window !== 'undefined' && window.history.length > 1) {
    void navigate(-1);
    return;
  }
  void navigate(fallback);
}

export function BackButton({ fallback = '/' }: { fallback?: string }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className="btn btn-secondary"
      data-testid="btn-back"
      onClick={() => goBackOnePage(navigate, fallback)}
    >
      {copy.back}
    </button>
  );
}
