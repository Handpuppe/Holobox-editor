import { useNavigate } from 'react-router-dom';
import { Screen } from '../components/Screen';
import { copy } from '../content/nl';

interface ErrorScreenProps {
  message?: string;
  issues?: string[];
}

export function ErrorScreen({ message, issues }: ErrorScreenProps) {
  const navigate = useNavigate();
  return (
    <Screen
      title={copy.errorTitle}
      testId="screen-error"
      footer={
        <button
          type="button"
          className="btn"
          data-testid="btn-error-home"
          onClick={() => void navigate('/')}
        >
          {copy.home}
        </button>
      }
    >
      <p className="lead">{message ?? copy.errorUnknownRoute}</p>
      {issues && issues.length > 0 ? (
        <ul className="list" data-testid="error-issues">
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      ) : null}
      <p className="notice">{copy.educationalNotice}</p>
    </Screen>
  );
}
