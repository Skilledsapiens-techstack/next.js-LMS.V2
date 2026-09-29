import { Linkedin, Search, SlidersHorizontal, UserRound, UsersRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { PulseBadge, PulseCard } from '../components';
import {
  PulsePeopleDirectoryScope,
  PulsePeopleDirectorySort,
  PulseProfile,
  usePulsePeopleDirectory,
  usePulseProfile
} from '../features/usePulseCommunity';

function profileMeta(profile: PulseProfile) {
  const tags = [...profile.skills, ...profile.interests].slice(0, 3);
  if (tags.length) return tags.join(' · ');
  return profile.college?.name ?? 'Pulse student';
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'SP';
}

function collectSuggestedTags(people: PulseProfile[]) {
  const counts = new Map<string, number>();
  people.forEach((person) => {
    [...person.skills, ...person.interests].forEach((tag) => {
      const cleanTag = tag.trim();
      if (!cleanTag) return;
      counts.set(cleanTag, (counts.get(cleanTag) ?? 0) + 1);
    });
  });

  return [...counts.entries()]
    .sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]))
    .slice(0, 10)
    .map(([tag]) => tag);
}

export function PulsePeoplePage() {
  const { status } = useAuth();
  const profileQuery = usePulseProfile();
  const profile = profileQuery.data;
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<PulsePeopleDirectoryScope>('all');
  const [sort, setSort] = useState<PulsePeopleDirectorySort>('recent');
  const [tag, setTag] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const peopleQuery = usePulsePeopleDirectory({ query, scope, sort, tag }, profile);
  const people = peopleQuery.data ?? [];
  const suggestedTags = useMemo(() => collectSuggestedTags(people), [people]);

  useEffect(() => {
    document.title = 'People | SapiensPulse';
  }, []);

  if (status === 'unauthenticated') {
    return <Navigate to="/pulse" replace />;
  }

  if (profileQuery.isLoading) {
    return (
      <section className="pulse-auth-required">
        <PulseBadge tone="gold">Opening People</PulseBadge>
        <h1>Loading the student directory.</h1>
      </section>
    );
  }

  if (!profile) {
    return <Navigate to="/pulse/home" replace />;
  }

  return (
    <section className="pulse-people-page">
      <div className="pulse-people-page__header">
        <PulseBadge tone="coral">People</PulseBadge>
        <h1>Find Peers to learn, build, and collaborate with.</h1>
        <p>
          Discover peers by college, skills, interests, and profile context. Use the scope toggle to browse everyone on
          Pulse or narrow the view to your college.
        </p>
      </div>

      <PulseCard className="pulse-people-controls">
        <div className="pulse-people-search">
          <Search size={19} />
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, headline, interest, or goal"
            value={query}
          />
        </div>

        <div className="pulse-people-simple-row">
          <div className="pulse-people-scope" aria-label="People scope">
            <button className={scope === 'all' ? 'is-active' : ''} onClick={() => setScope('all')} type="button">
              <UsersRound size={16} /> Everyone on Pulse
            </button>
            <button className={scope === 'college' ? 'is-active' : ''} onClick={() => setScope('college')} type="button">
              My college only
            </button>
          </div>
          <button className="pulse-people-filter-toggle" onClick={() => setShowFilters((current) => !current)} type="button">
            <SlidersHorizontal size={16} />
            {showFilters ? 'Hide filters' : 'Filters'}
          </button>
        </div>

        {showFilters ? (
          <div className="pulse-people-advanced">
            <div className="pulse-people-filter-row">
              <label>
                <span>Sort</span>
                <select onChange={(event) => setSort(event.target.value as PulsePeopleDirectorySort)} value={sort}>
                  <option value="recent">Recently joined</option>
                  <option value="name">Name A-Z</option>
                </select>
              </label>

              <label>
                <span>Skill or interest</span>
                <input onChange={(event) => setTag(event.target.value)} placeholder="Finance, startup, consulting" value={tag} />
              </label>
            </div>

            {suggestedTags.length ? (
              <div className="pulse-people-chip-row" aria-label="Popular skills and interests">
                {suggestedTags.map((suggestedTag) => (
                  <button
                    className={tag.toLowerCase() === suggestedTag.toLowerCase() ? 'is-active' : ''}
                    key={suggestedTag}
                    onClick={() => setTag(tag.toLowerCase() === suggestedTag.toLowerCase() ? '' : suggestedTag)}
                    type="button"
                  >
                    {suggestedTag}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </PulseCard>

      {peopleQuery.isLoading ? (
        <div className="pulse-feed-state">Loading students.</div>
      ) : peopleQuery.error ? (
        <div className="pulse-feed-state pulse-feed-state--error">{peopleQuery.error.message}</div>
      ) : people.length ? (
        <div className="pulse-people-grid">
          {people.map((person) => (
            <PulseCard className="pulse-person-card" key={person.id}>
              <div className="pulse-person-card__top">
                <span className="pulse-person-card__avatar">
                  {person.avatar_url ? <img alt="" src={person.avatar_url} /> : <span>{initials(person.display_name)}</span>}
                </span>
                <PulseBadge tone="green">Pulse member</PulseBadge>
              </div>
              <div>
                <h2>{person.display_name}</h2>
                <p>{person.headline || 'Building their Pulse profile.'}</p>
              </div>
              {person.college?.name ? <span className="pulse-person-card__meta">{person.college.name}</span> : null}
              <div className="pulse-person-card__tags">
                {[...person.skills, ...person.interests].slice(0, 4).map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
              <div className="pulse-person-card__actions">
                <Link className="pulse-inline-link" to={`/pulse/u/${person.id}`}>Open Pulse Profile</Link>
                {person.linkedin_url ? (
                  <a className="pulse-inline-link" href={person.linkedin_url} rel="noreferrer" target="_blank">
                    <Linkedin size={16} /> LinkedIn
                  </a>
                ) : (
                  <span className="pulse-inline-link pulse-inline-link--muted">
                    <Linkedin size={16} /> LinkedIn not added
                  </span>
                )}
              </div>
            </PulseCard>
          ))}
        </div>
      ) : (
        <div className="pulse-feed-state">
          <UserRound size={22} />
          <strong>No peers found.</strong>
          <span>Try a broader search, remove the skill filter, or switch the scope.</span>
        </div>
      )}
    </section>
  );
}
