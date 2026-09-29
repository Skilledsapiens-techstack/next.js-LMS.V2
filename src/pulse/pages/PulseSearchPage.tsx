import { BriefcaseBusiness, FileText, Search, UserRound, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { PulseBadge, PulseCard } from '../components';
import {
  PulseProfile,
  PulseSearchFilter,
  usePulseProfile,
  usePulseSearch
} from '../features/usePulseCommunity';

const searchTabs: Array<{ id: PulseSearchFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'posts', label: 'Posts' },
  { id: 'people', label: 'People' },
  { id: 'opportunities', label: 'Opportunities' }
];

function useDebouncedValue(value: string, delay = 250) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timeoutId);
  }, [delay, value]);

  return debouncedValue;
}

function profileMeta(profile: PulseProfile) {
  const tags = [...profile.skills, ...profile.interests].slice(0, 3);
  if (tags.length) return tags.join(' · ');
  return profile.college?.name ?? 'Pulse student';
}

export function PulseSearchPage() {
  const { status } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const activeFilter = (searchParams.get('type') as PulseSearchFilter | null) ?? 'all';
  const searchScope = searchParams.get('scope') === 'college' ? 'college' : 'all';
  const debouncedQuery = useDebouncedValue(query);
  const profileQuery = usePulseProfile();
  const profile = profileQuery.data;
  const searchQuery = usePulseSearch(debouncedQuery, activeFilter, profile);
  const scopedResults = useMemo(() => {
    const results = searchQuery.data;
    if (!results) return results;
    if (searchScope !== 'college') return results;
    return {
      opportunities: results.opportunities.filter((opportunity) => opportunity.visibility === 'college'),
      people: results.people.filter((person) => person.college_id === profile?.college_id),
      posts: results.posts.filter((post) => post.visibility === 'college' && (!profile?.college_id || post.college_id === profile.college_id))
    };
  }, [profile?.college_id, searchQuery.data, searchScope]);

  const resultCount = useMemo(() => {
    const results = scopedResults;
    return (results?.posts.length ?? 0) + (results?.people.length ?? 0) + (results?.opportunities.length ?? 0);
  }, [scopedResults]);

  useEffect(() => {
    document.title = query ? `${query} | Pulse Search` : 'Pulse Search | Skilled Sapiens';
  }, [query]);

  function setFilter(filter: PulseSearchFilter) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set('type', filter);
      if (query) next.set('q', query);
      if (searchScope === 'college') next.set('scope', 'college');
      return next;
    });
  }

  function setScope(scope: 'all' | 'college') {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (scope === 'college') next.set('scope', 'college');
      else next.delete('scope');
      next.set('type', activeFilter);
      if (query) next.set('q', query);
      return next;
    });
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/pulse" replace />;
  }

  if (profileQuery.isLoading) {
    return (
      <section className="pulse-auth-required">
        <PulseBadge tone="gold">Loading Search</PulseBadge>
        <h1>Opening Pulse discovery.</h1>
      </section>
    );
  }

  if (!profile) {
    return <Navigate to="/pulse/home" replace />;
  }

  if (!query.trim() && activeFilter === 'people') {
    return <Navigate to="/pulse/people" replace />;
  }

  if (!query.trim() && activeFilter === 'opportunities') {
    return <Navigate to="/pulse/opportunities" replace />;
  }

  return (
    <section className="pulse-search-page">
      <div className="pulse-search-page__header">
        <PulseBadge tone="coral">Discovery</PulseBadge>
        <h1>{searchScope === 'college' ? 'Search My College.' : 'Search Pulse.'}</h1>
        <p>{searchScope === 'college' ? 'Find college-only posts, classmates, and opportunities connected to your campus workspace.' : 'Find student posts, peer profiles, and opportunity drops across the Pulse spaces you can access.'}</p>
      </div>

      <div className="pulse-search-shell">
        <div className="pulse-search-shell__top">
          <div className="pulse-search-box">
            <Search size={19} />
            <input
              autoFocus
              onChange={(event) =>
                setSearchParams((current) => {
                  const next = new URLSearchParams(current);
                  const value = event.target.value;
                  if (value) next.set('q', value);
                  else next.delete('q');
                  next.set('type', activeFilter);
                  if (searchScope === 'college') next.set('scope', 'college');
                  return next;
                })
              }
              placeholder={searchScope === 'college' ? 'Search your college workspace' : 'Search posts, people, opportunities'}
              value={query}
            />
          </div>

          <div className="pulse-search-tabs pulse-search-tabs--scope" role="tablist" aria-label="Search scope">
            <button
              aria-selected={searchScope === 'college'}
              className={searchScope === 'college' ? 'is-active' : ''}
              onClick={() => setScope('college')}
              role="tab"
              type="button"
            >
              My College
            </button>
            <button
              aria-selected={searchScope === 'all'}
              className={searchScope === 'all' ? 'is-active' : ''}
              onClick={() => setScope('all')}
              role="tab"
              type="button"
            >
              All Pulse
            </button>
          </div>

          <div className="pulse-search-tabs" role="tablist" aria-label="Search filters">
            {searchTabs.map((tab) => (
              <button
                aria-selected={activeFilter === tab.id}
                className={activeFilter === tab.id ? 'is-active' : ''}
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                role="tab"
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {debouncedQuery.length < 2 ? (
          <div className="pulse-feed-state">
            <strong>Start with at least two letters.</strong>
            <span>Search for project topics, finance, marketing, college names, student interests, or company drops.</span>
          </div>
        ) : searchQuery.isLoading ? (
          <div className="pulse-feed-state">Searching Pulse.</div>
        ) : searchQuery.error ? (
          <div className="pulse-feed-state pulse-feed-state--error">{searchQuery.error.message}</div>
        ) : resultCount ? (
          <div className="pulse-search-results">
            {(activeFilter === 'all' || activeFilter === 'posts') && scopedResults?.posts.length ? (
              <section className="pulse-search-section">
                <h2><FileText size={20} /> Posts</h2>
                {scopedResults?.posts.map((post) => (
                  <PulseCard className="pulse-search-result" key={post.id}>
                    <PulseBadge tone={post.visibility === 'global' ? 'gold' : 'brand'}>
                      {post.visibility === 'global' ? 'Everyone on Pulse' : 'My college only'}
                    </PulseBadge>
                    <h3>{post.title}</h3>
                    <p>{post.body}</p>
                    <span>{post.anonymous ? 'Anonymous student' : post.author?.display_name ?? 'Pulse member'}</span>
                  </PulseCard>
                ))}
              </section>
            ) : null}

            {(activeFilter === 'all' || activeFilter === 'people') && scopedResults?.people.length ? (
              <section className="pulse-search-section">
                <h2><Users size={20} /> People</h2>
                {scopedResults?.people.map((person) => (
                  <PulseCard className="pulse-search-result pulse-search-result--person" key={person.id}>
                    <span className="pulse-search-avatar"><UserRound size={18} /></span>
                    <div>
                      <h3>{person.display_name}</h3>
                      <p>{person.headline || profileMeta(person)}</p>
                      <span>{profileMeta(person)}</span>
                      <Link className="pulse-inline-link" to={`/pulse/u/${person.id}`}>Open Pulse Profile</Link>
                    </div>
                  </PulseCard>
                ))}
              </section>
            ) : null}

            {(activeFilter === 'all' || activeFilter === 'opportunities') && scopedResults?.opportunities.length ? (
              <section className="pulse-search-section">
                <h2><BriefcaseBusiness size={20} /> Opportunities</h2>
                {scopedResults?.opportunities.map((opportunity) => (
                  <PulseCard className="pulse-search-result" key={opportunity.id}>
                    <PulseBadge tone="green">Opportunity</PulseBadge>
                    <h3>{opportunity.title}</h3>
                    <p>{opportunity.description}</p>
                    <span>{opportunity.company_name || 'Skilled Sapiens'} · {opportunity.visibility === 'global' ? 'Everyone on Pulse' : 'My college only'}</span>
                    <Link className="pulse-inline-link" to={`/pulse/opportunities/${opportunity.id}`}>Open opportunity</Link>
                  </PulseCard>
                ))}
              </section>
            ) : null}
          </div>
        ) : (
          <div className="pulse-feed-state">
            <strong>No Pulse results found.</strong>
            <span>{searchScope === 'college' ? 'Try All Pulse, or use a broader club, topic, student, or opportunity keyword.' : 'Try a broader word, company name, skill, project theme, or student interest.'}</span>
          </div>
        )}
      </div>
    </section>
  );
}
