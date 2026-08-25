import { analyzeAdvancedResume, AtsScoreCategory } from '../src/lib/atsResumeScoring';

function category(result: ReturnType<typeof analyzeAdvancedResume>, key: string): AtsScoreCategory {
  const match = result.categories.find((item) => item.key === key);
  if (!match) throw new Error(`Missing category ${key}`);
  return match;
}

const baseResume = `
Rahul Sharma
rahul@example.com | +91 9876543210 | linkedin.com/in/rahul

Summary
Data analyst student with internship and project experience.

Skills
SQL, Power BI, Excel, Python, dashboard, data cleaning

Education
BBA Analytics, ABC University, 2026

Projects
- Created a sales dashboard for 500 records using Excel and Power BI, improving weekly reporting accuracy by 18%.
- Analyzed customer data with SQL and Python to identify 4 retention patterns for a capstone project.

Experience
- Coordinated internship reporting with 3 stakeholders and delivered status updates in weekly review meetings.
`;

describe('ATS advanced scoring', () => {
  it('scores evidence-backed role keywords higher than skills-list-only mentions', () => {
    const skillsOnlyResume = `
Rahul Sharma
rahul@example.com | +91 9876543210 | linkedin.com/in/rahul

Summary
Data analyst student with internship and project exposure.

Skills
SQL, Power BI, dashboard, data cleaning

Education
BBA Analytics, ABC University, 2026

Projects
- Worked on a college analytics project and prepared weekly notes for faculty review.
`;

    const roleProfile = {
      keywords: ['SQL | must-have', 'Power BI | important', 'dashboard | important', 'data cleaning | nice-to-have'],
      preferredSections: ['summary', 'skills', 'projects', 'education'],
      actionVerbs: ['created', 'analyzed', 'coordinated']
    };

    const skillsOnly = analyzeAdvancedResume(skillsOnlyResume, {
      roleName: 'Data Analyst',
      roleProfile
    });
    const evidenced = analyzeAdvancedResume(baseResume, {
      roleName: 'Data Analyst',
      roleProfile
    });

    expect(category(evidenced, 'roleKeywordMatch').score).toBeGreaterThan(category(skillsOnly, 'roleKeywordMatch').score);
    expect(category(evidenced, 'roleKeywordMatch').signals.join(' ')).toMatch(/backed by project\/experience evidence/i);
  });

  it('prioritizes missing must-have role keywords in suggestions', () => {
    const result = analyzeAdvancedResume(baseResume, {
      roleName: 'Data Analyst',
      roleProfile: {
        keywords: ['Tableau | must-have', 'SQL | important'],
        preferredSections: ['summary', 'skills', 'projects', 'education'],
        actionVerbs: ['created', 'analyzed']
      }
    });

    expect(category(result, 'roleKeywordMatch').suggestions.join(' ')).toMatch(/must-have keywords: tableau/i);
  });

  it('makes JD matching more influential when a usable JD is pasted', () => {
    const result = analyzeAdvancedResume(baseResume, {
      jobDescription: `
We are hiring a data analyst intern. The candidate must have SQL, Power BI, dashboard development,
data cleaning, stakeholder communication, Excel reporting, business analysis, and Python exposure.
Responsibilities include building dashboards, analyzing customer data, preparing weekly reports,
and presenting insights to business stakeholders.
`,
      roleName: 'Data Analyst',
      roleProfile: {
        keywords: ['SQL | must-have', 'Power BI | important', 'dashboard | important'],
        preferredSections: ['summary', 'skills', 'projects', 'education'],
        actionVerbs: ['created', 'analyzed', 'prepared']
      }
    });

    expect(category(result, 'jobDescriptionMatch').maxScore).toBeGreaterThan(category(result, 'roleKeywordMatch').maxScore);
    expect(category(result, 'jobDescriptionMatch').signals.join(' ')).toMatch(/JD signal/i);
  });

  it('scores the same project-heavy resume differently by selected career level', () => {
    const roleProfile = {
      keywords: ['SQL | must-have', 'Power BI | important', 'dashboard | important'],
      preferredSections: ['summary', 'skills', 'projects', 'education'],
      actionVerbs: ['created', 'analyzed', 'coordinated']
    };

    const fresher = analyzeAdvancedResume(baseResume, {
      levelKey: 'fresher',
      levelName: 'Fresher',
      roleName: 'Data Analyst',
      roleProfile
    });
    const experienced = analyzeAdvancedResume(baseResume, {
      levelKey: 'experienced',
      levelName: 'Experienced',
      roleName: 'Data Analyst',
      roleProfile
    });

    expect(category(fresher, 'levelReadiness').score).toBeGreaterThan(category(experienced, 'levelReadiness').score);
    expect(category(experienced, 'levelReadiness').suggestions.join(' ')).toMatch(/ownership|experience|metrics/i);
  });

  it('makes experienced scoring stricter on quantified impact than fresher scoring', () => {
    const roleProfile = {
      keywords: ['SQL | must-have', 'Power BI | important', 'dashboard | important'],
      preferredSections: ['summary', 'skills', 'projects', 'experience', 'education'],
      actionVerbs: ['created', 'analyzed', 'led']
    };

    const fresher = analyzeAdvancedResume(baseResume, {
      levelKey: 'fresher',
      levelName: 'Fresher',
      roleName: 'Data Analyst',
      roleProfile
    });
    const experienced = analyzeAdvancedResume(baseResume, {
      levelKey: 'experienced',
      levelName: 'Experienced',
      roleName: 'Data Analyst',
      roleProfile
    });

    expect(category(experienced, 'quantifiedImpact').maxScore).toBeGreaterThan(category(fresher, 'quantifiedImpact').maxScore);
    expect(category(experienced, 'levelReadiness').label).toBe('Experienced readiness');
  });

  it('does not count contact numbers or graduation years as experienced impact metrics', () => {
    const internshipResume = `
Priya Mehta
priya@example.com | +91 9876543210 | linkedin.com/in/priya

Summary
Data analyst fresher seeking an internship role.

Skills
SQL, Excel, Power BI, dashboard

Education
BBA Analytics, ABC University, 2026

Projects
- Created a classroom dashboard using Excel and Power BI for faculty review.
- Prepared weekly notes for a college analytics case study.

Internship
- Supported data cleaning work during a short internship and coordinated review notes.
`;

    const result = analyzeAdvancedResume(internshipResume, {
      levelKey: 'experienced',
      levelName: 'Experienced',
      roleName: 'Data Analyst',
      roleProfile: {
        keywords: ['SQL | must-have', 'Power BI | important', 'dashboard | important'],
        preferredSections: ['summary', 'skills', 'projects', 'experience', 'education'],
        actionVerbs: ['created', 'prepared', 'supported']
      }
    });

    const readiness = category(result, 'levelReadiness');
    expect(readiness.score).toBeLessThan(6);
    expect(readiness.suggestions.join(' ')).toMatch(/roles, companies, and dates|more metrics/i);
  });
});
