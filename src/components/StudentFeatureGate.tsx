import { Clock3, ShieldCheck } from 'lucide-react';
import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { LoadingState } from './ScreenStates';
import { StatusBadge } from './StatusBadge';
import { getFeatureMessage, useStudentFeatureControls } from '../features/useFeatureControls';

type StudentFeatureGateProps = {
  children: ReactNode;
  moduleId: string;
};

export function StudentFeatureGate({ children, moduleId }: StudentFeatureGateProps) {
  const controlsQuery = useStudentFeatureControls();

  if (moduleId === 'dashboard') return <>{children}</>;
  if (controlsQuery.isLoading) return <LoadingState />;
  if (controlsQuery.isError) return <>{children}</>;

  const feature = controlsQuery.data?.items.find((item) => item.moduleId === moduleId);
  if (!feature || feature.status === 'show') return <>{children}</>;
  if (feature.status === 'hide') return <Navigate to="/student" replace />;

  return (
    <section className="feature-upcoming-page" aria-label={`${feature.studentLabel} upcoming`}>
      <div className="feature-upcoming-page__mark">
        <Clock3 size={28} />
      </div>
      <span className="eyebrow">Coming soon</span>
      <h1>{feature.studentLabel}</h1>
      <p>{getFeatureMessage(feature)}</p>
      <div className="feature-upcoming-page__status">
        <StatusBadge tone="warning">Upcoming</StatusBadge>
        <span>This module is controlled by LMS Feature Control.</span>
      </div>
      <div className="feature-upcoming-page__note">
        <ShieldCheck size={16} />
        <span>Your account remains protected. Visible modules continue to work normally.</span>
      </div>
    </section>
  );
}
