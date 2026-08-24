-- Add default ATS scoring policy controls to existing scoring versions.
-- These values are stored inside the existing JSON fields so no table shape change is needed.

update public.ats_scoring_versions
set
  free_scan_weights = free_scan_weights
    || jsonb_build_object(
      'caps',
      coalesce(free_scan_weights->'caps', '{}'::jsonb) || jsonb_build_object(
        'tinyText', 12,
        'veryShortText', 22,
        'nonResume', 12,
        'nonResumeSignal', 18,
        'lowResumeConfidence', 15,
        'weakResumeStructure', 30,
        'missingContact', 55,
        'missingSections', 25,
        'fewSections', 45,
        'missingCareerCore', 35,
        'weakBulletStructure', 50,
        'advancedWeakResume', 45,
        'lowRoleKeywordMatch', 50
      ),
      'recommendationGains',
      coalesce(free_scan_weights->'recommendationGains', '{}'::jsonb) || jsonb_build_object(
        'scoreCap', '+2 to +5 after the blocking issue is fixed',
        'contact', '+2 to +4',
        'sections', '+3 to +5',
        'bulletRewrite', '+3 to +6',
        'quantifiedImpact', '+2 to +5',
        'roleKeywordEvidence', '+3 to +6',
        'jobDescriptionMatch', '+2 to +4',
        'readability', '+2 to +4',
        'moreBullets', '+2 to +4'
      )
    ),
  weights = weights
    || jsonb_build_object(
      'caps',
      coalesce(weights->'caps', '{}'::jsonb) || jsonb_build_object(
        'tinyText', 12,
        'veryShortText', 22,
        'nonResume', 12,
        'nonResumeSignal', 18,
        'lowResumeConfidence', 15,
        'weakResumeStructure', 30,
        'missingContact', 55,
        'missingSections', 25,
        'fewSections', 45,
        'missingCareerCore', 35,
        'weakBulletStructure', 50,
        'advancedWeakResume', 45,
        'lowRoleKeywordMatch', 50
      ),
      'recommendationGains',
      coalesce(weights->'recommendationGains', '{}'::jsonb) || jsonb_build_object(
        'scoreCap', '+2 to +5 after the blocking issue is fixed',
        'contact', '+2 to +4',
        'sections', '+3 to +5',
        'bulletRewrite', '+3 to +6',
        'quantifiedImpact', '+2 to +5',
        'roleKeywordEvidence', '+3 to +6',
        'jobDescriptionMatch', '+2 to +4',
        'readability', '+2 to +4',
        'moreBullets', '+2 to +4'
      )
    ),
  updated_at = now()
where version_key = 'ats_resume_score_v1';
