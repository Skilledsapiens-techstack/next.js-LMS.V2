import { lazy, Suspense, useEffect } from 'react';
import { createBrowserRouter, isRouteErrorResponse, Navigate, useLocation, useRouteError } from 'react-router-dom';
import { webEnv } from '../../../src/config/env';

const PulseAppLayout = lazy(() => import('../../../src/pulse/layouts/PulseAppLayout').then((module) => ({ default: module.PulseAppLayout })));
const PulsePublicLayout = lazy(() => import('../../../src/pulse/layouts/PulsePublicLayout').then((module) => ({ default: module.PulsePublicLayout })));
const PulseAccessRequestPage = lazy(() => import('../../../src/pulse/pages/PulseAccessRequestPage').then((module) => ({ default: module.PulseAccessRequestPage })));
const PulseHomePage = lazy(() => import('../../../src/pulse/pages/PulseHomePage').then((module) => ({ default: module.PulseHomePage })));
const PulseInvitePage = lazy(() => import('../../../src/pulse/pages/PulseInvitePage').then((module) => ({ default: module.PulseInvitePage })));
const PulseInviteLandingPage = lazy(() => import('../../../src/pulse/pages/PulseInviteLandingPage').then((module) => ({ default: module.PulseInviteLandingPage })));
const PulseLandingPage = lazy(() => import('../../../src/pulse/pages/PulseLandingPage').then((module) => ({ default: module.PulseLandingPage })));
const PulseLoginPage = lazy(() => import('../../../src/pulse/pages/PulseLoginPage').then((module) => ({ default: module.PulseLoginPage })));
const PulseActivityPage = lazy(() => import('../../../src/pulse/pages/PulseActivityPage').then((module) => ({ default: module.PulseActivityPage })));
const PulseCareerReadinessDetailPage = lazy(() => import('../../../src/pulse/pages/PulseCareerReadinessPage').then((module) => ({ default: module.PulseCareerReadinessDetailPage })));
const PulseCareerReadinessPage = lazy(() => import('../../../src/pulse/pages/PulseCareerReadinessPage').then((module) => ({ default: module.PulseCareerReadinessPage })));
const PulseClubDetailPage = lazy(() => import('../../../src/pulse/pages/PulseClubsPage').then((module) => ({ default: module.PulseClubDetailPage })));
const PulseClubsPage = lazy(() => import('../../../src/pulse/pages/PulseClubsPage').then((module) => ({ default: module.PulseClubsPage })));
const PulseBecomeMentorPage = lazy(() => import('../../../src/pulse/pages/PulseMentorshipPage').then((module) => ({ default: module.PulseBecomeMentorPage })));
const PulseMentorshipDetailPage = lazy(() => import('../../../src/pulse/pages/PulseMentorshipPage').then((module) => ({ default: module.PulseMentorshipDetailPage })));
const PulseMentorshipPage = lazy(() => import('../../../src/pulse/pages/PulseMentorshipPage').then((module) => ({ default: module.PulseMentorshipPage })));
const PulseNotificationsPage = lazy(() => import('../../../src/pulse/pages/PulseNotificationsPage').then((module) => ({ default: module.PulseNotificationsPage })));
const PulseOpportunityDetailPage = lazy(() => import('../../../src/pulse/pages/PulseOpportunityDetailPage').then((module) => ({ default: module.PulseOpportunityDetailPage })));
const PulseOpportunitiesPage = lazy(() => import('../../../src/pulse/pages/PulseOpportunitiesPage').then((module) => ({ default: module.PulseOpportunitiesPage })));
const PulsePeoplePage = lazy(() => import('../../../src/pulse/pages/PulsePeoplePage').then((module) => ({ default: module.PulsePeoplePage })));
const PulseProfileDetailPage = lazy(() => import('../../../src/pulse/pages/PulseProfileDetailPage').then((module) => ({ default: module.PulseProfileDetailPage })));
const PulseProfilePage = lazy(() => import('../../../src/pulse/pages/PulseProfilePage').then((module) => ({ default: module.PulseProfilePage })));
const PulseResourceLibraryPage = lazy(() => import('../../../src/pulse/pages/PulseResourceLibraryPage').then((module) => ({ default: module.PulseResourceLibraryPage })));
const PulseSearchPage = lazy(() => import('../../../src/pulse/pages/PulseSearchPage').then((module) => ({ default: module.PulseSearchPage })));
const PulseStarsPage = lazy(() => import('../../../src/pulse/pages/PulseStarsPage').then((module) => ({ default: module.PulseStarsPage })));
const defaultLmsAppUrl = 'https://login.skilledsapiens.com';

function resolveLmsAppUrl() {
  const isLocalPulse = ['127.0.0.1', 'localhost'].includes(window.location.hostname) && window.location.port === '5174';
  if (isLocalPulse && webEnv.lmsAppUrl === defaultLmsAppUrl) {
    return `${window.location.protocol}//${window.location.hostname}:5173`;
  }

  return webEnv.lmsAppUrl || defaultLmsAppUrl;
}

function PageLoader({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <main className="pulse-site">
          <section className="pulse-auth-required">
            <h1>Opening Pulse.</h1>
            <p>Loading your campus community.</p>
          </section>
        </main>
      }
    >
      {children}
    </Suspense>
  );
}

function PulseRouteErrorFallback() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? error.statusText
    : error instanceof Error
      ? error.message
      : 'This Pulse page could not be loaded.';

  return (
    <main className="pulse-site">
      <section className="pulse-auth-required">
        <h1>Pulse could not load.</h1>
        <p>{message}</p>
        <button className="pulse-button pulse-button--primary" onClick={() => window.location.reload()} type="button">
          <span>Refresh Pulse</span>
        </button>
      </section>
    </main>
  );
}

function PulseLegacyLoginRedirect() {
  const location = useLocation();
  const isRecoveryRoute = new URLSearchParams(location.search).get('mode') === 'recovery';

  useEffect(() => {
    if (!isRecoveryRoute) return;
    const lmsAppUrl = resolveLmsAppUrl().replace(/\/$/, '');
    window.location.replace(`${lmsAppUrl}/login${location.search}`);
  }, [isRecoveryRoute, location.search]);

  if (isRecoveryRoute) {
    return (
      <section className="pulse-auth-required">
        <h1>Opening password reset.</h1>
        <p>Taking you to the Skilled Sapiens LMS login page to update your password.</p>
      </section>
    );
  }

  return <PulseLoginPage />;
}

export const pulseRouter = createBrowserRouter([
  {
    path: '/',
    element: (
      <PageLoader>
        <PulsePublicLayout />
      </PageLoader>
    ),
    errorElement: <PulseRouteErrorFallback />,
    children: [{ index: true, element: <PulseLandingPage /> }]
  },
  {
    path: '/pulse',
    element: (
      <PageLoader>
        <PulsePublicLayout />
      </PageLoader>
    ),
    errorElement: <PulseRouteErrorFallback />,
    children: [{ index: true, element: <PulseLandingPage /> }]
  },
  {
    path: '/pulse/invite/:code',
    element: (
      <PageLoader>
        <PulsePublicLayout />
      </PageLoader>
    ),
    errorElement: <PulseRouteErrorFallback />,
    children: [{ index: true, element: <PulseInviteLandingPage /> }]
  },
  {
    path: '/pulse/access-request',
    element: (
      <PageLoader>
        <PulsePublicLayout />
      </PageLoader>
    ),
    errorElement: <PulseRouteErrorFallback />,
    children: [{ index: true, element: <PulseAccessRequestPage /> }]
  },
  {
    path: '/pulse/access-request/:code',
    element: (
      <PageLoader>
        <PulsePublicLayout />
      </PageLoader>
    ),
    errorElement: <PulseRouteErrorFallback />,
    children: [{ index: true, element: <PulseAccessRequestPage /> }]
  },
  {
    path: '/pulse/login',
    element: (
      <PageLoader>
        <PulsePublicLayout />
      </PageLoader>
    ),
    errorElement: <PulseRouteErrorFallback />,
    children: [{ index: true, element: <PulseLoginPage /> }]
  },
  {
    path: '/login',
    element: (
      <PageLoader>
        <PulsePublicLayout />
      </PageLoader>
    ),
    errorElement: <PulseRouteErrorFallback />,
    children: [{ index: true, element: <PulseLegacyLoginRedirect /> }]
  },
  {
    path: '/pulse/home',
    element: (
      <PageLoader>
        <PulseAppLayout />
      </PageLoader>
    ),
    errorElement: <PulseRouteErrorFallback />,
    children: [{ index: true, element: <PulseHomePage /> }]
  },
  {
    path: '/pulse/activity',
    element: (
      <PageLoader>
        <PulseAppLayout />
      </PageLoader>
    ),
    errorElement: <PulseRouteErrorFallback />,
    children: [{ index: true, element: <PulseActivityPage /> }]
  },
  {
    path: '/pulse/profile',
    element: (
      <PageLoader>
        <PulseAppLayout />
      </PageLoader>
    ),
    errorElement: <PulseRouteErrorFallback />,
    children: [{ index: true, element: <PulseProfilePage /> }]
  },
  {
    path: '/pulse/u/:profileId',
    element: (
      <PageLoader>
        <PulseAppLayout />
      </PageLoader>
    ),
    errorElement: <PulseRouteErrorFallback />,
    children: [{ index: true, element: <PulseProfileDetailPage /> }]
  },
  {
    path: '/pulse/search',
    element: (
      <PageLoader>
        <PulseAppLayout />
      </PageLoader>
    ),
    errorElement: <PulseRouteErrorFallback />,
    children: [{ index: true, element: <PulseSearchPage /> }]
  },
  {
    path: '/pulse/people',
    element: (
      <PageLoader>
        <PulseAppLayout />
      </PageLoader>
    ),
    errorElement: <PulseRouteErrorFallback />,
    children: [{ index: true, element: <PulsePeoplePage /> }]
  },
  {
    path: '/pulse/notifications',
    element: (
      <PageLoader>
        <PulseAppLayout />
      </PageLoader>
    ),
    errorElement: <PulseRouteErrorFallback />,
    children: [{ index: true, element: <PulseNotificationsPage /> }]
  },
  {
    path: '/pulse/clubs',
    element: (
      <PageLoader>
        <PulseAppLayout />
      </PageLoader>
    ),
    errorElement: <PulseRouteErrorFallback />,
    children: [{ index: true, element: <PulseClubsPage /> }]
  },
  {
    path: '/pulse/clubs/:clubKey',
    element: (
      <PageLoader>
        <PulseAppLayout />
      </PageLoader>
    ),
    errorElement: <PulseRouteErrorFallback />,
    children: [{ index: true, element: <PulseClubDetailPage /> }]
  },
  {
    path: '/pulse/my-college',
    element: (
      <PageLoader>
        <PulseAppLayout />
      </PageLoader>
    ),
    errorElement: <PulseRouteErrorFallback />,
    children: [{ index: true, element: <PulseHomePage /> }]
  },
  {
    path: '/pulse/global',
    element: (
      <PageLoader>
        <PulseAppLayout />
      </PageLoader>
    ),
    errorElement: <PulseRouteErrorFallback />,
    children: [{ index: true, element: <PulseHomePage /> }]
  },
  {
    path: '/pulse/opportunities',
    element: (
      <PageLoader>
        <PulseAppLayout />
      </PageLoader>
    ),
    errorElement: <PulseRouteErrorFallback />,
    children: [{ index: true, element: <PulseOpportunitiesPage /> }]
  },
  {
    path: '/pulse/opportunities/:opportunityId',
    element: (
      <PageLoader>
        <PulseAppLayout />
      </PageLoader>
    ),
    errorElement: <PulseRouteErrorFallback />,
    children: [{ index: true, element: <PulseOpportunityDetailPage /> }]
  },
  {
    path: '/pulse/resources',
    element: (
      <PageLoader>
        <PulseAppLayout />
      </PageLoader>
    ),
    errorElement: <PulseRouteErrorFallback />,
    children: [{ index: true, element: <PulseResourceLibraryPage /> }]
  },
  {
    path: '/pulse/career-readiness',
    element: (
      <PageLoader>
        <PulseAppLayout />
      </PageLoader>
    ),
    errorElement: <PulseRouteErrorFallback />,
    children: [{ index: true, element: <PulseCareerReadinessPage /> }]
  },
  {
    path: '/pulse/career-readiness/:contentId',
    element: (
      <PageLoader>
        <PulseAppLayout />
      </PageLoader>
    ),
    errorElement: <PulseRouteErrorFallback />,
    children: [{ index: true, element: <PulseCareerReadinessDetailPage /> }]
  },
  {
    path: '/pulse/mentorship',
    element: (
      <PageLoader>
        <PulseAppLayout />
      </PageLoader>
    ),
    errorElement: <PulseRouteErrorFallback />,
    children: [{ index: true, element: <PulseMentorshipPage /> }]
  },
  {
    path: '/pulse/mentorship/:sessionId',
    element: (
      <PageLoader>
        <PulseAppLayout />
      </PageLoader>
    ),
    errorElement: <PulseRouteErrorFallback />,
    children: [{ index: true, element: <PulseMentorshipDetailPage /> }]
  },
  {
    path: '/pulse/mentorship/become',
    element: (
      <PageLoader>
        <PulseAppLayout />
      </PageLoader>
    ),
    errorElement: <PulseRouteErrorFallback />,
    children: [{ index: true, element: <PulseBecomeMentorPage /> }]
  },
  {
    path: '/pulse/stars',
    element: (
      <PageLoader>
        <PulseAppLayout />
      </PageLoader>
    ),
    errorElement: <PulseRouteErrorFallback />,
    children: [{ index: true, element: <PulseStarsPage /> }]
  },
  {
    path: '/pulse/recognition',
    element: (
      <PageLoader>
        <PulseAppLayout />
      </PageLoader>
    ),
    errorElement: <PulseRouteErrorFallback />,
    children: [{ index: true, element: <PulseHomePage /> }]
  },
  {
    path: '/pulse/invite',
    element: (
      <PageLoader>
        <PulseAppLayout />
      </PageLoader>
    ),
    errorElement: <PulseRouteErrorFallback />,
    children: [{ index: true, element: <PulseInvitePage /> }]
  }
]);
