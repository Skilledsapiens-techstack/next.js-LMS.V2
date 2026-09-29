import { useQuery } from '@tanstack/react-query';
import { BookOpen, MessageCircle, Sparkles } from 'lucide-react';
import { useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { StateBlock } from '../components/StateBlock';
import type { PaginatedResponse } from '../features/student/useStudentAnnouncements';
import type { StudentCohort } from '../features/student/useStudentCohorts';
import type { StudentProfile } from '../features/student/useStudentDashboard';
import { apiGet, ApiClientError } from '../lib/supabaseApi';

function hasLegacyLearningAccess(student?: StudentProfile) {
  return Boolean(student?.cohortName?.trim() || student?.programName?.trim());
}

export function StudentLearningAccessPage() {
  const { accessToken, status } = useAuth();
  const profileQuery = useQuery({
    enabled: status === 'authenticated' && Boolean(accessToken),
    queryFn: () => apiGet<StudentProfile>('/students/me', { accessToken: accessToken ?? undefined }),
    queryKey: ['learning-access-student-profile', accessToken],
    retry: false,
    staleTime: 60_000
  });
  const cohortsQuery = useQuery({
    enabled: profileQuery.isSuccess && Boolean(accessToken) && !hasLegacyLearningAccess(profileQuery.data),
    queryFn: () =>
      apiGet<PaginatedResponse<StudentCohort>>('/students/me/cohorts', {
        accessToken: accessToken ?? undefined,
        query: {
          limit: 1,
          page: 1,
          status: 'all'
        }
      }),
    queryKey: ['learning-access-student-cohorts', accessToken],
    retry: false,
    staleTime: 60_000
  });

  useEffect(() => {
    document.title = 'My Learning Access | Skilled Sapiens';
  }, []);

  if (status === 'configuration-missing') {
    return (
      <main className="auth-page">
        <section className="auth-panel learning-access-panel">
          <h1>Learning access unavailable</h1>
          <StateBlock title="Portal configuration missing" tone="warning">
            LMS sign-in is not configured for this environment yet.
          </StateBlock>
        </section>
      </main>
    );
  }

  if (status === 'loading') {
    return (
      <main className="auth-page">
        <section className="auth-panel learning-access-panel">
          <h1>Checking My Learning access.</h1>
          <StateBlock title="Checking secure session">Validating your Skilled Sapiens LMS session.</StateBlock>
        </section>
      </main>
    );
  }

  if (status === 'unauthenticated' || !accessToken) {
    return <Navigate replace to={`/login?portal=student&redirect=${encodeURIComponent('/learning-access')}`} />;
  }

  if (profileQuery.isLoading || (profileQuery.isSuccess && !hasLegacyLearningAccess(profileQuery.data) && cohortsQuery.isLoading)) {
    return (
      <main className="auth-page">
        <section className="auth-panel learning-access-panel">
          <span className="section-eyebrow">Skilled Sapiens LMS</span>
          <h1>Checking your paid learning access.</h1>
          <StateBlock title="One moment">We are checking whether this email has an active LMS learning profile.</StateBlock>
        </section>
      </main>
    );
  }

  if (hasLegacyLearningAccess(profileQuery.data) || (cohortsQuery.data?.total ?? cohortsQuery.data?.items.length ?? 0) > 0) {
    return <Navigate replace to="/student" />;
  }

  if (
    profileQuery.error instanceof ApiClientError &&
    (profileQuery.error.status === 404 || profileQuery.error.status === 403)
  ) {
    return <NoPaidLearningAccess />;
  }

  if (profileQuery.isError || cohortsQuery.isError) {
    return (
      <main className="auth-page">
        <section className="auth-panel learning-access-panel">
          <span className="section-eyebrow">Skilled Sapiens LMS</span>
          <h1>Learning access could not be checked.</h1>
          <StateBlock title="Try again" tone="warning">
            Your session is active, but the LMS access check could not complete. Refresh this page or contact support if it continues.
          </StateBlock>
          <div className="learning-access-actions">
            <button className="button-link" onClick={() => window.location.reload()} type="button">
              Refresh access check
            </button>
            <Link className="button-link button-link--ghost" to="/pulse/home">
              Back to Pulse
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return <NoPaidLearningAccess />;
}

function NoPaidLearningAccess() {
  return (
    <main className="auth-page">
      <section className="auth-panel learning-access-panel">
        <span className="section-eyebrow">Skilled Sapiens LMS</span>
        <h1>You do not have paid LMS access yet.</h1>
        <p className="learning-access-lede">
          Pulse is your student community space. The Skilled Sapiens paid learning portal is available only for learners
          enrolled in an active LMS cohort or program.
        </p>
        <div className="learning-access-list">
          <span><Sparkles size={18} /> Continue using Pulse for community, posts, referrals, and opportunities.</span>
          <span><BookOpen size={18} /> My Learning opens after your email is added to an LMS cohort.</span>
          <span><MessageCircle size={18} /> Contact the program team if you believe you should already have access.</span>
        </div>
        <div className="learning-access-actions">
          <Link className="button-link" to="/pulse/home">
            Back to Pulse
          </Link>
        </div>
      </section>
    </main>
  );
}
