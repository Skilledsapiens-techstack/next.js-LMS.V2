import {
  ArrowLeft,
  ArrowRight,
  Award,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChevronDown,
  Check,
  CheckSquare,
  Clock3,
  Download,
  FileText,
  GraduationCap,
  Handshake,
  IndianRupee,
  Menu,
  MessageCircle,
  Rocket,
  Search,
  Star,
  Target as TargetIcon,
  TrendingUp,
  Trophy,
  Users,
  Video,
  X,
  type LucideIcon
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useMemo, useState } from 'react';
import { Link, NavLink, Navigate, useLocation, useParams } from 'react-router-dom';
import { WhatsAppContactWidget } from '../components/WhatsAppContactWidget';
import { usePublicWhatsAppWidgetFeatureControl } from '../features/useFeatureControls';
import { apiGet, apiPost } from '../lib/supabaseApi';

type ExplorePortal = 'student' | 'guest';

type ExploreSkilledSapiensPageProps = {
  portal: ExplorePortal;
};

type ExploreLocationState = {
  from?: string;
};

type WebsiteNavModule = {
  id: string;
  isCore: boolean;
  label: string;
  moduleKey: string;
  navGroup: 'main' | 'placement';
  settings?: Record<string, unknown>;
  slug: string;
  sortOrder: number;
  status: 'visible' | 'hidden';
};

type CampusInquiryForm = {
  designation: string;
  email: string;
  institutionName: string;
  interestedIn: string;
  message: string;
  name: string;
  partnerType: string;
  phone: string;
};

type BusinessInquiryForm = {
  designation: string;
  email: string;
  institutionName: string;
  interestedIn: string;
  message: string;
  name: string;
  partnerType: string;
  phone: string;
};

const explorePages = [
  { label: 'Home', slug: 'home' },
  { label: 'Live Projects', slug: 'live-projects' },
  { label: 'Leadership Programs', slug: 'leadership-programs' },
  { label: 'Business Connect', slug: 'business-connect' },
  { label: 'Campus Connect', slug: 'campus-connect' }
];

const placementMentorshipPages = [
  { label: 'Students', slug: 'placement-mentorship' },
  { label: 'Working Professionals', slug: 'placement-mentorship-professionals' }
];

const campusPartnerTypeOptions = [
  'College / University Admin',
  'Training & Placement Cell',
  'Student Club / Society',
  'Department / Faculty',
  'Student Government / Committee'
];

const campusInterestOptions = [
  'Industry Workshops & Sessions',
  'Live Projects Program',
  'Placement Preparation (Batch)',
  'Mentorship Program',
  'Campus Ambassador Program',
  'Startup / Entrepreneurship Support',
  'Event Sponsorship & Co-hosting',
  'Full MoU Partnership'
];

const businessPartnerTypeOptions = [
  'Student Founder / Startup',
  'Early-stage Startup',
  'SME / Business Owner',
  'Creator / Personal Brand',
  'College Venture / Club Initiative',
  'Institute / Training Business'
];

const businessInterestOptions = [
  'Incubation Centre Support',
  'DigiBrand Digital Growth',
  'Idea Validation',
  'Pitch Deck / Funding Prep',
  'Website / Landing Page',
  'Social Media / Campaign Execution',
  'SEO / Content Funnel',
  'Mentor or Talent Support'
];

const initialCampusInquiryForm: CampusInquiryForm = {
  designation: '',
  email: '',
  institutionName: '',
  interestedIn: '',
  message: '',
  name: '',
  partnerType: '',
  phone: ''
};

const initialBusinessInquiryForm: BusinessInquiryForm = {
  designation: '',
  email: '',
  institutionName: '',
  interestedIn: '',
  message: '',
  name: '',
  partnerType: '',
  phone: ''
};

const externalPageUrls: Record<string, string> = {
  about: 'https://skilledsapiens.com/',
  'alumni-mentors': 'https://skilledsapiens.com/our-alumni/',
  'business-connect': 'https://skilledsapiens.com/digibrand/',
  'campus-connect': 'https://skilledsapiens.com/campus-connect-initiative/',
  cohorts: 'https://skilledsapiens.com/our-cohorts/',
  home: 'https://skilledsapiens.com/',
  'leadership-programs': 'https://skilledsapiens.com/leadership-programs/',
  'live-projects': 'https://skilledsapiens.com/live-project/',
  'placement-mentorship': 'https://skilledsapiens.com/placement-program/',
  'placement-mentorship-professionals': 'https://skilledsapiens.com/1-1-personalized-mentorship/'
};

const ecosystemCards = [
  {
    accent: 'red',
    description: 'Personalized placement preparation with resume reviews, mock GD-PI, role-specific guidance, and mentor feedback.',
    icon: Users,
    label: 'Placement Mentorship',
    tags: ['Students', 'MBA Grads', 'Professionals']
  },
  {
    accent: 'yellow',
    description: 'Live, practical learning tracks in consulting, finance, HR, marketing, and strategy with project-based exposure.',
    icon: Award,
    label: 'Leadership Programs',
    tags: ['Live Training', 'Certificates', 'Projects']
  },
  {
    accent: 'dark',
    description: 'Growth support for colleges, startups, and businesses through mentorship, talent, digital services, and networks.',
    icon: Rocket,
    label: 'Business & Campus Connect',
    tags: ['Colleges', 'Startups', 'Partners']
  }
];

const journeySteps = [
  ['Choose your track', 'Select the career, leadership, or business path that matches your current goal.'],
  ['Get matched to guidance', 'Work with mentors and program teams who understand your domain and outcome.'],
  ['Build, practice, and network', 'Use live projects, sessions, feedback loops, and community support to grow faster.'],
  ['Stay connected', 'Continue inside the Skilled Sapiens ecosystem as you move from learner to alumnus.']
];

const faqs = [
  {
    answer:
      'Skilled Sapiens is a career ecosystem for students, MBA graduates, working professionals, entrepreneurs, colleges, and businesses. The focus is live guidance, mentorship, projects, and community.',
    question: 'What exactly is Skilled Sapiens?'
  },
  {
    answer:
      'The experience is built around live, mentor-led guidance instead of only pre-recorded learning. Students get practical support, project exposure, and feedback tied to real career outcomes.',
    question: 'How is this different from a normal online course?'
  },
  {
    answer:
      'Students use the LMS for their enrolled programs, while Explore Skilled Sapiens helps them understand the broader ecosystem, initiatives, mentors, and public offerings.',
    question: 'Why is this inside the LMS?'
  }
];

function scrollExploreSectionIntoView(sectionId: string) {
  if (typeof window === 'undefined') return;
  window.setTimeout(() => {
    const section = document.getElementById(sectionId);
    if (!section) return;
    const stickyOffset = window.matchMedia('(max-width: 640px)').matches ? 150 : 220;
    const top = section.getBoundingClientRect().top + window.scrollY - stickyOffset;
    window.scrollTo({ behavior: 'smooth', top: Math.max(0, top) });
  }, 0);
}

const workshopPool = [
  'Resume Building Lab',
  'LinkedIn Profile Sprint',
  'Mock GD Practice',
  'Personal Interview Prep',
  'Guesstimate Practice',
  'Case Study Practice',
  'Consulting Problem Solving',
  'Finance Interview Basics',
  'Equity Research Primer',
  'Marketing Career Paths',
  'Product Management Basics',
  'HR Interview Readiness',
  'Operations Career Map',
  'Off-Campus Job Strategy',
  'Live Project Portfolio',
  'Cold Outreach Workshop',
  'Placement Storytelling',
  'Domain Selection Clinic',
  'Aptitude Revision Sprint',
  'Excel for Managers',
  'Business Research Methods',
  'Salary Negotiation Basics',
  'Campus Placement Roadmap',
  'Corporate Communication'
];

const workshopTimes = ['05:00 PM', '06:30 PM', '07:00 PM', '08:00 PM', '09:00 PM'];

const testimonials = [
  ['AP', 'Ananya Patel', 'IIM Indore - Batch 2024', 'HDFC Bank', "The mock GD/PI sessions were incredibly realistic. My mentor gave me honest, actionable feedback that changed how I approached every interview."],
  ['RK', 'Rahul Khanna', 'MDI Gurgaon - Batch 2024', 'Axis Capital', 'The Finance Leadership Program gave me real-world financial modeling skills my MBA never covered. My mentor helped me structure my IB interview story perfectly.'],
  ['SM', 'Sneha Mehta', 'IIM Calcutta - Batch 2023', 'BCG India', 'As a working professional targeting consulting, the Corporate Placement track was exactly what I needed. Got my BCG offer after intensive prep.'],
  ['VT', 'Vikram Tiwari', 'NMIMS Mumbai - Batch 2024', 'Deloitte USI', 'Campus Connect brought Skilled Sapiens right to our college. The resume workshop helped our whole cohort improve shortlisting quality.'],
  ['PS', 'Priya Sharma', 'XLRI Jamshedpur - Batch 2024', 'Unilever India', 'The 1-1 sessions changed my view completely. My mentor helped redesign my entire career narrative. Worth every rupee.'],
  ['KA', 'Kiran Agarwal', 'TISS Mumbai - Batch 2023', 'Infosys BPM', 'The HR Leadership Program gave me frameworks I still use daily. The live project experience set me apart in interviews.']
];

const studentWhyCards: Array<[string, string, LucideIcon]> = [
  ['Live Domain Sessions', '1-1 live sessions with corporate experts. Real interaction, real guidance.', Video],
  ['24/7 Doubt Clearing', 'On-demand sessions any time. Your questions never wait for office hours.', Clock3],
  ['Mock GD-PI Sessions', 'Structured mock interviews and group discussions with instant analysis reports.', MessageCircle],
  ['20+ Industry Insights', 'Curated compendiums and domain-specific FAQs with best possible answers.', FileText],
  ['Personalized Mentorship', 'Customized sessions tailored to your profile, goals, and target companies.', Users],
  ['Paid Live Projects', 'Real corporate live projects from top MNCs and funded startups for profile building.', BriefcaseBusiness],
  ['Resume Mentorship', 'Learn to craft the best ATS-friendly resume to maximize shortlistings.', FileText],
  ['Industry Certifications', 'Domain certifications and LORs that strengthen your placement profile.', Award],
  ['Mentor Referrals', 'Off-campus referrals via our network of corporate mentors at top companies.', Users]
];

const studentAboutCards: Array<[string, string, LucideIcon]> = [
  ['Resume Building', 'ATS-friendly CVs, SoP writing, action verbs and impact quantification', FileText],
  ['Mock GD-PI', 'Live mock interviews and group discussions with instant feedback', MessageCircle],
  ['Profile Building', 'Live projects, LORs, certifications from top MNCs and funded startups', BriefcaseBusiness],
  ['Domain Mastery', 'Deep-dive sessions on Consulting, Finance, HR, Marketing, Operations and PM', TargetIcon]
];

const studentProgramCards = [
  {
    category: 'MBA Placement - Flagship',
    featured: true,
    price: 'Rs. 4,999',
    oldPrice: 'Rs. 8,999',
    title: 'Personalized MBA Placement Bootcamp',
    text: 'Complete placement preparation with expert mentorship across domains, live projects, resume support, and mock interviews.',
    features: ['Mentored until placed', 'Live sessions and recordings', 'Mock GD-PI and referrals']
  },
  {
    category: 'MBA Placement',
    price: 'Rs. 2,499',
    oldPrice: 'Rs. 3,499',
    title: 'HR Round Preparation',
    text: 'Prepare structured, confident answers for HR interviews with personalized review and practical feedback.',
    features: ['HR question bank', 'Personalized mock rounds', 'Feedback from mentors']
  },
  {
    category: 'Profile Building',
    price: 'Rs. 899',
    oldPrice: 'Rs. 1,499',
    title: 'Resume Building Mentorship',
    text: 'Create an ATS-friendly, impact-led resume that communicates your strengths and improves shortlist chances.',
    features: ['ATS-friendly formatting', 'Impact-driven bullet points', 'Mentor-led review']
  },
  {
    category: 'Profile Building',
    price: 'Rs. 2,499',
    oldPrice: 'Rs. 3,499',
    title: 'Profile Building Program',
    text: 'Strengthen your professional story through practical projects, certifications, LORs, and role-relevant positioning.',
    features: ['Live project opportunities', 'Certificates and LORs', 'Profile strategy support']
  },
  {
    category: 'MBA Placement',
    price: 'Rs. 2,999',
    title: 'GD-PI Mentorship',
    text: 'Build interview confidence with targeted personal interview practice, group discussions, and instant feedback.',
    features: ['Mock personal interviews', 'Group discussion practice', 'Performance feedback']
  },
  {
    category: 'Consulting',
    price: 'Rs. 3,999',
    title: 'Guesstimates & Case Study Mentorship',
    text: 'Practice structured approaches for guesstimates and consulting case studies with mentor-led problem solving and feedback.',
    features: ['Guesstimate frameworks', 'Case-solving practice', 'Mentor-led feedback']
  }
];

type StudentPlacementProgram = {
  applyUrl: string;
  category: string;
  deliverables: string[];
  description: string;
  domain: string;
  duration: string;
  features: string[];
  guideUrl: string;
  id: string;
  outcomes: string[];
  price: string;
  title: string;
  whoFor: string;
};

const studentPlacementPrograms: StudentPlacementProgram[] = [
  {
    applyUrl: 'https://rzp.io/l/p0BR51nql7',
    category: 'Flagship',
    deliverables: ['Placement roadmap', 'Resume review', 'Mock GD-PI feedback', 'Domain preparation plan'],
    description: 'A complete MBA placement preparation program for students who want structured mentorship until placement.',
    domain: 'All Domains',
    duration: '4-8 weeks + support until placed',
    features: ['1-1 mentor guidance', 'Live sessions and recordings', 'Mock interviews and GD practice', 'Off-campus strategy'],
    guideUrl: 'https://drive.google.com/file/d/1Kk3MQUYKduRu-LJKBsZ5tB0l1MqQO1zv/view?usp=sharing',
    id: 'mba-placement-bootcamp',
    outcomes: ['Choose the right placement domain', 'Improve shortlisting quality', 'Prepare HR and technical rounds', 'Build a stronger placement story'],
    price: 'Rs. 4,999',
    title: 'Personalized MBA Placement Bootcamp',
    whoFor: 'MBA students preparing for campus and off-campus placements'
  },
  {
    applyUrl: 'https://rzp.io/l/p0BR51nql7',
    category: 'Interview Prep',
    deliverables: ['HR answer bank', 'Personal interview feedback', 'Career story script'],
    description: 'Focused HR and behavioral interview preparation with mentor-led practice and personalized feedback.',
    domain: 'HR Round',
    duration: '1-2 weeks',
    features: ['Tell me about yourself', 'Strengths and weaknesses', 'Why this role/company', 'Behavioral interview stories'],
    guideUrl: 'https://drive.google.com/file/d/1Kk3MQUYKduRu-LJKBsZ5tB0l1MqQO1zv/view?usp=sharing',
    id: 'hr-round-prep',
    outcomes: ['Answer HR questions confidently', 'Explain resume points better', 'Structure behavioral examples', 'Avoid generic interview answers'],
    price: 'Rs. 2,499',
    title: 'HR Round Preparation',
    whoFor: 'Students who already have shortlists or interviews coming up'
  },
  {
    applyUrl: 'https://rzp.io/l/p0BR51nql7',
    category: 'Profile Building',
    deliverables: ['ATS-friendly resume', 'Impact bullet rewrite', 'Profile improvement checklist'],
    description: 'Build a recruiter-friendly resume with stronger positioning, keywords, and measurable impact.',
    domain: 'Resume',
    duration: '3-7 days',
    features: ['ATS formatting', 'Action verbs', 'Impact quantification', 'Mentor review'],
    guideUrl: 'https://drive.google.com/file/d/1Kk3MQUYKduRu-LJKBsZ5tB0l1MqQO1zv/view?usp=sharing',
    id: 'resume-building',
    outcomes: ['Improve resume clarity', 'Strengthen shortlist chances', 'Remove weak or generic points', 'Present projects and internships better'],
    price: 'Rs. 899',
    title: 'Resume Building Mentorship',
    whoFor: 'Students who need a sharper resume before applications'
  },
  {
    applyUrl: 'https://rzp.io/l/p0BR51nql7',
    category: 'Profile Building',
    deliverables: ['Profile strategy', 'Live project direction', 'Certification/LOR roadmap'],
    description: 'A profile-building track for students who need stronger proof points before placement season.',
    domain: 'Profile',
    duration: '2-4 weeks',
    features: ['Live project planning', 'Certificate strategy', 'LOR guidance', 'Profile gap analysis'],
    guideUrl: 'https://drive.google.com/file/d/1Kk3MQUYKduRu-LJKBsZ5tB0l1MqQO1zv/view?usp=sharing',
    id: 'profile-building',
    outcomes: ['Build relevant CV points', 'Add credible project exposure', 'Create a stronger domain story', 'Prepare for resume-based interviews'],
    price: 'Rs. 2,499',
    title: 'Profile Building Program',
    whoFor: 'Students with weak CV points or limited internship/project exposure'
  },
  {
    applyUrl: 'https://rzp.io/l/p0BR51nql7',
    category: 'Interview Prep',
    deliverables: ['Mock PI report', 'GD feedback', 'Improvement checklist'],
    description: 'Practice personal interviews and group discussions in a structured mentor-led format.',
    domain: 'GD-PI',
    duration: '1-2 weeks',
    features: ['Mock personal interviews', 'Group discussion practice', 'Communication feedback', 'Confidence building'],
    guideUrl: 'https://drive.google.com/file/d/1Kk3MQUYKduRu-LJKBsZ5tB0l1MqQO1zv/view?usp=sharing',
    id: 'gd-pi-mentorship',
    outcomes: ['Speak with more structure', 'Handle GD pressure', 'Improve interview confidence', 'Receive actionable mentor feedback'],
    price: 'Rs. 2,999',
    title: 'GD-PI Mentorship',
    whoFor: 'Students preparing for final placement GD and interview rounds'
  },
  {
    applyUrl: 'https://rzp.io/l/p0BR51nql7',
    category: 'Consulting',
    deliverables: ['Case practice notes', 'Guesstimate frameworks', 'Mock case feedback'],
    description: 'Prepare for consulting shortlists and interviews through guesstimates, case studies, and structured problem solving.',
    domain: 'Consulting',
    duration: '2-3 weeks',
    features: ['Guesstimate frameworks', 'Case-solving practice', 'Market sizing', 'Mentor-led feedback'],
    guideUrl: 'https://drive.google.com/file/d/1Kk3MQUYKduRu-LJKBsZ5tB0l1MqQO1zv/view?usp=sharing',
    id: 'consulting-case-prep',
    outcomes: ['Structure cases better', 'Solve guesstimates clearly', 'Improve business judgment', 'Practice consulting-style communication'],
    price: 'Rs. 3,999',
    title: 'Guesstimates & Case Study Mentorship',
    whoFor: 'Students targeting consulting, strategy, or business analyst roles'
  },
  {
    applyUrl: 'https://rzp.io/l/p0BR51nql7',
    category: 'Domain Prep',
    deliverables: ['Finance prep plan', 'Technical Q&A map', 'Company research template'],
    description: 'Domain-specific finance interview preparation covering concepts, role awareness, company research, and technical questions.',
    domain: 'Finance',
    duration: '2-3 weeks',
    features: ['Investment banking basics', 'Equity research prep', 'Finance interview Q&A', 'Role-specific study material'],
    guideUrl: 'https://drive.google.com/file/d/1Kk3MQUYKduRu-LJKBsZ5tB0l1MqQO1zv/view?usp=sharing',
    id: 'finance-domain-prep',
    outcomes: ['Understand finance role expectations', 'Prepare technical interview answers', 'Explain finance projects better', 'Research target companies faster'],
    price: 'Custom',
    title: 'Finance Domain Preparation',
    whoFor: 'Students targeting IB, equity research, corporate finance, or banking roles'
  },
  {
    applyUrl: 'https://rzp.io/l/p0BR51nql7',
    category: 'Domain Prep',
    deliverables: ['Marketing prep plan', 'Brand case notes', 'Campaign interview examples'],
    description: 'Marketing and sales interview preparation with frameworks, campaign thinking, brand stories, and role clarity.',
    domain: 'Marketing',
    duration: '2-3 weeks',
    features: ['Brand management basics', 'Sales interview prep', 'Campaign frameworks', 'Consumer insight practice'],
    guideUrl: 'https://drive.google.com/file/d/1Kk3MQUYKduRu-LJKBsZ5tB0l1MqQO1zv/view?usp=sharing',
    id: 'marketing-domain-prep',
    outcomes: ['Prepare marketing interview cases', 'Explain consumer and brand insights', 'Structure campaign ideas', 'Understand sales and marketing roles'],
    price: 'Custom',
    title: 'Sales & Marketing Domain Preparation',
    whoFor: 'Students targeting FMCG, sales, brand, growth, or marketing roles'
  }
];

const studentCurriculum: Array<{
  description: string;
  modules: Array<[string, string[]]>;
  title: string;
}> = [
  {
    description: 'Build the right preparation roadmap, strengthen your profile, and create an ATS-friendly resume.',
    modules: [
      ['Orientation: Setting the Expectations', ['Mentors introduction and expectation setting', 'Preparation roadmap discussion', 'Shortlisting process and hiring parameters']],
      ['Profile Building Mentorship', ['Build relevant CV points', 'Understand different domains', 'Choose the right domain for your profile']],
      ['Resume Building: CV, SoP and Application Form', ['ATS-friendly CV writing', 'Action verbs, keywords and impact quantification', 'Statement of purpose and application form support']]
    ],
    title: 'Orientation & Profile Building'
  },
  {
    description: 'Prepare compelling resume stories and confident answers for behavioral and HR rounds.',
    modules: [
      ['Resume-Based Interview Questions', ['Tell me about yourself', 'Justify CV points and work experience', 'Explain learnings, challenges and initiatives']],
      ['Behavioral Interview and HR Questions', ['Why this role or company?', 'Strengths, weaknesses and goals', 'Situation, ethical dilemma and conflict questions']]
    ],
    title: 'Resume & HR-Based Questions'
  },
  {
    description: 'Prepare domain-specific interviews across six major MBA career tracks.',
    modules: [
      ['Sales & Marketing Profile', ['Role overview and applications', 'Frameworks and interview preparation', 'FAQs and study material']],
      ['Finance Profiles', ['Investment banking and research roles', 'Finance interview preparation', 'Role-specific study material']],
      ['Product, Operations, Consulting and HR', ['PM concepts and design thinking', 'Operations and supply chain basics', 'Guesstimates, consulting cases and HR preparation']]
    ],
    title: 'Tech Role & Round Preparation'
  },
  {
    description: 'Practice with mentor feedback and strengthen your profile through real project opportunities.',
    modules: [
      ['Mock Personal Interview & Group Discussions', ['Two mock PIs and GDs', 'Instant feedback and analysis reports', 'Personalized mentorship throughout']],
      ['Live Project: Profile Building Support', ['Corporate live project opportunities', 'Verified resume pointers', 'Certificates and LOR support']]
    ],
    title: 'Mock Interviews & Live Projects'
  }
];

const studentFaqs = [
  ['What is Skilled Sapiens?', 'Skilled Sapiens is a community supported by IIM and IIT alumni to mentor and guide college students in career and professional growth. The goal is to provide personal mentorship that helps students improve soft skills, technical readiness, and placement outcomes.'],
  ['How does this personal mentorship program work?', 'Students self-evaluate their profile, enroll into the community, share expectations, attend personalized mentorship sessions, interact with mentors, use curated modules, and prepare until they get placed.'],
  ['What will be the qualifications of the mentors?', 'The mentor pool includes IIT and IIM alumni and experienced corporate professionals. Mentors are assigned based on the student profile, domain target, and registration details.'],
  ['How can I connect with my mentors?', 'After enrolling, students can choose domain experts, schedule meetings, email for support, and request additional sessions before interviews.'],
  ['Is this program suitable for 1st year or 2nd year MBA students?', 'Yes. First-year students can build foundation, profile, domain knowledge, and live project exposure early. Second-year students can sharpen interviews, resume quality, and placement readiness.'],
  ['Which domains are covered in the program?', 'The program covers Sales and Marketing, Finance and Investment Banking, Consulting, Product Management, Operations and Supply Chain, and Human Resources.'],
  ['What if I do not get placed after completing the program?', 'The promise is mentorship until placement. If a sincere student completes modules and keeps applying, mentors continue with mock interviews, off-campus referrals, and strategy sessions.'],
  ['Will I get help with both on-campus and off-campus placements?', 'Yes. The program covers campus placement preparation and also provides off-campus strategy and referrals through the corporate mentor network.']
];

const professionalAudienceCards: Array<[string, string, LucideIcon]> = [
  ['Career Switchers', 'Position your existing experience, bridge skill gaps, and move into a new function or industry without starting over.', Rocket],
  ['Promotion Seekers', 'Build leadership positioning, internal visibility, and a sharper growth narrative for senior roles.', TrendingUp],
  ['Top Company Aspirants', 'Prepare for MNC, consulting, finance, FMCG, tech, and startup hiring processes with insider guidance.', Building2],
  ['Off-Campus Job Hunters', 'Use LinkedIn, recruiter outreach, referrals, and targeted applications to reach hiring managers.', BriefcaseBusiness],
  ['Salary Negotiators', 'Benchmark your market value and negotiate stronger offers with mentor-tested scripts.', IndianRupee],
  ['Early-Career Professionals', 'Build the profile, skills, and network that can accelerate growth in your first five years.', Users]
];

const professionalWhyCards: Array<[string, string, LucideIcon]> = [
  ['Live 1-1 Expert Sessions', 'Dedicated sessions with an assigned IIM/IIT mentor. Real guidance, not pre-recorded content.', Video],
  ['On-Demand Support', 'Need help before an interview tomorrow? Request support without waiting for batch schedules.', Clock3],
  ['Mock Interviews & Feedback', 'Role-specific mock interviews with clear written feedback and improvement areas.', MessageCircle],
  ['LinkedIn Profile Overhaul', 'Profile rewrite, connection strategy, and content guidance to attract recruiter interest.', FileText],
  ['Personalized Career Roadmap', 'A customized 90-day action plan aligned with your target role, salary, and timeline.', TargetIcon],
  ['Corporate Referral Network', 'Off-campus referrals through mentors across top companies and high-growth startups.', Users],
  ['ATS Resume Building', 'Industry-grade resume writing with role-specific keywords and measurable impact.', FileText],
  ['Salary Negotiation Coaching', 'Market benchmarking, timing strategy, and practical negotiation scripts.', IndianRupee],
  ['Domain Interview Prep', 'Frameworks and question banks for Consulting, Finance, Marketing, PM, HR, and Operations.', Award]
];

const professionalAboutCards: Array<[string, string, LucideIcon]> = [
  ['Resume & LinkedIn', 'ATS-friendly CVs, LinkedIn overhaul, and keyword optimization', FileText],
  ['Mock Interviews', 'Live mock interviews with domain experts and role-specific feedback', MessageCircle],
  ['Mentor Referrals', 'Referral access through mentors across top companies and startups', Users],
  ['Career Strategy', 'Career roadmap, salary benchmarking, offer evaluation, and negotiation coaching', TargetIcon]
];

const professionalJourneySteps = [
  ['Week 1', 'Profile Assessment & Mentor Matching', 'Detailed intake to understand your background, target role, and timeline, then match you with the right mentor.'],
  ['Week 1-2', 'Resume & LinkedIn Rebuild', 'Rewrite your resume for ATS impact and rebuild LinkedIn with keywords that improve recruiter visibility.'],
  ['Week 2-4', 'Domain Prep & Interview Coaching', 'Deep-dive sessions for behavioral questions, technical concepts, case studies, and live mock interviews.'],
  ['Week 3-6', 'Applications & Referral Outreach', 'Targeted applications, mentor referrals, recruiter outreach, and LinkedIn messaging to reach the right people.'],
  ['Ongoing', 'Interview Support Until Offer', 'Pre-interview prep, final-round support, negotiation coaching, and mentorship until you sign the offer.']
];

const professionalModules: Array<[string, string[]]> = [
  ['Orientation & Career Clarity', ['Mentor introduction and expectation setting', 'Current role vs target role gap analysis', 'Domain discovery and 90-day roadmap']],
  ['Resume & LinkedIn Overhaul', ['ATS-optimized resume writing', 'Career-switch storytelling', 'LinkedIn headline, about section, and experience keywords']],
  ['Behavioral & HR Interview Mastery', ['Career narrative and STAR examples', 'Why this company and role', 'Salary expectations and leadership stories']],
  ['Domain-Specific Interview Preparation', ['Consulting cases and guesstimates', 'Finance, marketing, PM, operations, and HR prep', 'Role-specific technical Q&A']],
  ['Off-Campus Job Search Strategy', ['Target company mapping', 'LinkedIn and cold outreach strategy', 'Recruiter and headhunter conversations']],
  ['Mock Interviews & Feedback Reports', ['Two full-length mock interviews', 'Structured feedback reports', 'On-demand prep before live interview rounds']],
  ['Salary Negotiation & Offer Evaluation', ['Market value benchmarking', 'Counter-offer scripts', 'Fixed, variable, ESOP, and benefits evaluation']],
  ['Career Transition Playbook', ['Positioning a career switch', 'Transferable skill mapping', 'Handling no-direct-experience objections']]
];

const professionalProgramCards = [
  {
    applyUrl: 'https://rzp.io/l/2aPVBBYN',
    category: 'Corporate Placement - Flagship',
    deliverables: ['90-day career roadmap', 'ATS resume and LinkedIn rebuild', 'Mock interview feedback reports', 'Referral outreach plan'],
    duration: '4-8 weeks + support until offer',
    featured: true,
    goal: 'Career Switch',
    guideUrl: 'https://drive.google.com/file/d/1Kk3MQUYKduRu-LJKBsZ5tB0l1MqQO1zv/view?usp=sharing',
    id: 'off-campus-corporate-placement',
    outcomes: ['Position your experience for better roles', 'Improve recruiter callbacks', 'Prepare for technical and HR rounds', 'Negotiate offers with more confidence'],
    price: 'Rs. 12,999',
    oldPrice: 'Rs. 14,999',
    title: 'Off-Campus Corporate Placement Program',
    text: 'End-to-end mentorship for working professionals: resume, LinkedIn, mocks, domain prep, referrals, and negotiation.',
    features: ['1-1 dedicated IIM/IIT mentor', 'Resume and LinkedIn overhaul', 'Domain interview preparation', 'Referral and outreach strategy'],
    whoFor: 'Professionals targeting role upgrades, job switches, or better off-campus opportunities'
  },
  {
    applyUrl: 'https://rzp.io/l/2aPVBBYN',
    category: 'Focused Session',
    deliverables: ['Mentor call summary', 'Immediate action checklist', 'Next-step recommendation'],
    duration: 'Single focused session',
    price: 'Rs. 449',
    oldPrice: 'Rs. 999',
    goal: 'Career Clarity',
    guideUrl: 'https://drive.google.com/file/d/1Kk3MQUYKduRu-LJKBsZ5tB0l1MqQO1zv/view?usp=sharing',
    id: 'personalized-mentorship-session',
    outcomes: ['Make a faster career decision', 'Identify priority gaps', 'Get mentor feedback on one focused problem', 'Leave with clear next actions'],
    title: '1-1 Personalized Mentorship',
    text: 'One focused session for a specific question, mock interview, profile review, or career decision.',
    features: ['IIM/IIT mentor session', 'Specific guidance', 'Mock or profile review option', 'Fast decision support'],
    whoFor: 'Professionals who need quick guidance before an interview, switch, or profile decision'
  },
  {
    applyUrl: 'https://rzp.io/l/2aPVBBYN',
    category: 'Profile Building',
    deliverables: ['Profile gap audit', 'Resume positioning checklist', 'LinkedIn rewrite direction'],
    duration: '1-2 weeks',
    price: 'Rs. 2,499',
    oldPrice: 'Rs. 3,499',
    goal: 'Profile Building',
    guideUrl: 'https://drive.google.com/file/d/1Kk3MQUYKduRu-LJKBsZ5tB0l1MqQO1zv/view?usp=sharing',
    id: 'professional-profile-building',
    outcomes: ['Create a stronger career story', 'Improve resume clarity', 'Make LinkedIn recruiter-friendly', 'Identify projects or proof points to add'],
    title: 'Profile Building Program',
    text: 'Resume, LinkedIn, and profile audit for professionals who need a stronger job-search foundation.',
    features: ['Profile audit', 'LinkedIn rewrite', 'Resume positioning', 'Proof-point planning'],
    whoFor: 'Professionals whose resume or LinkedIn is not generating enough callbacks'
  },
  {
    applyUrl: 'https://rzp.io/l/2aPVBBYN',
    category: 'Interview Prep',
    deliverables: ['Mock interview report', 'Behavioral answer bank', 'Role-specific improvement plan'],
    duration: '1-3 weeks',
    goal: 'Interview Prep',
    guideUrl: 'https://drive.google.com/file/d/1Kk3MQUYKduRu-LJKBsZ5tB0l1MqQO1zv/view?usp=sharing',
    id: 'professional-interview-prep',
    outcomes: ['Answer behavioral questions with structure', 'Explain work experience with stronger impact', 'Prepare for final rounds', 'Reduce interview uncertainty'],
    price: 'Custom',
    title: 'Mock Interview & HR Preparation',
    text: 'Role-specific interview preparation for professionals with active shortlists or upcoming interviews.',
    features: ['Mock interview practice', 'STAR story building', 'Salary expectation handling', 'Final-round preparation'],
    whoFor: 'Professionals with interview calls, final rounds, or HR discussions coming up'
  },
  {
    applyUrl: 'https://rzp.io/l/2aPVBBYN',
    category: 'Negotiation',
    deliverables: ['Salary benchmark view', 'Negotiation script', 'Offer evaluation checklist'],
    duration: '3-7 days',
    goal: 'Salary Growth',
    guideUrl: 'https://drive.google.com/file/d/1Kk3MQUYKduRu-LJKBsZ5tB0l1MqQO1zv/view?usp=sharing',
    id: 'salary-negotiation-coaching',
    outcomes: ['Understand your compensation range', 'Handle recruiter conversations better', 'Compare fixed, variable, ESOPs and benefits', 'Negotiate without sounding risky'],
    price: 'Custom',
    title: 'Salary Negotiation Coaching',
    text: 'Offer evaluation and negotiation support for professionals moving to a new company or internal role.',
    features: ['Market benchmarking', 'Counter-offer strategy', 'Offer comparison', 'Negotiation scripts'],
    whoFor: 'Professionals with an offer, expected offer, or compensation discussion ahead'
  },
  {
    applyUrl: 'https://rzp.io/l/2aPVBBYN',
    category: 'Domain Prep',
    deliverables: ['Domain prep roadmap', 'Role Q&A map', 'Target company research template'],
    duration: '2-4 weeks',
    goal: 'Domain Prep',
    guideUrl: 'https://drive.google.com/file/d/1Kk3MQUYKduRu-LJKBsZ5tB0l1MqQO1zv/view?usp=sharing',
    id: 'domain-switch-preparation',
    outcomes: ['Translate past experience into the target role', 'Bridge knowledge gaps', 'Build role-specific interview answers', 'Create a credible switch story'],
    price: 'Custom',
    title: 'Domain Switch Preparation',
    text: 'Focused preparation for professionals moving into consulting, finance, product, marketing, HR, operations, or strategy roles.',
    features: ['Transferable skill mapping', 'Role-specific prep', 'Case or technical practice', 'Target company mapping'],
    whoFor: 'Professionals trying to switch function, industry, or role family'
  }
];

const professionalFaqs = [
  ['Who is this program for?', 'It is designed for working professionals at different career stages, including 0-2 years, 3-7 years, and 7+ years professionals targeting role upgrades, switches, or leadership moves.'],
  ['How is this different from a normal career coach?', 'The program combines IIM/IIT alumni mentorship, resume and LinkedIn work, interview preparation, salary negotiation, and referral support with mentorship continuing until you receive an offer.'],
  ['How long does the program take?', 'Most professionals see movement in 60-90 days of active engagement. The structured modules usually span 4-8 weeks, while on-demand support continues as needed.'],
  ['What if I do not get placed after completing modules?', 'Mentorship continues with additional mock interviews, off-campus referrals, and updated strategy sessions as long as you are sincerely applying and following the roadmap.'],
  ['Can this help with career switches?', 'Yes. The program helps professionals position transferable skills, bridge gaps, and tell a credible transition story for new industries or functions.'],
  ['How do referrals work?', 'When your profile and interview readiness are strong enough, mentors can refer you within their organizations or connect you with relevant professional networks.'],
  ['Can I do this while employed?', 'Yes. Sessions can be scheduled around work hours, and the program is designed for professionals who are currently employed.']
];

type LeadershipProgramTrack = {
  applyUrl: string;
  certificate: string;
  description: string;
  domain: 'Finance' | 'Marketing' | 'HR' | 'Consulting' | 'Product Management';
  duration: string;
  guideUrl: string;
  id: string;
  modules: Array<{
    items: string[];
    label: string;
    title: string;
  }>;
  outcomes: string[];
  project: string;
  role: string;
  targetRoles: string[];
  tools: string[];
};

const leadershipProgramTracks: LeadershipProgramTrack[] = [
  {
    applyUrl: 'https://pages.razorpay.com/pl_NEXRVaCYHtFRaM/view',
    certificate: 'ISO-Certified Program Certificate + Live Project Work Experience Certificate',
    description: 'Build institutional-grade financial models, decode annual reports, perform valuation, and create an equity research report on a real company.',
    domain: 'Finance',
    duration: '2-4 weeks',
    guideUrl: 'https://drive.google.com/file/d/1Kk3MQUYKduRu-LJKBsZ5tB0l1MqQO1zv/view?usp=sharing',
    id: 'equity-research-financial-modeling',
    modules: [
      { label: 'Tools', title: 'MS Excel Foundations', items: ['Excel overview, finance modeling best practices and core spreadsheet concepts', 'Data management, formulas and functions used by finance analysts', 'Pivot tables, charts and financial dashboards', 'Keyboard shortcuts, efficiency tools and clean workbook hygiene', 'Audit trail best practices so assumptions, links and calculations are easy to review'] },
      { label: 'Foundations', title: 'Equity Research and Investment Banking Overview', items: ['Valuation techniques and where they are used across finance roles', '3-statement DCF model architecture and structure of a financial model', 'Industry analysis, sector revenue drivers and business model mapping', 'How to read and decode a company annual report', 'What equity research, investment banking and asset management teams expect from analysts'] },
      { label: 'Modeling', title: 'Forecasting Financial Statements', items: ['Income statement and balance sheet forecasting logic', 'Revenue drivers by industry and operating cost assumptions', 'Capex schedule, depreciation, working capital and debt schedule', 'Interest calculations, circular references and model checks', 'Clean model formatting, assumptions sheet and audit trail'] },
      { label: 'DCF', title: 'DCF Valuation and Discount Rates', items: ['Enterprise value, equity value, intrinsic value and valuation flow', 'CAPM, beta, risk-free rate and equity risk premium', 'WACC calculation and cost of capital interpretation', 'FCFF, FCFE, terminal value and terminal growth assumptions', 'Sensitivity analysis and investment recommendation logic'] },
      { label: 'Comps', title: 'Relative Valuation and Ratio Analysis', items: ['Comparable company selection and trading multiples', 'EV/EBITDA, P/E, P/B, EV/Sales and industry-specific multiples', 'Liquidity, profitability, leverage and efficiency ratios', 'DuPont analysis on real companies', 'Equity research report structure and Word-based report writing'] },
      { label: 'Project', title: 'Self-Paced Live Equity Research Project', items: ['Individual submission of an assigned financial model on a real company', 'Build forecasts, valuation tabs and sensitivity tables', 'Write a complete equity research report with buy, sell or hold recommendation', 'Receive project review and feedback from a corporate mentor', 'Earn a separate live project completion certificate after successful submission'] },
      { label: 'Career', title: 'Finance Placement Readiness', items: ['Finance-focused resume building and LinkedIn profile mentorship', 'GD preparation for finance companies and analytical discussions', 'Personal interview preparation for ER, IB, AMC and finance roles', 'Finance technical question bank and mock interview practice', 'Company-specific preparation for investment banks, AMCs, Big 4 and NBFCs'] }
    ],
    outcomes: ['Build a 3-statement model', 'Write an equity research report', 'Explain valuation assumptions in interviews', 'Show verified finance project work on CV'],
    project: 'Individual financial model and equity research report on a live company with mentor review.',
    role: 'Equity Research & Financial Modeling',
    targetRoles: ['Equity Research Analyst', 'Investment Banking Analyst', 'Financial Analyst', 'Credit Analyst'],
    tools: ['Excel', 'DCF', 'Comps', 'Annual Reports', 'Ratio Analysis']
  },
  {
    applyUrl: 'https://pages.razorpay.com/pl_NEXRVaCYHtFRaM/view',
    certificate: 'ISO-Certified Program Certificate + Live Portfolio Project Certificate',
    description: 'Learn portfolio construction, asset allocation, risk management, derivatives basics, and quantitative strategy thinking for asset management roles.',
    domain: 'Finance',
    duration: '2-4 weeks',
    guideUrl: 'https://drive.google.com/file/d/1Kk3MQUYKduRu-LJKBsZ5tB0l1MqQO1zv/view?usp=sharing',
    id: 'portfolio-manager',
    modules: [
      { label: 'Foundations', title: 'Portfolio Management Fundamentals', items: ['Introduction to mentors, program structure and portfolio career landscape', 'Asset classes including equities, bonds, commodities, real estate and alternatives', 'Mutual funds, PMS, AIFs, hedge funds and ETFs', 'Investment philosophy, mandates and growth vs value styles', 'Regulatory environment, SEBI, AMFI and portfolio compliance basics'] },
      { label: 'Allocation', title: 'Modern Portfolio Theory and Asset Allocation', items: ['Markowitz portfolio theory and mean-variance optimization', 'Efficient frontier, capital market line and Sharpe ratio', 'Strategic vs tactical asset allocation decisions', 'Factor investing across value, momentum, quality and low volatility', 'Correlation, diversification and portfolio construction using Excel'] },
      { label: 'Risk', title: 'Risk Management and Quantitative Techniques', items: ['Market, credit, liquidity, concentration and operational risk', 'Value at Risk using parametric, historical and Monte Carlo approaches', 'Stress testing and scenario analysis for portfolios', 'Beta management, hedging strategies and drawdown control', 'Sortino ratio, max drawdown, Calmar ratio and risk-adjusted review'] },
      { label: 'Instruments', title: 'Fixed Income and Derivatives for Portfolio Managers', items: ['Bond pricing, duration, convexity and yield curve analysis', 'Credit ratings, spread analysis and fixed income portfolio construction', 'Futures, options, swaps and forwards fundamentals', 'Options Greeks and practical hedging concepts', 'Portfolio hedging using index futures and put options'] },
      { label: 'Quant', title: 'Quantitative and Algorithmic Investment Strategies', items: ['Quantitative finance and factor models including Fama-French thinking', 'Technical analysis, momentum and mean reversion strategies', 'Backtesting framework and strategy evaluation metrics', 'Excel or Python-based screening and backtesting orientation', 'Smart beta and systematic strategy design basics'] },
      { label: 'Project', title: 'Self-Paced Live Portfolio Construction Project', items: ['Build a multi-asset portfolio from scratch using real market data', 'Apply MPT, risk metrics and allocation frameworks on actual securities', 'Prepare a portfolio review report with recommendation logic', 'Get project review and detailed mentor feedback', 'Earn a separate live project certificate after successful completion'] },
      { label: 'Career', title: 'Portfolio Management Career Readiness', items: ['Resume and LinkedIn optimization for portfolio management and quant roles', 'Technical interview preparation across derivatives, risk and portfolio theory', 'GD and PI preparation for AMCs, hedge funds and NBFCs', 'CFA and NISM exam orientation and preparation tips', 'Company-specific preparation for AMC, PMS and quant roles'] }
    ],
    outcomes: ['Build a multi-asset portfolio', 'Understand allocation and risk metrics', 'Prepare for AMC and quant interviews', 'Create a portfolio review report'],
    project: 'Build and review a multi-asset portfolio using real market data, allocation logic and risk metrics.',
    role: 'Portfolio Manager',
    targetRoles: ['Portfolio Analyst', 'PMS Associate', 'Risk Analyst', 'Quantitative Analyst'],
    tools: ['Excel', 'MPT', 'VaR', 'Derivatives', 'Backtesting']
  },
  {
    applyUrl: 'https://pages.razorpay.com/pl_NEXRVaCYHtFRaM/view',
    certificate: 'ISO-Certified Program Certificate + Live Marketing Project Certificate',
    description: 'Master sales and marketing judgment through strategy frameworks, consumer insights, GTM execution, campaign thinking, and applied brand cases.',
    domain: 'Marketing',
    duration: '2-4 weeks',
    guideUrl: 'https://drive.google.com/file/d/1Kk3MQUYKduRu-LJKBsZ5tB0l1MqQO1zv/view?usp=sharing',
    id: 'sales-marketing-leadership',
    modules: [
      { label: 'Foundation', title: 'Program Orientation and Career Launchpad', items: ['Introduction to mentors, industry experts and Skilled Sapiens ecosystem', 'Program structure, learning journey and corporate expectations', 'Modern marketing careers and industry landscape', 'Professional mindset, communication and corporate etiquette'] },
      { label: 'Landscape', title: 'Marketing Mindset and Corporate Marketing Landscape', items: ['Sales, marketing and business growth functions', 'Career paths in brand, product, digital, growth, performance and research', 'What companies expect from marketing professionals', 'Creativity, consumer thinking and business acumen', 'Corporate marketing case discussions and campaign breakdowns'] },
      { label: 'Frameworks', title: 'Foundations of Marketing and Strategic Frameworks', items: ['STP, 4Ps, 3Cs, AIDA, sales funnel and Porter Five Forces', 'Branding, positioning and customer acquisition strategy', 'Market demand analysis and business growth drivers', 'Framework applications on real brands and companies', 'Case discussions on successful marketing campaigns'] },
      { label: 'Research', title: 'Market Research, Consumer Insights and GenAI', items: ['Market research methodologies and research execution', 'Qualitative and quantitative research techniques', 'Questionnaire design and data interpretation', 'Competitor benchmarking and consumer insight analysis', 'Using ChatGPT, Claude, Gemini and AI tools for research and marketing tasks'] },
      { label: 'Sales', title: 'B2B, B2C Sales and Customer Journey', items: ['Understanding B2B and B2C business models', 'Sales process, funnel stages and customer journey mapping', 'Customer relationship management and lifecycle thinking', 'Enterprise sales, account planning and consumer sales scenarios', 'Sales metrics, conversion levers and pipeline thinking'] },
      { label: 'Brand', title: 'Brand, Product Marketing and Campaign Planning', items: ['Brand positioning and communication strategy', 'Product marketing, messaging and launch planning', 'Integrated marketing communication planning', 'Campaign objective, creative idea and media/channel selection', 'Measuring campaign performance and learning from results'] },
      { label: 'Digital', title: 'Digital, Growth and Performance Marketing', items: ['SEO, SEM, analytics and content marketing basics', 'Growth experiments, acquisition channels and funnel optimization', 'Email marketing, WordPress and marketing tools overview', 'Performance metrics and reporting dashboards', 'Digital-first case discussions across brands and marketplaces'] },
      { label: 'Project', title: 'Self-Paced Live Marketing Project', items: ['Work on a real marketing or branding brief', 'Build a full recommendation deck with research and campaign strategy', 'Develop market research, benchmarking and feasibility analysis', 'Present to a mentor jury and receive professional feedback', 'Earn a separate live marketing project certificate'] },
      { label: 'Career', title: 'Sales and Marketing Placement Readiness', items: ['Marketing-focused resume and LinkedIn profile building', 'GD preparation, marketing case discussions and mock interviews', 'Company-specific preparation for brand, product, growth and sales roles', 'Interview stories around consumer insight, campaign thinking and GTM', 'Final project and credential positioning for placements'] }
    ],
    outcomes: ['Create a marketing strategy deck', 'Apply STP, 4Ps and GTM thinking', 'Build consumer insight and research capability', 'Prepare for marketing interviews'],
    project: 'Live marketing or branding project with research, campaign strategy and mentor jury presentation.',
    role: 'Sales & Marketing Leadership',
    targetRoles: ['Brand Marketing', 'Product Marketing', 'Growth Marketing', 'B2B Sales', 'Market Research'],
    tools: ['STP', '4Ps', 'AIDA', 'GTM', 'CRM']
  },
  {
    applyUrl: 'https://pages.razorpay.com/pl_NEXRVaCYHtFRaM/view',
    certificate: 'ISO-Certified Program Certificate + Live HR Project Certificate',
    description: 'Learn HRBP, talent acquisition, L&D, performance management, employer branding, people analytics, and real HR project execution.',
    domain: 'HR',
    duration: '2-4 weeks',
    guideUrl: 'https://drive.google.com/file/d/1Kk3MQUYKduRu-LJKBsZ5tB0l1MqQO1zv/view?usp=sharing',
    id: 'hr-leadership',
    modules: [
      { label: 'Foundation', title: 'Program Orientation and Detailed HR Role Overview', items: ['Introduction to mentors, industry experts and Skilled Sapiens ecosystem', 'Scope, functions and strategic importance of HR in organizations', 'TA, HRBP, L&D, talent management and analytics career paths', 'Employer expectations, competencies and success metrics', 'HR consulting role progression and growth opportunities'] },
      { label: 'TA', title: 'Recruitment and Talent Acquisition', items: ['End-to-end hiring lifecycle and workforce requisition planning', 'Sourcing channels, screening methods and shortlisting criteria', 'Interview coordination, candidate experience and offer process', 'Recruitment dashboards, funnel metrics and hiring conversion', 'Corporate case discussions on talent acquisition challenges'] },
      { label: 'HRBP', title: 'HR Business Partnering and Talent Management', items: ['HRBP role in aligning people strategy with business goals', 'Stakeholder management with managers and leadership teams', 'Talent management, succession planning and retention levers', 'Employee engagement and performance management systems', 'Handling workplace scenarios, escalation and communication'] },
      { label: 'L&D', title: 'Learning and Development Frameworks', items: ['Training needs analysis and learning calendar design', 'Competency mapping and skill-gap assessment', 'Designing learning interventions and workshop plans', 'Measuring training effectiveness and learner outcomes', 'L&D case studies for fast-growing teams'] },
      { label: 'Branding', title: 'Employer Branding and Employee Experience', items: ['Employer value proposition and talent communication', 'Campus hiring and employer branding campaigns', 'Culture-building initiatives and internal communication', 'Employee lifecycle touchpoints and experience design', 'Practical employer branding project examples'] },
      { label: 'Analytics', title: 'HR Analytics, Excel and Workflow Tools', items: ['Excel dashboards for recruitment and workforce tracking', 'Attrition, engagement and performance analytics basics', 'JIRA or workflow boards for HR task management', 'People data interpretation and HR reporting', 'Using HR metrics to make business recommendations'] },
      { label: 'Project', title: 'Live HR Project', items: ['Choose a project across recruitment, workforce planning, L&D or employer branding', 'Build process recommendations and dashboards where relevant', 'Submit a practical HR project output for mentor review', 'Receive feedback and verified CV points', 'Earn a separate live HR project certificate'] },
      { label: 'Career', title: 'HR Placement Readiness', items: ['HR-focused resume and LinkedIn positioning', 'HRBP, TA, L&D and HR analytics interview preparation', 'Scenario-based HR interview practice', 'GD-PI preparation and role-specific story building', 'Company-specific preparation for HR and people advisory roles'] }
    ],
    outcomes: ['Understand strategic HR workflows', 'Build HR dashboards and process thinking', 'Complete a live HR project', 'Prepare for HRBP, TA and L&D interviews'],
    project: 'Live HR project across recruitment, workforce planning, employer branding or learning systems.',
    role: 'HR Leadership',
    targetRoles: ['HRBP Associate', 'Talent Acquisition', 'L&D Associate', 'Employer Branding', 'HR Analytics'],
    tools: ['Excel', 'JIRA', 'HR Analytics', 'TA Funnel', 'L&D']
  },
  {
    applyUrl: 'https://pages.razorpay.com/pl_NEXRVaCYHtFRaM/view',
    certificate: 'ISO-Certified Program Certificate + Live Consulting Project Certificate',
    description: 'Learn how consultants structure problems, use frameworks, build recommendations, and present client-ready solutions through live case work.',
    domain: 'Consulting',
    duration: '2-4 weeks',
    guideUrl: 'https://drive.google.com/file/d/1Kk3MQUYKduRu-LJKBsZ5tB0l1MqQO1zv/view?usp=sharing',
    id: 'management-consulting-leadership',
    modules: [
      { label: 'Foundation', title: 'Program Orientation and Consulting Career Launchpad', items: ['Introduction to mentors, industry experts and Skilled Sapiens ecosystem', 'Program structure, learning journey and corporate expectations', 'How consulting firms work across Big 4, MBB, boutique and internal strategy teams', 'Consultant mindset, ownership and structured problem solving', 'Networking, personal branding and LinkedIn optimization for consulting careers'] },
      { label: 'Thinking', title: 'Consulting Fundamentals and Business Problem Solving', items: ['What management consulting is and types of consulting domains', 'Strategy, operations, marketing, HR, digital, financial advisory, risk and ESG consulting', 'Structured problem-solving and hypothesis-driven thinking', 'Issue trees, root cause analysis and stakeholder mapping', 'Consulting engagement lifecycle and deliverable standards'] },
      { label: 'Frameworks', title: 'Foundational Consulting Frameworks with Applications', items: ['3Cs, 4Ps, STP, SWOT, PESTEL and Porter Five Forces', 'Value chain analysis and business model mapping', 'BCG matrix, Ansoff matrix, MECE principle and issue structuring', 'Pyramid principle and executive storytelling', 'Pareto principle, prioritization and customer journey mapping'] },
      { label: 'Strategy', title: 'Advanced Consulting Frameworks and Strategic Decisions', items: ['Market entry, growth and expansion strategy', 'Pricing and revenue optimization', 'Go-to-market strategy and product launch frameworks', 'Profitability and cost reduction cases', 'M&A strategy, digital transformation and change management'] },
      { label: 'Cases', title: 'Case Study Discussion and Corporate Simulations', items: ['How to read, decode and structure business cases', 'Case structuring and hypothesis building', 'Consulting case interview approach and group case discussions', 'Industry cases across FMCG, e-commerce, SaaS, banking, manufacturing, healthcare and startups', 'Revenue growth, market expansion, profitability, turnaround and digital transformation cases'] },
      { label: 'Project', title: 'Live Consulting Engagement Simulation', items: ['Work in consulting teams on a simulated business engagement', 'Analyze market, customer, competitor and internal business data', 'Build insights, options and prioritized recommendations', 'Prepare a client-style consulting deck', 'Present to mentors and receive professional feedback'] },
      { label: 'Career', title: 'Consulting Placement Readiness', items: ['Consulting resume and LinkedIn positioning', 'Guesstimate practice and case interview preparation', 'Fit interview and behavioral story building', 'Company-specific preparation for MBB, Big 4, boutique and strategy teams', 'Project story preparation for interviews'] }
    ],
    outcomes: ['Structure ambiguous business problems', 'Use consulting frameworks practically', 'Build a client-style recommendation deck', 'Prepare for case interviews'],
    project: 'Live consulting engagement simulation with research, analysis, recommendations and mentor review.',
    role: 'Management Consulting Leadership',
    targetRoles: ['Management Consultant', 'Business Analyst', 'Strategy Analyst', 'Operations Consultant'],
    tools: ['MECE', 'Issue Trees', 'GTM', 'BCG Matrix', 'Pyramid Principle']
  },
  {
    applyUrl: 'https://pages.razorpay.com/pl_NEXRVaCYHtFRaM/view',
    certificate: 'ISO-Certified Program Certificate + Live Product Project Certificate',
    description: 'Build product thinking through discovery, customer research, PRDs, agile execution, analytics, GTM strategy, and a live product project.',
    domain: 'Product Management',
    duration: '2-4 weeks',
    guideUrl: 'https://drive.google.com/file/d/1Kk3MQUYKduRu-LJKBsZ5tB0l1MqQO1zv/view?usp=sharing',
    id: 'product-management-leadership',
    modules: [
      { label: 'Foundation', title: 'Product Management Mindset and Ecosystem', items: ['Introduction to mentors, industry experts and Skilled Sapiens ecosystem', 'Program structure, corporate expectations and learning journey', 'Product management roles and career landscape', 'Product thinking, ownership mindset and business acumen', 'How PMs work with engineering, design, marketing and business teams'] },
      { label: 'Discovery', title: 'Product Discovery and Customer Understanding', items: ['Identifying customer problems and pain points', 'User research, customer interviews and research synthesis', 'Consumer personas and customer journey mapping', 'Problem validation and product-market fit', 'Customer-centric product case discussions'] },
      { label: 'Strategy', title: 'Product Strategy, Market Sizing and GTM', items: ['STP, 4Ps, 3Cs, AIDA, TAM, SAM and SOM', 'GTM strategy, competitive analysis and positioning', 'Market demand analysis and business growth drivers', 'Framework applications on real brands and products', 'Product launch and campaign case discussions'] },
      { label: 'Execution', title: 'Product Development and Agile Execution', items: ['Product development lifecycle from discovery to launch', 'Agile, Scrum and sprint planning fundamentals', 'Writing PRDs, user stories and acceptance criteria', 'Stakeholder management and cross-functional coordination', 'Product execution simulations and team activities'] },
      { label: 'Analytics', title: 'Product Analytics and Data-Driven Decisions', items: ['Product metrics and KPI understanding', 'Retention, engagement and conversion metrics', 'A/B testing and experimentation basics', 'Product analytics dashboard interpretation', 'Corporate product analytics case discussions'] },
      { label: 'Project', title: 'Self-Paced Live Product Project', items: ['Work on real product and business problems', 'Build product strategy and GTM recommendations', 'Conduct product research, feature prioritization and market analysis', 'Prepare final product presentation and mentor review', 'Earn a separate live product project certificate'] },
      { label: 'Career', title: 'Product Placement Readiness', items: ['Resume and LinkedIn profile building for product roles', 'Product case interview preparation', 'PRD and product sense interview practice', 'Metrics, prioritization and stakeholder scenario questions', 'Project story and portfolio positioning for PM interviews'] }
    ],
    outcomes: ['Write PRDs and user stories', 'Analyze product metrics', 'Build a product strategy deck', 'Prepare for product case interviews'],
    project: 'Live product project covering research, feature prioritization, GTM recommendation and mentor review.',
    role: 'Product Management Leadership',
    targetRoles: ['Associate Product Manager', 'Product Analyst', 'Product Marketing', 'Growth Product'],
    tools: ['PRD', 'JTBD', 'PMF', 'Scrum', 'A/B Testing']
  }
];

const campusPillars: Array<[string, string, LucideIcon]> = [
  ['Campus to Corporate', 'Placement readiness, professional development, and industry-aligned skill building for students.', Building2],
  ['Campus to Business', 'Startup incubation, entrepreneurship support, and business exposure for student founders.', Rocket],
  ['Skill Development', 'Practical learning through live projects, real business problems, workshops, and certifications.', Award],
  ['Mentorship & Network', 'Continuous guidance from working professionals, founders, alumni, and corporate leaders.', Users]
];

const campusProcessSteps: Array<[string, string, string]> = [
  ['01', 'Partnership & Scope', 'Align with colleges, placement cells, clubs, or departments on goals, cohort size, domains, and event calendar.'],
  ['02', 'Student Onboarding', 'Introduce students to mentors, live projects, resources, community access, and career-interest mapping.'],
  ['03', 'Workshops & Mentorship', 'Deliver domain workshops, resume support, mock interviews, GD-PI preparation, and 1-1 mentor guidance.'],
  ['04', 'Live Projects & Networking', 'Connect students with real business problems, alumni, founders, and hiring networks for practical exposure.'],
  ['05', 'Reporting & Outcomes', 'Share participation, engagement, certificates, project outputs, and placement-readiness progress with partners.']
];

const campusPartnerCards: Array<[string, string, string[]]> = [
  ['Colleges & Universities', 'Institution-level partnerships for employability, workshops, projects, mentorship, and placement readiness.', ['MoU partnership', 'Semester calendar', 'Student outcome reports']],
  ['Student Clubs', 'Event, competition, summit, and live-project collaborations for student-led communities.', ['Sponsorship support', 'Club workshops', 'Campus ambassador tie-ups']],
  ['Placement Cells', 'End-to-end placement-preparation support so placement teams can focus on company outreach.', ['Resume days', 'Mock interviews', 'Company connect support']]
];

const campusOfferings: Array<[string, string, LucideIcon]> = [
  ['Industry Workshops', 'Finance, consulting, marketing, HR, product, operations, communication, and interview-prep sessions.', Video],
  ['Live Corporate Projects', 'Real company problem statements with mentor feedback, certificates, and portfolio-ready outputs.', BriefcaseBusiness],
  ['Placement Readiness', 'Resume building, LinkedIn optimization, GD-PI practice, mock interviews, and career strategy.', TargetIcon],
  ['Campus Ambassador Program', 'Leadership opportunities, event ownership, mentorship perks, and official recognition for selected students.', Trophy],
  ['Startup & Incubation Support', 'Founder mentorship, business-plan support, investor readiness, and startup ecosystem exposure.', Rocket],
  ['Sponsorship Support', 'Support for case competitions, hackathons, summits, annual fests, and flagship college events.', Handshake]
];

const campusFaqs = [
  ['Is there a cost for colleges to partner with Skilled Sapiens?', 'The core partnership can be structured accessibly. Some expert talks, resume workshops, or mock sessions may be supported at no direct cost, while larger batch-level programs are priced by scope.'],
  ['Can student clubs partner directly?', 'Yes. Student clubs, cultural committees, placement committees, and departmental societies can collaborate for events, workshops, competitions, and sponsorship support.'],
  ['Which colleges are eligible?', 'The initiative is open to colleges across India. Virtual and hybrid formats can support institutions outside major metro cities.'],
  ['What domains do mentors cover?', 'Mentors cover Finance, Consulting, Marketing, HR, Product, Operations, Startups, Entrepreneurship, and General Management.'],
  ['Can this support accreditation documentation?', 'Yes. Program reports, participation records, workshops, certificates, and outcome summaries can help institutions document industry-connect initiatives.'],
  ['How do we start?', 'A college, club, or placement representative can begin with a discovery call to define goals, timelines, student cohort, and partnership format.']
];

type BusinessConnectTrack = {
  audience: string;
  ctaLabel: string;
  ctaUrl: string;
  description: string;
  faqs: Array<[string, string]>;
  highlights: Array<[string, string, LucideIcon]>;
  id: 'incubation' | 'digibrand';
  outcomes: string[];
  process: Array<[string, string]>;
  services: Array<[string, string]>;
  title: string;
};

const businessConnectTracks: BusinessConnectTrack[] = [
  {
    audience: 'For student founders, early-stage startups, campus ventures, and entrepreneurs who need structure, mentorship, and execution support.',
    ctaLabel: 'Discuss Incubation Support',
    ctaUrl: 'mailto:businessconnect@skilledsapiens.com?subject=Incubation%20Centre%20Support',
    description:
      'A startup incubation pathway that helps founders validate ideas, sharpen business models, prepare pitch material, connect with mentors, and build early execution discipline.',
    faqs: [
      ['Who should choose Incubation Centre?', 'Choose this if you have an idea, startup, college venture, founder team, or business model that needs validation, mentorship, pitch support, or execution guidance.'],
      ['Is this only for registered startups?', 'No. Students and early-stage founders can begin even at the idea stage. The first goal is clarity: problem, customer, market, model, and next action.'],
      ['Can Skilled Sapiens help with investor readiness?', 'Yes. The incubation track can support pitch decks, founder narrative, financial assumptions, market sizing, and investor communication preparation.']
    ],
    highlights: [
      ['Idea Validation', 'Assess problem quality, target customer, market need, and practical feasibility before spending heavily.', TargetIcon],
      ['Founder Mentorship', 'Get guidance from mentors, professionals, founders, and business operators across strategy, finance, product, and marketing.', Users],
      ['Pitch & Funding Prep', 'Build investor-ready pitch material, sharpen business plans, and prepare for funding conversations.', TrendingUp],
      ['Execution Support', 'Create early roadmaps, operating cadence, intern support, and practical launch plans.', Rocket],
      ['Market & GTM Research', 'Understand competitors, target segments, pricing signals, and go-to-market channels before launch.', Search],
      ['Partnership Support', 'Explore college, mentor, talent, and business connects that can help the idea move beyond planning.', Handshake]
    ],
    id: 'incubation',
    outcomes: ['Clear problem and customer definition', 'Validated business model canvas', 'Pitch deck or founder presentation', 'Go-to-market roadmap', 'Mentor-reviewed execution plan', 'Talent and intern support options'],
    process: [
      ['Discover', 'Understand idea stage, founder goals, target market, and current blockers.'],
      ['Validate', 'Pressure-test customer problem, market size, competition, pricing, and feasibility.'],
      ['Build', 'Create pitch material, GTM plan, operating roadmap, and early execution documents.'],
      ['Connect', 'Introduce relevant mentors, talent support, college networks, and funding-readiness guidance.']
    ],
    services: [
      ['Startup idea assessment', 'Problem validation, customer persona, market context, and feasibility review.'],
      ['Business plan support', 'Business model canvas, revenue logic, pricing assumptions, and launch plan.'],
      ['Pitch deck preparation', 'Founder story, market opportunity, traction narrative, ask, and investor deck structure.'],
      ['Mentor and advisor connects', 'Relevant mentors for product, finance, marketing, operations, legal basics, and hiring.'],
      ['Talent pipeline', 'Interns and live-project contributors for research, marketing, content, product, and operations.'],
      ['Founder readiness', 'Presentation practice, investor Q&A prep, and strategic decision support.']
    ],
    title: 'Incubation Centre'
  },
  {
    audience: 'For startups, colleges, creators, SMEs, institutes, and businesses that need practical digital growth and brand execution support.',
    ctaLabel: 'Discuss DigiBrand Support',
    ctaUrl: 'mailto:businessconnect@skilledsapiens.com?subject=DigiBrand%20Business%20Support',
    description:
      'A digital brand and growth support track for teams that need websites, social content, campaigns, landing pages, UI-UX, lead generation, and execution help without building a large internal team.',
    faqs: [
      ['Who should choose DigiBrand?', 'Choose DigiBrand if your business needs digital presence, content, website, campaign, branding, or growth execution support.'],
      ['Can this support colleges and institutes too?', 'Yes. DigiBrand can support institute campaigns, event pages, landing pages, social media, admission/event creatives, and student community outreach.'],
      ['Is it strategy only or execution also?', 'It covers both. The team can help define the digital plan and then execute creatives, pages, campaigns, content, and reporting.']
    ],
    highlights: [
      ['Brand Presence', 'Improve the first impression through sharper positioning, visual consistency, and clear digital assets.', Award],
      ['Website & Landing Pages', 'Create simple, conversion-focused pages for campaigns, programs, events, and offers.', FileText],
      ['Campaign Execution', 'Run structured digital campaigns with content calendars, creatives, and performance tracking.', TrendingUp],
      ['Growth Team Support', 'Use Skilled Sapiens network and student talent for research, content, design, and marketing execution.', Handshake],
      ['SEO & Content Funnel', 'Build search-friendly page structure, content topics, lead magnets, and nurture assets for consistent discovery.', Search],
      ['Analytics & Reporting', 'Track campaign response, lead quality, content performance, and next-step improvements with simple reports.', CheckSquare]
    ],
    id: 'digibrand',
    outcomes: ['Sharper brand positioning', 'Website or landing-page roadmap', 'Social/content calendar', 'Campaign plan and creatives', 'Lead-generation funnel support', 'Performance review and next-step report'],
    process: [
      ['Audit', 'Review current website, social channels, brand assets, audience, offer, and conversion flow.'],
      ['Plan', 'Define target audience, content pillars, campaign channels, CTA strategy, and execution calendar.'],
      ['Create', 'Build pages, creatives, copy, posts, videos, email/WhatsApp assets, and campaign material.'],
      ['Optimize', 'Track performance, learn from user response, and improve creatives, messaging, and funnel steps.']
    ],
    services: [
      ['Website and landing pages', 'Campaign pages, service pages, event pages, lead forms, and conversion copy.'],
      ['Social media management', 'Content calendar, post ideas, captions, creatives, short-form content, and scheduling support.'],
      ['Digital marketing campaigns', 'Audience strategy, campaign assets, lead funnel setup, and performance review.'],
      ['Branding and design', 'Brand language, visual direction, presentation assets, brochures, and promotional creatives.'],
      ['UI-UX and product support', 'User-flow review, page structure, wireframes, and product storytelling.'],
      ['Research and content ops', 'Market research, competitor scan, SEO-friendly content drafts, and reporting support.']
    ],
    title: 'DigiBrand'
  }
];

type LiveProjectRole = {
  category: string;
  deliverables: string[];
  description: string;
  duration: string;
  guidelines: string[];
  highlights: string[];
  id: string;
  level: string;
  responsibilities: string[];
  skills: string[];
  title: string;
};

const liveProjectRoles: LiveProjectRole[] = [
  {
    category: 'Strategy',
    deliverables: ['Market opportunity map', 'Competitor benchmark', 'Growth recommendation deck'],
    description: 'Work with CEO office and leadership teams on strategic partnerships, market expansion, and growth opportunities.',
    duration: '4 weeks',
    guidelines: ['Use credible secondary research sources', 'Convert research into crisp business recommendations', 'Submit a presentation-ready final deck'],
    highlights: ['Leadership exposure', 'Strategy deck', 'Mentor reviews'],
    id: 'business-strategy-growth-partner',
    level: 'Intermediate',
    responsibilities: ['Identify new growth channels', 'Analyze markets, competitors, and customer segments', 'Create strategic partnership and expansion recommendations'],
    skills: ['Market Research', 'Strategy', 'Partnerships', 'Presentation'],
    title: 'Business Strategy & Growth Partner'
  },
  {
    category: 'Consulting',
    deliverables: ['Problem-solving workbook', 'Expansion strategy memo', 'Final consulting presentation'],
    description: 'Develop growth and expansion strategies for products, services, and business units using consulting-style frameworks.',
    duration: '4 weeks',
    guidelines: ['Structure every recommendation with clear assumptions', 'Use frameworks without making the work look templated', 'Show risks, tradeoffs, and implementation steps'],
    highlights: ['Case-style work', 'Framework practice', 'Consulting mentor'],
    id: 'growth-strategy-consultant',
    level: 'Intermediate',
    responsibilities: ['Frame business problems', 'Conduct industry and customer research', 'Build actionable growth roadmaps'],
    skills: ['Consulting', 'Growth Strategy', 'Problem Solving', 'Research'],
    title: 'Growth & Strategy Consultant'
  },
  {
    category: 'Product',
    deliverables: ['Product/brand audit', 'Campaign concept note', 'KPI dashboard outline'],
    description: 'Learn product strategy, brand positioning, roadmap design, campaign planning, KPI measurement, and market analysis.',
    duration: '4 weeks',
    guidelines: ['Anchor ideas in customer insight', 'Define measurable campaign or product KPIs', 'Use clear before/after positioning logic'],
    highlights: ['Brand strategy', 'Roadmap thinking', 'KPI planning'],
    id: 'product-brand-manager',
    level: 'Beginner friendly',
    responsibilities: ['Study brand and product positioning', 'Map customer segments and buyer journeys', 'Recommend campaign and roadmap improvements'],
    skills: ['Brand Strategy', 'Product Thinking', 'KPIs', 'Market Analysis'],
    title: 'Product & Brand Manager'
  },
  {
    category: 'Marketing',
    deliverables: ['GTM plan', 'Channel strategy', 'Campaign performance scorecard'],
    description: 'Work across B2B/B2C sales, SEO, SEM, digital campaigns, GTM strategy, product launch, pricing, and funnel design.',
    duration: '4 weeks',
    guidelines: ['Tie every channel to a funnel metric', 'Keep GTM recommendations practical for execution', 'Use clear target audience and pricing assumptions'],
    highlights: ['GTM strategy', 'Sales funnel', 'Campaign design'],
    id: 'sales-marketing-manager',
    level: 'Beginner friendly',
    responsibilities: ['Build go-to-market plans', 'Design campaign and sales funnel recommendations', 'Analyze digital and offline acquisition channels'],
    skills: ['Sales', 'GTM', 'SEO/SEM', 'Pricing'],
    title: 'Sales & Marketing Manager'
  },
  {
    category: 'Marketing',
    deliverables: ['Positioning brief', 'Buyer persona sheet', 'Launch communication plan'],
    description: 'Work on product positioning, messaging, competitive analysis, customer segmentation, launch planning, and sales enablement.',
    duration: '4 weeks',
    guidelines: ['Write positioning in simple customer language', 'Back personas with research signals', 'Create messaging that sales teams can actually use'],
    highlights: ['Messaging', 'Buyer personas', 'Launch plan'],
    id: 'product-marketing',
    level: 'Intermediate',
    responsibilities: ['Define buyer personas', 'Draft positioning and messaging', 'Create launch and sales enablement material'],
    skills: ['Product Marketing', 'Messaging', 'Persona Research', 'Launch Planning'],
    title: 'Product Marketing'
  },
  {
    category: 'Digital',
    deliverables: ['SEO audit', 'Performance campaign plan', 'Analytics summary'],
    description: 'Build practical exposure in SEO, SEM, performance marketing, campaign analytics, content strategy, and marketing automation.',
    duration: '4 weeks',
    guidelines: ['Prioritize recommendations by expected impact', 'Use measurable campaign goals', 'Separate content, technical, and paid-channel ideas'],
    highlights: ['SEO audit', 'Performance marketing', 'Analytics'],
    id: 'digital-marketing-specialist',
    level: 'Beginner friendly',
    responsibilities: ['Audit website and content opportunities', 'Plan paid and organic campaign ideas', 'Track campaign metrics and optimization levers'],
    skills: ['SEO', 'SEM', 'Analytics', 'Content Marketing'],
    title: 'Digital Marketing Specialist'
  },
  {
    category: 'HR',
    deliverables: ['HR policy benchmark', 'Talent process improvement plan', 'Employer branding ideas'],
    description: 'Work across recruitment, performance management, employer branding, learning and development, compensation, and HR operations.',
    duration: '4 weeks',
    guidelines: ['Balance employee experience with business practicality', 'Use simple HR metrics to evaluate recommendations', 'Keep policy suggestions implementation-ready'],
    highlights: ['Talent strategy', 'Employer branding', 'HR operations'],
    id: 'hr-manager',
    level: 'Beginner friendly',
    responsibilities: ['Analyze recruitment and talent processes', 'Suggest employer branding improvements', 'Create people-process recommendations'],
    skills: ['Recruitment', 'HR Strategy', 'Employer Branding', 'L&D'],
    title: 'HR Manager'
  },
  {
    category: 'Finance',
    deliverables: ['Company analysis note', 'Financial model structure', 'Equity research summary'],
    description: 'Learn Excel best practices, equity research report writing, company analysis, valuation, and financial modeling fundamentals.',
    duration: '4 weeks',
    guidelines: ['Show assumptions clearly in the model', 'Separate business analysis from valuation output', 'Use clean formatting and audit-friendly calculations'],
    highlights: ['Financial modeling', 'Valuation', 'Research report'],
    id: 'equity-research-financial-modeling',
    level: 'Intermediate',
    responsibilities: ['Analyze a public company', 'Build a financial model framework', 'Prepare an investment-style research summary'],
    skills: ['Excel', 'Valuation', 'Equity Research', 'Financial Modeling'],
    title: 'Equity Research & Financial Modeling'
  }
];

const liveProjectFaqs = [
  ['Who can apply for live projects?', 'MBA students, undergraduate students, freshers, and working professionals can apply. The role cards indicate which projects are beginner-friendly or intermediate.'],
  ['Will students get a certificate?', 'Yes. Students can receive a corporate accepted live project work experience certificate after completing the required work and submissions.'],
  ['Will there be mentor support?', 'Yes. The program includes corporate mentor guidance, reviews, recorded resources, and doubt support as part of the project journey.'],
  ['Can students choose their preferred role?', 'Yes. Students can browse available roles and apply based on their preferred domain or career goal. Final allocation may depend on fit and availability.'],
  ['How long do live projects take?', 'Most live projects are structured around a four-week execution window, with onboarding, mentor allocation, training, review, and final submission.']
];

function seededRandom(seed: number) {
  const value = Math.sin(seed) * 10000;
  return value - Math.floor(value);
}

function shuffleWithSeed<T>(items: T[], seed: number) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(seededRandom(seed + index * 97) * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function getWorkshopCalendar() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const previousMonthDays = new Date(year, month, 0).getDate();
  const monthSeed = year * 1009 + (month + 1) * 9176;
  const eventCount = 9 + Math.floor(seededRandom(monthSeed + 31) * 4);
  const chosenDays = shuffleWithSeed(
    Array.from({ length: daysInMonth }, (_, index) => index + 1),
    monthSeed + 101
  ).slice(0, eventCount).sort((a, b) => a - b);
  const monthlyWorkshops = shuffleWithSeed(workshopPool, monthSeed + 503);
  const monthlyTimes = shuffleWithSeed(workshopTimes, monthSeed + 811);

  const events = new Map<number, { time: string; title: string }>();
  chosenDays.forEach((day, index) => {
    events.set(day, {
      time: monthlyTimes[index % monthlyTimes.length],
      title: monthlyWorkshops[index]
    });
  });

  const days = Array.from({ length: 42 }, (_, index) => {
    const offsetDay = index - firstDay + 1;
    const inCurrentMonth = offsetDay >= 1 && offsetDay <= daysInMonth;
    const displayDay = offsetDay < 1 ? previousMonthDays + offsetDay : offsetDay > daysInMonth ? offsetDay - daysInMonth : offsetDay;

    return {
      day: displayDay,
      event: inCurrentMonth ? events.get(displayDay) : null,
      inCurrentMonth,
      isToday: inCurrentMonth && displayDay === today.getDate()
    };
  });

  return {
    days,
    monthLabel: today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  };
}

function getReturnPath(portal: ExplorePortal, state: unknown) {
  const fallback = portal === 'student' ? '/student' : '/guest';
  const from = typeof state === 'object' && state !== null ? (state as ExploreLocationState).from : undefined;
  if (!from || !from.startsWith(`/${portal}`) || from.startsWith(`/${portal}/explore`)) return fallback;
  return from;
}

function ComingSoonContent({ pageSlug }: { pageSlug: string }) {
  const title = explorePages.find((page) => page.slug === pageSlug)?.label ?? 'Explore';

  return (
    <section className="ss-section ss-section--white">
      <div className="ss-container">
        <div className="ss-placeholder">
          <span className="ss-eyebrow">Coming into LMS</span>
          <h1>{title}</h1>
          <p>
            This section is reserved for the matching Skilled Sapiens website content. For now, students can open the live
            website page while we convert the HTML into LMS-safe React content.
          </p>
          <a className="ss-button ss-button--primary" href={externalPageUrls[pageSlug] ?? 'https://skilledsapiens.com/'} rel="noreferrer" target="_blank">
            Open Website Page
            <ArrowRight size={16} />
          </a>
        </div>
      </div>
    </section>
  );
}

function StudentPlacementContent() {
  const domains = useMemo(() => ['All', ...new Set(studentPlacementPrograms.map((program) => program.domain))], []);
  const [activeDomain, setActiveDomain] = useState('All');
  const [selectedProgramId, setSelectedProgramId] = useState(studentPlacementPrograms[0]?.id ?? '');
  const [openFaq, setOpenFaq] = useState(0);
  const filteredPrograms = useMemo(
    () => studentPlacementPrograms.filter((program) => activeDomain === 'All' || program.domain === activeDomain),
    [activeDomain]
  );
  const selectedProgram = studentPlacementPrograms.find((program) => program.id === selectedProgramId) ?? filteredPrograms[0] ?? studentPlacementPrograms[0];
  const studentPlacementFaqs = [
    ['Which program should I choose?', 'Start with your immediate goal. If you are unsure about domain, choose the flagship bootcamp. If you already know your gap, pick a focused program like Resume, GD-PI, Finance, Marketing, or Consulting.'],
    ['Can I browse by domain?', 'Yes. Use the domain filters to compare programs by preparation area, then open the program card to see deliverables, outcomes, duration, and application action.'],
    ['Will I get mentor support?', 'Yes. The programs are designed around mentor-led preparation, feedback, and practical improvement rather than only static recordings.'],
    ['Can I download details before applying?', 'Yes. Each program has a Download Program JD action so students can review the structure before applying.'],
    ['Can this help with live projects too?', 'Yes. Students who need stronger profile proof points can use profile-building guidance and also browse Live Projects from the Explore navigation.']
  ];

  if (!selectedProgram) return null;

  return (
    <div className="ss-mba-page">
      <section className="ss-mba-hero">
        <div className="ss-container ss-mba-hero__grid">
          <div>
            <div className="ss-live-eyebrow">
              <span />
              MBA Students - Placement Mentorship
            </div>
            <h1>Browse the Right <strong>Placement Program</strong> for Your Goal</h1>
            <p>
              Choose a focused preparation path for resume shortlists, GD-PI, HR rounds, consulting cases, finance,
              marketing, or complete placement readiness with mentor-led support.
            </p>
            <div className="ss-live-actions">
              <a className="ss-button ss-button--primary" href="https://rzp.io/l/p0BR51nql7" rel="noreferrer" target="_blank">
                <GraduationCap size={16} />
                Apply for Mentorship
              </a>
              <a className="ss-button ss-button--ghost" href="#student-placement-programs">
                Browse Programs
              </a>
            </div>
            <div className="ss-live-proof">
              <div className="ss-live-avatars">
                <span>AK</span>
                <span>VY</span>
                <span>NA</span>
                <span>+K</span>
              </div>
              <p><b>2,000+ students</b> enrolled from IIMs, IITs and top B-Schools</p>
            </div>
          </div>

          <div className="ss-live-visual ss-mba-visual" aria-label="MBA placement program preview">
            <div className="ss-live-float ss-live-float--one">
              <Trophy size={22} />
              <div>
                <strong>Domain-led prep</strong>
                <span>resume, GD-PI, HR, finance, marketing and consulting</span>
              </div>
            </div>
            <div className="ss-live-card ss-live-project-card-preview">
              <span>Selected Program</span>
              <h2>{selectedProgram.title}</h2>
              <div>
                <strong>{selectedProgram.domain}</strong>
                <span>{selectedProgram.duration}</span>
              </div>
              <div className="ss-live-mentor">
                <span>{selectedProgram.price === 'Custom' ? 'Plan' : selectedProgram.price.replace('Rs. ', 'Rs')}</span>
                <div>
                  <strong>{selectedProgram.category}</strong>
                  <small>{selectedProgram.whoFor}</small>
                </div>
                <em><Star size={13} fill="currentColor" /> Mentor-led</em>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="ss-mba-stats ss-live-project-stats">
        <div className="ss-container">
          <div><strong>8</strong><span>Focused placement programs</span></div>
          <div><strong>6+</strong><span>Domains and prep tracks</span></div>
          <div><strong>1-1</strong><span>Mentor feedback where it matters</span></div>
          <div><strong>JD</strong><span>Program details before applying</span></div>
        </div>
      </section>

      <section className="ss-section ss-section--white" id="student-placement-programs">
        <div className="ss-container">
          <div className="ss-live-project-toolbar">
            <div>
              <span className="ss-eyebrow">Program Browser</span>
              <h2>Find the mentorship track that matches your placement goal</h2>
              <p>
                Filter by domain, compare deliverables, review outcomes, download the program JD, and apply from one
                place without losing context.
              </p>
            </div>
            <div className="ss-live-project-filters" aria-label="Filter placement programs by domain">
              {domains.map((domain) => (
                <button
                  className={activeDomain === domain ? 'is-active' : ''}
                  key={domain}
                  onClick={() => {
                    setActiveDomain(domain);
                    const nextProgram = studentPlacementPrograms.find((program) => domain === 'All' || program.domain === domain);
                    if (nextProgram) setSelectedProgramId(nextProgram.id);
                  }}
                  type="button"
                >
                  {domain}
                </button>
              ))}
            </div>
          </div>

          <div className="ss-live-project-browser">
            <aside className="ss-live-project-role-list" aria-label="Placement programs">
              {filteredPrograms.map((program) => (
                <button
                  className={selectedProgram.id === program.id ? 'is-active' : ''}
                  key={program.id}
                  onClick={() => setSelectedProgramId(program.id)}
                  type="button"
                >
                  <span>{program.category}</span>
                  <strong>{program.title}</strong>
                  <small>{program.whoFor}</small>
                  <em>{program.duration} / {program.price}</em>
                </button>
              ))}
            </aside>

            <article className="ss-live-project-detail">
              <header>
                <span>{selectedProgram.category} / {selectedProgram.domain}</span>
                <h2>{selectedProgram.title}</h2>
                <p>{selectedProgram.description}</p>
                <div>
                  <small><Clock3 size={14} /> {selectedProgram.duration}</small>
                  <small><IndianRupee size={14} /> {selectedProgram.price}</small>
                  <small><Users size={14} /> Mentor-led</small>
                </div>
              </header>

              <div className="ss-live-project-detail-grid">
                <section>
                  <h3>Who should choose this</h3>
                  <ul>
                    <li><TargetIcon size={15} />{selectedProgram.whoFor}</li>
                    <li><CheckSquare size={15} />Best when you want a focused, action-oriented prep plan.</li>
                  </ul>
                </section>
                <section>
                  <h3>What you will work on</h3>
                  <ul>
                    {selectedProgram.features.map((feature) => (
                      <li key={feature}><CheckSquare size={15} />{feature}</li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h3>Deliverables</h3>
                  <ul>
                    {selectedProgram.deliverables.map((deliverable) => (
                      <li key={deliverable}><FileText size={15} />{deliverable}</li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h3>Expected outcomes</h3>
                  <ul>
                    {selectedProgram.outcomes.map((outcome) => (
                      <li key={outcome}><Trophy size={15} />{outcome}</li>
                    ))}
                  </ul>
                </section>
              </div>

              <div className="ss-live-project-skill-cloud">
                {selectedProgram.features.map((feature) => (
                  <span key={feature}>{feature}</span>
                ))}
              </div>

              <footer>
                <a className="ss-button ss-button--primary" href={selectedProgram.applyUrl} rel="noreferrer" target="_blank">
                  Apply for This Program
                  <ArrowRight size={16} />
                </a>
                <a className="ss-button ss-button--ghost" href={selectedProgram.guideUrl} rel="noreferrer" target="_blank">
                  <Download size={16} />
                  Download Program JD
                </a>
              </footer>
            </article>
          </div>
        </div>
      </section>

      <section className="ss-section ss-section--soft">
        <div className="ss-container">
          <div className="ss-section-header">
            <span className="ss-eyebrow">How to Use This Page</span>
            <h2>A simple path from confusion to action</h2>
            <p>Students can move from program discovery to application without reading the same information again and again.</p>
          </div>
          <div className="ss-professional-timeline">
            {[
              ['01', 'Pick your domain', 'Use filters to narrow programs by resume, GD-PI, HR, consulting, finance, marketing, or all-domain preparation.'],
              ['02', 'Review the details', 'Open a program to check who it is for, what is included, deliverables, duration, price, and outcomes.'],
              ['03', 'Download the JD', 'Save the program details before applying, especially if you want to compare multiple preparation tracks.'],
              ['04', 'Apply or ask for guidance', 'Apply directly to the selected program or book a mentor discussion if you need help choosing.']
            ].map(([step, title, text]) => (
              <article key={step}>
                <span>{step}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="ss-section ss-section--white">
        <div className="ss-container ss-mba-two-col">
          <div>
            <span className="ss-eyebrow">Included Support</span>
            <h2>Useful help without repeating the same promise</h2>
            <div className="ss-mba-list-grid">
              {['Mentor-led preparation plan', 'Resume and profile feedback', 'Mock interview or GD practice', 'Domain-specific study direction', 'Application and shortlist strategy', 'Downloadable program JD'].map((item) => (
                <span key={item}><Check size={14} />{item}</span>
              ))}
            </div>
          </div>
          <div>
            <span className="ss-eyebrow">Need Clarity?</span>
            <h2>Book a quick mentor discussion before applying</h2>
            <p className="ss-muted-copy">
              If a student is unsure between multiple tracks, the best next step is a short discussion around profile,
              target roles, interview timeline, and current gaps.
            </p>
            <div className="ss-live-actions">
              <a className="ss-button ss-button--yellow" href="https://pages.razorpay.com/pl_KHT1uBN2IWoZlK/view" rel="noreferrer" target="_blank">
                Book Discussion
              </a>
              <a className="ss-button ss-button--ghost" href="https://rzp.io/l/p0BR51nql7" rel="noreferrer" target="_blank">
                Apply to Flagship
                <ArrowRight size={16} />
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="ss-section ss-section--soft">
        <div className="ss-container">
          <div className="ss-section-header">
            <span className="ss-eyebrow">FAQs</span>
            <h2>Before students apply</h2>
            <p>Short answers for choosing and applying to the right placement program.</p>
          </div>
          <div className="ss-faq-list">
            {studentPlacementFaqs.map(([question, answer], index) => (
              <article className={`ss-faq ${openFaq === index ? 'ss-faq--open' : ''}`} key={question}>
                <button onClick={() => setOpenFaq((current) => (current === index ? -1 : index))} type="button">
                  {question}
                  <span>{openFaq === index ? 'x' : '+'}</span>
                </button>
                <p>{answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function ProfessionalPlacementContent() {
  const goals = useMemo(() => ['All', ...new Set(professionalProgramCards.map((program) => program.goal))], []);
  const [activeGoal, setActiveGoal] = useState('All');
  const [selectedProgramId, setSelectedProgramId] = useState(professionalProgramCards[0]?.id ?? '');
  const [openFaq, setOpenFaq] = useState(0);
  const filteredPrograms = useMemo(
    () => professionalProgramCards.filter((program) => activeGoal === 'All' || program.goal === activeGoal),
    [activeGoal]
  );
  const selectedProgram = professionalProgramCards.find((program) => program.id === selectedProgramId) ?? filteredPrograms[0] ?? professionalProgramCards[0];
  const professionalPlacementFaqs = [
    ['Which track should I choose?', 'Choose the flagship program if you need end-to-end job switch support. Choose a focused track if your need is specific, like interview prep, profile building, salary negotiation, or domain switching.'],
    ['Can I use this while working full-time?', 'Yes. The tracks are designed for working professionals, with focused mentor sessions, practical assignments, and preparation that can fit around work hours.'],
    ['Can I download details before paying?', 'Yes. Each track includes a Download Program JD action so you can review the scope before applying.'],
    ['Will this help with referrals?', 'Referral support is strongest in the flagship path after the resume, LinkedIn, and interview readiness are improved enough for mentor outreach.'],
    ['Can this help with career switches?', 'Yes. The domain switch track focuses on transferable skills, role-specific preparation, and a credible story for new functions or industries.']
  ];

  if (!selectedProgram) return null;

  return (
    <div className="ss-mba-page ss-professional-page">
      <section className="ss-mba-hero ss-professional-hero">
        <div className="ss-container ss-mba-hero__grid">
          <div>
            <div className="ss-live-eyebrow">
              <span />
              For Working Professionals - IIM & IIT Mentors
            </div>
            <h1>Choose the Right <strong>Career Growth Track</strong></h1>
            <p>
              Browse mentorship tracks for job switches, profile building, interviews, referrals, domain transitions,
              and salary negotiation. Review the details first, then apply with clarity.
            </p>
            <div className="ss-live-actions">
              <a className="ss-button ss-button--primary" href="https://rzp.io/l/2aPVBBYN" rel="noreferrer" target="_blank">
                <BriefcaseBusiness size={16} />
                Apply for Mentorship
              </a>
              <a className="ss-button ss-button--ghost" href="#professional-programs">
                Browse Tracks
              </a>
            </div>
            <div className="ss-live-proof">
              <div className="ss-live-avatars">
                <span>RK</span>
                <span>PS</span>
                <span>AM</span>
                <span>+</span>
              </div>
              <p><b>500+ professionals</b> placed at top MNCs and funded startups in the last quarter</p>
            </div>
          </div>

          <div className="ss-live-visual ss-mba-visual" aria-label="Corporate placement program preview">
            <div className="ss-live-float ss-live-float--one">
              <Trophy size={22} />
              <div>
                <strong>Career-goal filters</strong>
                <span>switch, profile, interview, negotiation and domain prep</span>
              </div>
            </div>
            <div className="ss-live-card ss-live-project-card-preview">
              <span>Selected Track</span>
              <h2>{selectedProgram.title}</h2>
              <div>
                <strong>{selectedProgram.goal}</strong>
                <span>{selectedProgram.duration}</span>
              </div>
              <div className="ss-live-mentor">
                <span>{selectedProgram.price === 'Custom' ? 'Plan' : selectedProgram.price.replace('Rs. ', 'Rs')}</span>
                <div>
                  <strong>{selectedProgram.category}</strong>
                  <small>{selectedProgram.whoFor}</small>
                </div>
                <em><Star size={13} fill="currentColor" /> Mentor-led</em>
              </div>
            </div>
            <div className="ss-live-float ss-live-float--two">
              <TrendingUp size={22} />
              <div>
                <strong>60-90 Days</strong>
                <span>average transition window</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="ss-mba-stats ss-professional-stats ss-live-project-stats">
        <div className="ss-container">
          <div><strong>6</strong><span>Career growth tracks</span></div>
          <div><strong>1-1</strong><span>Mentor-led guidance</span></div>
          <div><strong>JD</strong><span>Track details before applying</span></div>
          <div><strong>60-90</strong><span>Day transition planning</span></div>
        </div>
      </section>

      <section className="ss-section ss-section--white" id="professional-programs">
        <div className="ss-container">
          <div className="ss-live-project-toolbar">
            <div>
              <span className="ss-eyebrow">Track Browser</span>
              <h2>Find the right path for your next career move</h2>
              <p>
                Filter by goal, compare tracks, check deliverables and outcomes, download the JD, and apply when the
                fit is clear.
              </p>
            </div>
            <div className="ss-live-project-filters" aria-label="Filter professional tracks by career goal">
              {goals.map((goal) => (
                <button
                  className={activeGoal === goal ? 'is-active' : ''}
                  key={goal}
                  onClick={() => {
                    setActiveGoal(goal);
                    const nextProgram = professionalProgramCards.find((program) => goal === 'All' || program.goal === goal);
                    if (nextProgram) setSelectedProgramId(nextProgram.id);
                  }}
                  type="button"
                >
                  {goal}
                </button>
              ))}
            </div>
          </div>

          <div className="ss-live-project-browser">
            <aside className="ss-live-project-role-list" aria-label="Professional career tracks">
              {filteredPrograms.map((program) => (
                <button
                  className={selectedProgram.id === program.id ? 'is-active' : ''}
                  key={program.id}
                  onClick={() => setSelectedProgramId(program.id)}
                  type="button"
                >
                  <span>{program.category}</span>
                  <strong>{program.title}</strong>
                  <small>{program.whoFor}</small>
                  <em>{program.duration} / {program.price}</em>
                </button>
              ))}
            </aside>

            <article className="ss-live-project-detail">
              <header>
                <span>{selectedProgram.category} / {selectedProgram.goal}</span>
                <h2>{selectedProgram.title}</h2>
                <p>{selectedProgram.text}</p>
                <div>
                  <small><Clock3 size={14} /> {selectedProgram.duration}</small>
                  <small><IndianRupee size={14} /> {selectedProgram.price}</small>
                  {selectedProgram.oldPrice ? <small><TrendingUp size={14} /> Usually {selectedProgram.oldPrice}</small> : null}
                </div>
              </header>

              <div className="ss-live-project-detail-grid">
                <section>
                  <h3>Who should choose this</h3>
                  <ul>
                    <li><TargetIcon size={15} />{selectedProgram.whoFor}</li>
                    <li><CheckSquare size={15} />Best when the next career move needs structured outside guidance.</li>
                  </ul>
                </section>
                <section>
                  <h3>What you will work on</h3>
                  <ul>
                    {selectedProgram.features.map((feature) => (
                      <li key={feature}><CheckSquare size={15} />{feature}</li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h3>Deliverables</h3>
                  <ul>
                    {selectedProgram.deliverables.map((deliverable) => (
                      <li key={deliverable}><FileText size={15} />{deliverable}</li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h3>Expected outcomes</h3>
                  <ul>
                    {selectedProgram.outcomes.map((outcome) => (
                      <li key={outcome}><Trophy size={15} />{outcome}</li>
                    ))}
                  </ul>
                </section>
              </div>

              <div className="ss-live-project-skill-cloud">
                {selectedProgram.features.map((feature) => (
                  <span key={feature}>{feature}</span>
                ))}
              </div>

              <footer>
                <a className="ss-button ss-button--primary" href={selectedProgram.applyUrl} rel="noreferrer" target="_blank">
                  Apply for This Track
                  <ArrowRight size={16} />
                </a>
                <a className="ss-button ss-button--ghost" href={selectedProgram.guideUrl} rel="noreferrer" target="_blank">
                  <Download size={16} />
                  Download Program JD
                </a>
              </footer>
            </article>
          </div>
        </div>
      </section>

      <section className="ss-section ss-section--soft">
        <div className="ss-container">
          <div className="ss-section-header">
            <span className="ss-eyebrow">How to Use This Page</span>
            <h2>A direct path from career problem to next action</h2>
            <p>Professionals can compare the tracks quickly and avoid reading the same mentorship promise in multiple forms.</p>
          </div>
          <div className="ss-professional-timeline">
            {[
              ['01', 'Choose your goal', 'Filter by career switch, profile building, interview prep, salary growth, domain prep, or clarity.'],
              ['02', 'Review fit', 'Open a track to see who it is for, duration, pricing, deliverables, and practical outcomes.'],
              ['03', 'Download details', 'Use the JD to compare tracks or discuss the scope internally before applying.'],
              ['04', 'Apply or book a call', 'Apply directly when the fit is clear, or book a mentor discussion if you are choosing between tracks.']
            ].map(([step, title, text]) => (
              <article key={step}>
                <span>{step}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="ss-section ss-section--white">
        <div className="ss-container ss-mba-two-col">
          <div>
            <span className="ss-eyebrow">Included Support</span>
            <h2>Practical support for the next move</h2>
            <div className="ss-mba-list-grid">
              {['Career roadmap and mentor matching', 'Resume and LinkedIn positioning', 'Mock interview or HR preparation', 'Domain switch story building', 'Referral and outreach direction', 'Salary negotiation support'].map((item) => (
                <span key={item}><Check size={14} />{item}</span>
              ))}
            </div>
          </div>
          <div>
            <span className="ss-eyebrow">Need Clarity?</span>
            <h2>Book a quick mentor discussion before applying</h2>
            <p className="ss-muted-copy">
              If a professional is unsure whether the gap is profile, interview, domain, or outreach, a quick mentor
              discussion can clarify the right track before payment.
            </p>
            <div className="ss-professional-cta-actions">
              <a className="ss-button ss-button--yellow" href="https://pages.razorpay.com/pl_KHT1uBN2IWoZlK/view" rel="noreferrer" target="_blank">
                Book Discovery Session
              </a>
              <a className="ss-button ss-button--ghost" href="https://wa.me/7417691944" rel="noreferrer" target="_blank">
                Chat on WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="ss-section ss-section--soft">
        <div className="ss-container">
          <div className="ss-mba-schedule">
            <h2>Want the full corporate placement path?</h2>
            <p>Choose the flagship track when you need resume, LinkedIn, interview prep, applications, referrals, and negotiation support together.</p>
            <div className="ss-professional-cta-actions">
              <a className="ss-button ss-button--primary" href="https://rzp.io/l/2aPVBBYN" rel="noreferrer" target="_blank">
                Apply to Flagship Track
                <ArrowRight size={16} />
              </a>
              <a className="ss-button ss-button--outline-light" href={selectedProgram.guideUrl} rel="noreferrer" target="_blank">
                <Download size={16} />
                Download JD
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="ss-section ss-section--white">
        <div className="ss-container">
          <div className="ss-section-header">
            <span className="ss-eyebrow">FAQs</span>
            <h2>Before professionals apply</h2>
            <p>Short answers for choosing and applying to the right career growth track.</p>
          </div>
          <div className="ss-faq-list">
            {professionalPlacementFaqs.map(([question, answer], index) => (
              <article className={`ss-faq ${openFaq === index ? 'ss-faq--open' : ''}`} key={question}>
                <button onClick={() => setOpenFaq((current) => (current === index ? -1 : index))} type="button">
                  {question}
                  <span>{openFaq === index ? 'x' : '+'}</span>
                </button>
                <p>{answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function LeadershipProgramsContent() {
  const domains = useMemo(() => ['Finance', 'Marketing', 'HR', 'Consulting', 'Product Management'], []);
  const domainIcons: Record<string, LucideIcon> = {
    Consulting: TargetIcon,
    Finance: IndianRupee,
    HR: Users,
    Marketing: TrendingUp,
    'Product Management': Rocket
  };
  const [activeDomain, setActiveDomain] = useState('Finance');
  const [selectedTrackId, setSelectedTrackId] = useState('equity-research-financial-modeling');
  const [openModule, setOpenModule] = useState(0);
  const [openFaq, setOpenFaq] = useState(0);
  const domainTracks = useMemo(
    () => leadershipProgramTracks.filter((track) => track.domain === activeDomain),
    [activeDomain]
  );
  const selectedTrack = leadershipProgramTracks.find((track) => track.id === selectedTrackId) ?? domainTracks[0] ?? leadershipProgramTracks[0];
  const leadershipFaqs = [
    ['Do I need to open different pages for each domain?', 'No. This LMS page keeps all Leadership Programs together. Students can switch Finance, Marketing, HR, Consulting and Product Management from tabs, then review the selected role, modules, project, outcomes and CTAs in one place.'],
    ['Why does Finance have two roles?', 'Finance has two separate career directions here: Equity Research and Financial Modeling, and Portfolio Management. Both follow the same program structure, but the modules, live project and target roles are different.'],
    ['What certificates are included?', 'Each track includes an ISO-certified program completion certificate. Students also receive a separate live project certificate after successful project submission and mentor review.'],
    ['What is the live project?', 'The live project is the applied part of the program. Students use the selected domain frameworks on a real or simulated business problem, create a final output, and get mentor feedback that can be converted into verified CV points.'],
    ['Are sessions live or recorded?', 'The program is built around live weekend mentor sessions on Zoom. Recordings and learning resources are provided for revision, so students can revisit sessions while working on the project.'],
    ['How long does a track take?', 'Most Leadership Programs are structured for 2-4 weeks, depending on cohort schedule and project submission timeline. The LMS page shows the duration for the selected track.'],
    ['Do I need prior experience in the domain?', 'No prior corporate experience is required for most student tracks. The modules begin with role overview and fundamentals, then move into frameworks, tools, live project work and placement preparation.'],
    ['How does placement support work?', 'Placement support includes resume and LinkedIn positioning, domain interview preparation, GD-PI or case practice where relevant, company-specific preparation, and guidance on how to explain the live project in interviews.'],
    ['Is the Letter of Recommendation guaranteed?', 'A Letter of Recommendation may be issued based on participation, project quality, mentor review and program performance. It should be treated as performance-based, not automatic.'],
    ['Which track should a confused student choose?', 'If the student is unsure, they should compare target roles first. Finance suits analytical roles, Consulting suits structured problem solving, Marketing suits brand/growth/sales roles, HR suits people strategy roles, and Product suits product discovery, execution and analytics roles.']
  ];

  if (!selectedTrack) return null;

  return (
    <div className="ss-mba-page ss-leadership-page">
      <section className="ss-mba-hero ss-leadership-hero">
        <div className="ss-container ss-mba-hero__grid">
          <div>
            <div className="ss-live-eyebrow">
              <span />
              Corporate Mentors Driven - ISO Certified
            </div>
            <h1>Leadership Programs Across <strong>5 Career Domains</strong></h1>
            <p>
              Build practical leadership capability in Finance, Marketing, HR, Consulting, or Product Management through
              mentor-led learning, domain modules, live project work, placement-focused outcomes, and certificates that
              help students show proof of applied skills.
            </p>
            <div className="ss-live-actions">
              <a className="ss-button ss-button--primary" href="#leadership-browser">
                <Search size={16} />
                Browse Domains
              </a>
              <a className="ss-button ss-button--ghost" href="#leadership-browser">
                View Track Details
              </a>
            </div>
            <div className="ss-live-tags">
              <span><Video size={14} />Live weekend sessions</span>
              <span><BriefcaseBusiness size={14} />Live project included</span>
              <span><Award size={14} />Two credentials</span>
            </div>
          </div>

          <div className="ss-live-visual ss-mba-visual" aria-label="Leadership program preview">
            <div className="ss-live-float ss-live-float--one">
              <GraduationCap size={22} />
              <div>
                <strong>5 domains</strong>
                <span>one guided program browser</span>
              </div>
            </div>
            <div className="ss-live-card ss-live-project-card-preview">
              <span>Leadership Programs</span>
              <h2>Mentor-Led Career Tracks</h2>
              <div>
                <strong>6 role tracks</strong>
                <span>domain modules + live project + placement readiness</span>
              </div>
              <div className="ss-live-mentor">
                <span>ISO</span>
                <div>
                  <strong>Two credentials for every track</strong>
                  <small>Program completion certificate + live project certificate</small>
                </div>
                <em><Star size={13} fill="currentColor" /> Mentor-led</em>
              </div>
            </div>
            <div className="ss-live-float ss-live-float--two">
              <Trophy size={22} />
              <div>
                <strong>Project proof</strong>
                <span>separate live project certificate</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="ss-mba-stats ss-live-project-stats">
        <div className="ss-container">
          <div><strong>5</strong><span>Career domains</span></div>
          <div><strong>6</strong><span>Role-focused tracks</span></div>
          <div><strong>2-4</strong><span>Week learning journey</span></div>
          <div><strong>2</strong><span>Certificates per track</span></div>
        </div>
      </section>

      <section className="ss-leadership-global-switch" aria-label="Leadership domain switch">
        <div className="ss-container">
          <div className="ss-leadership-global-switch__inner">
            <div className="ss-leadership-global-switch__header">
              <span className="ss-leadership-global-switch__label">Choose Your Leadership Domain</span>
              <p>Select a domain once, then browse the matching role track, modules, project, outcomes, and apply actions below.</p>
            </div>
            <div className="ss-leadership-global-switch__tabs" role="tablist" aria-label="Leadership domains">
              {domains.map((domain) => (
                (() => {
                  const DomainIcon = domainIcons[domain] ?? BriefcaseBusiness;
                  return (
                    <button
                      aria-selected={activeDomain === domain}
                      className={activeDomain === domain ? 'is-active' : ''}
                      key={domain}
                      onClick={() => {
                        setActiveDomain(domain);
                        const nextTrack = leadershipProgramTracks.find((track) => track.domain === domain);
                        if (nextTrack) setSelectedTrackId(nextTrack.id);
                        setOpenModule(0);
                        scrollExploreSectionIntoView('leadership-browser');
                      }}
                      role="tab"
                      type="button"
                    >
                      <DomainIcon size={16} />
                      <span>
                        <strong>{domain}</strong>
                      </span>
                    </button>
                  );
                })()
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="ss-section ss-section--white" id="leadership-browser">
        <div className="ss-container">
          <div className="ss-live-project-toolbar">
            <div>
              <span className="ss-eyebrow">Program Browser</span>
              <h2>Choose a domain first, then review the role track</h2>
              <p>
                The structure remains familiar across domains: mentor sessions, domain modules, live project,
                certification, placement readiness, and registration actions.
              </p>
            </div>
          </div>

          <div className="ss-live-project-browser ss-leadership-browser">
            <aside className="ss-live-project-role-list" aria-label="Leadership role tracks">
              {domainTracks.map((track) => (
                <button
                  className={selectedTrack.id === track.id ? 'is-active' : ''}
                  key={track.id}
                  onClick={() => {
                    setSelectedTrackId(track.id);
                    setOpenModule(0);
                  }}
                  type="button"
                >
                  <span>{track.domain}</span>
                  <strong>{track.role}</strong>
                  <small>{track.description}</small>
                  <em>{track.duration} / {track.modules.length} modules + live project</em>
                </button>
              ))}
            </aside>

            <article className="ss-live-project-detail">
              <header>
                <span>{selectedTrack.domain} Leadership Program</span>
                <h2>{selectedTrack.role}</h2>
                <p>{selectedTrack.description}</p>
                <div>
                  <small><Clock3 size={14} /> {selectedTrack.duration}</small>
                  <small><Video size={14} /> Live weekend sessions</small>
                  <small><Award size={14} /> ISO certified</small>
                </div>
              </header>

              <div className="ss-leadership-module-tabs" aria-label="Curriculum modules">
                {selectedTrack.modules.map((module, index) => (
                  <button
                    className={openModule === index ? 'is-active' : ''}
                    key={module.title}
                    onClick={() => setOpenModule(index)}
                    type="button"
                  >
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    {module.label}
                  </button>
                ))}
              </div>

              <section className="ss-leadership-module-panel">
                <span>Module {String(openModule + 1).padStart(2, '0')}</span>
                <h3>{selectedTrack.modules[openModule]?.title}</h3>
                <ul>
                  {selectedTrack.modules[openModule]?.items.map((item) => (
                    <li key={item}><CheckSquare size={15} />{item}</li>
                  ))}
                </ul>
              </section>

              <div className="ss-live-project-detail-grid">
                <section>
                  <h3>Live project</h3>
                  <ul>
                    <li><BriefcaseBusiness size={15} />{selectedTrack.project}</li>
                    <li><FileText size={15} />Mentor-reviewed output that can become CV proof.</li>
                  </ul>
                </section>
                <section>
                  <h3>Target roles</h3>
                  <ul>
                    {selectedTrack.targetRoles.map((role) => (
                      <li key={role}><TargetIcon size={15} />{role}</li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h3>Program outcomes</h3>
                  <ul>
                    {selectedTrack.outcomes.map((outcome) => (
                      <li key={outcome}><Trophy size={15} />{outcome}</li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h3>Placement readiness</h3>
                  <ul>
                    <li><Users size={15} />Resume, LinkedIn and interview positioning for the selected domain.</li>
                    <li><Check size={15} />Letter of recommendation may be issued based on performance.</li>
                  </ul>
                </section>
              </div>

              <div className="ss-live-project-skill-cloud">
                {selectedTrack.tools.map((tool) => (
                  <span key={tool}>{tool}</span>
                ))}
              </div>

              <footer>
                <a className="ss-button ss-button--primary" href={selectedTrack.applyUrl} rel="noreferrer" target="_blank">
                  Enroll in This Track
                  <ArrowRight size={16} />
                </a>
                <a className="ss-button ss-button--ghost" href={selectedTrack.guideUrl} rel="noreferrer" target="_blank">
                  <Download size={16} />
                  Download Detailed Curriculum
                </a>
              </footer>
            </article>
          </div>
        </div>
      </section>

      <section className="ss-section ss-section--soft">
        <div className="ss-container">
          <div className="ss-section-header">
            <span className="ss-eyebrow">How It Works</span>
            <h2>One shared journey across every leadership track</h2>
            <p>
              Students should not feel lost while comparing domains. Every Leadership Program follows the same journey,
              so the only decision is the domain and role they want to build proof for.
            </p>
          </div>
          <div className="ss-professional-timeline">
            {[
              ['01', 'Select domain and role', 'Start with the career direction. Finance students can choose Equity Research or Portfolio Manager, while Marketing, HR, Consulting and Product each have one focused leadership track.'],
              ['02', 'Understand the role landscape', 'The first modules explain what the role means in companies, what hiring teams expect, which skills matter, and what kind of work students will actually do.'],
              ['03', 'Learn tools and frameworks', 'Students then move into domain frameworks, tools and cases: DCF, portfolio risk, GTM, HR analytics, consulting issue trees, PRDs, product metrics and more.'],
              ['04', 'Apply learning in a live project', 'Each track includes a practical project where students build a model, deck, report, dashboard, strategy or product output that can be discussed in interviews.'],
              ['05', 'Convert work into placement proof', 'The program helps students convert the project into resume points, LinkedIn positioning, interview stories, GD-PI answers and role-specific confidence.']
            ].map(([step, title, text]) => (
              <article key={step}>
                <span>{step}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="ss-section ss-section--white">
        <div className="ss-container">
          <div className="ss-leadership-certificates">
            <span className="ss-eyebrow">Program USP</span>
            <h2>You Earn Two Certificates, Not Just One</h2>
            <p>
              The first certificate proves completion of the mentor-led curriculum. The second proves applied live
              project work, which is usually the stronger interview and CV signal.
            </p>
            <div>
              <article>
                <span>Certificate 1 of 2</span>
                <Award size={34} />
                <h3>ISO-Certified Program Completion Certificate</h3>
                <p>Issued after successful completion of live sessions and curriculum requirements. It adds a recognized, corporate-accepted learning credential to the student profile.</p>
              </article>
              <article className="is-featured">
                <span>Certificate 2 of 2</span>
                <BriefcaseBusiness size={34} />
                <h3>Live Project Work Experience Certificate</h3>
                <p>Issued after project submission and mentor review. It helps students show practical work, verified CV points, and a stronger story during placement interviews.</p>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="ss-section ss-section--white">
        <div className="ss-container ss-mba-two-col">
          <div>
            <span className="ss-eyebrow">Registration Process</span>
            <h2>Simple steps before the cohort starts</h2>
            <div className="ss-mba-list-grid">
              {['Choose your domain and role track', 'Download the detailed curriculum', 'Enroll or ask the coordinator for guidance', 'Attend orientation and mentor matching', 'Complete live sessions, project and submission'].map((item) => (
                <span key={item}><Check size={14} />{item}</span>
              ))}
            </div>
          </div>
          <div>
            <span className="ss-eyebrow">Program Guidelines</span>
            <h2>How students should complete the track</h2>
            <div className="ss-mba-list-grid">
              {['Attend live mentor sessions or review recordings', 'Complete assigned module work and project tasks', 'Use credible research, data and frameworks', 'Submit final project output before review deadline', 'Incorporate mentor feedback into the final version', 'Maintain professional communication with coordinator and mentors'].map((item) => (
                <span key={item}><CheckSquare size={14} />{item}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="ss-section ss-section--soft">
        <div className="ss-container">
          <div className="ss-mba-schedule ss-leadership-cta">
            <div>
              <h2>Need help choosing a leadership domain?</h2>
              <p>Students can browse the tabs first, then speak to the program team if they are unsure between finance, consulting, marketing, HR or product.</p>
            </div>
            <div className="ss-professional-cta-actions">
              <a className="ss-button ss-button--primary" href={selectedTrack.applyUrl} rel="noreferrer" target="_blank">
                Enroll in Selected Track
                <ArrowRight size={16} />
              </a>
              <a className="ss-button ss-button--light" href="https://wa.me/7417691944" rel="noreferrer" target="_blank">
                Chat with Coordinator
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="ss-section ss-section--white">
        <div className="ss-container">
          <div className="ss-section-header">
            <span className="ss-eyebrow">FAQs</span>
            <h2>Before students enroll</h2>
            <p>Short answers that help students compare tracks quickly.</p>
          </div>
          <div className="ss-faq-list">
            {leadershipFaqs.map(([question, answer], index) => (
              <article className={`ss-faq ${openFaq === index ? 'ss-faq--open' : ''}`} key={question}>
                <button onClick={() => setOpenFaq((current) => (current === index ? -1 : index))} type="button">
                  {question}
                  <span>{openFaq === index ? 'x' : '+'}</span>
                </button>
                <p>{answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function CampusConnectContent() {
  const [openFaq, setOpenFaq] = useState(0);
  const [form, setForm] = useState<CampusInquiryForm>(initialCampusInquiryForm);
  const [formMessage, setFormMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const queryClient = useQueryClient();
  const submitCampusInquiry = useMutation({
    mutationFn: (body: CampusInquiryForm) => apiPost('/public/campus-connect-inquiries', { body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['website-campus-inquiries'] });
    }
  });

  const updateForm = <TKey extends keyof CampusInquiryForm>(key: TKey, value: CampusInquiryForm[TKey]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleCampusInquirySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormMessage(null);
    try {
      await submitCampusInquiry.mutateAsync(form);
      setForm(initialCampusInquiryForm);
      setFormMessage({ tone: 'success', text: 'Thanks. Your partnership inquiry has been sent to the Skilled Sapiens team.' });
    } catch (error) {
      setFormMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Inquiry could not be submitted right now.' });
    }
  };

  return (
    <div className="ss-mba-page ss-campus-page">
      <section className="ss-mba-hero ss-campus-hero">
        <div className="ss-container ss-mba-hero__grid">
          <div>
            <div className="ss-live-eyebrow">
              <span />
              Campus Connect Initiative
            </div>
            <h1>Bridging Campus & <strong>Corporate India</strong></h1>
            <p>
              A flagship college partnership program by Skilled Sapiens, helping institutions, clubs, and admin bodies
              deliver real industry exposure, mentorship, and placement readiness to every student.
            </p>
            <div className="ss-live-actions">
              <a className="ss-button ss-button--primary" href="#campus-inquiry">
                <Handshake size={16} />
                Partner with Us
              </a>
              <a className="ss-button ss-button--ghost" href="https://skilledsapiens.my.canva.site/campus-connect-initiative" rel="noreferrer" target="_blank">
                <Download size={16} />
                Download Handbook
              </a>
            </div>
            <div className="ss-live-tags">
              <span><Building2 size={14} />100+ College Partners</span>
              <span><Users size={14} />50,000+ Students Impacted</span>
              <span><Award size={14} />ISO Certified Firm</span>
            </div>
          </div>

          <div className="ss-live-visual ss-mba-visual" aria-label="Campus Connect initiative preview">
            <div className="ss-live-float ss-live-float--one">
              <GraduationCap size={22} />
              <div>
                <strong>200+ Mentors</strong>
                <span>industry professionals</span>
              </div>
            </div>
            <div className="ss-live-card">
              <span>What Colleges Get</span>
              <h2>Complete Industry Readiness Ecosystem</h2>
              <div className="ss-live-pills">
                <strong>Live Projects</strong>
                <strong>Mentorship</strong>
                <strong>Workshops</strong>
                <strong>Placements</strong>
                <strong>Networking</strong>
                <strong>Leadership</strong>
              </div>
              <div className="ss-campus-metrics">
                {[
                  ['100+', 'Colleges'],
                  ['80+', 'Companies'],
                  ['95%', 'Satisfaction'],
                  ['10+', 'Domains']
                ].map(([value, label]) => (
                  <div key={label}>
                    <strong>{value}</strong>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="ss-live-float ss-live-float--two">
              <CalendarDays size={22} />
              <div>
                <strong>Onboarding Open</strong>
                <span>applications accepted now</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="ss-mba-stats ss-campus-stats">
        <div className="ss-container">
          <div><strong>100+</strong><span>College Partners</span></div>
          <div><strong>50K+</strong><span>Students Impacted</span></div>
          <div><strong>200+</strong><span>Corporate Mentors</span></div>
          <div><strong>80+</strong><span>Hiring Companies</span></div>
          <div><strong>10+</strong><span>Domains Covered</span></div>
        </div>
      </section>

      <section className="ss-section ss-section--soft">
        <div className="ss-container">
          <div className="ss-section-header">
            <span className="ss-eyebrow">Core Mission</span>
            <h2>Four Pillars of the Campus Connect Initiative</h2>
            <p>Every collaboration is built around outcomes that take students from classrooms to careers.</p>
          </div>
          <div className="ss-campus-pillar-grid">
            {campusPillars.map(([title, text, Icon], index) => (
              <article key={title}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <Icon size={26} />
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="ss-section ss-section--white">
        <div className="ss-container ss-professional-journey-grid">
          <div>
            <span className="ss-eyebrow">The Process</span>
            <h2>How the Initiative Works</h2>
            <p className="ss-campus-lead">A structured journey from partnership signing to student transformation, delivered with low operational load for the institution.</p>
          </div>
          <div className="ss-professional-timeline">
            {campusProcessSteps.map(([step, title, text]) => (
              <article key={title}>
                <span>Step {step}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="ss-section ss-section--soft" id="campus-partner">
        <div className="ss-container">
          <div className="ss-section-header">
            <span className="ss-eyebrow">Collaboration Partners</span>
            <h2>Who Can Partner with Us?</h2>
            <p>Campus Connect can be tailored for institutional bodies, student-led teams, and placement offices.</p>
          </div>
          <div className="ss-campus-partner-grid">
            {campusPartnerCards.map(([title, text, items]) => (
              <article key={title}>
                <h3>{title}</h3>
                <p>{text}</p>
                <div>
                  {items.map((item) => (
                    <span key={item}><Check size={13} />{item}</span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="ss-section ss-section--white">
        <div className="ss-container">
          <div className="ss-section-header">
            <span className="ss-eyebrow">Offerings</span>
            <h2>What Campus Connect Can Bring to Your Institution</h2>
            <p>Programs can be mixed and matched depending on the college calendar, batch profile, and target outcomes.</p>
          </div>
          <div className="ss-mba-why-grid">
            {campusOfferings.map(([title, text, Icon]) => (
              <article key={title}>
                <Icon size={22} />
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="ss-section ss-section--soft">
        <div className="ss-container ss-campus-sponsor">
          <div>
            <span className="ss-eyebrow">Sponsorship Support</span>
            <h2>We Sponsor Your Club & Committee Events</h2>
            <p>
              Whether you are organizing a case competition, annual fest, hackathon, or flagship summit, Skilled Sapiens
              can step in as a sponsorship and execution partner.
            </p>
            <a className="ss-button ss-button--primary" href="mailto:connect@skilledsapiens.com?subject=Campus%20Connect%20Partnership%20Inquiry">
              Get Sponsorship Support
              <ArrowRight size={16} />
            </a>
          </div>
          <div>
            {['Case Competitions', 'Hackathons', 'Annual Fests & Summits', 'Placement Drives', 'Panel Discussions', 'Business Plan Events'].map((item) => (
              <span key={item}><Trophy size={15} />{item}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="ss-section ss-section--white" id="campus-inquiry">
        <div className="ss-container ss-campus-form-section">
          <div className="ss-campus-form-copy">
            <span className="ss-eyebrow">Partnership Inquiry</span>
            <h2>Let's Build Something Useful for Your Students</h2>
            <p>Share a few details about your institution and the outcome you want. The team can review it directly from the LMS admin panel and respond with the right next step.</p>
            <div className="ss-campus-form-proof">
              {['Response within 24 hours', 'No-obligation initial discussion', 'Custom proposal for your institution', 'Flexible partnership structures'].map((item) => (
                <span key={item}><Check size={14} />{item}</span>
              ))}
            </div>
          </div>
          <form className="ss-campus-inquiry-form" onSubmit={handleCampusInquirySubmit}>
            <h3>Partner with Skilled Sapiens</h3>
            <div className="ss-campus-form-grid">
              <label>
                <span>Your name *</span>
                <input required onChange={(event) => updateForm('name', event.target.value)} placeholder="e.g. Dr. Rajesh Sharma" value={form.name} />
              </label>
              <label>
                <span>Designation *</span>
                <input required onChange={(event) => updateForm('designation', event.target.value)} placeholder="e.g. Placement Officer" value={form.designation} />
              </label>
              <label className="ss-campus-form-wide">
                <span>College / Institution name *</span>
                <input required onChange={(event) => updateForm('institutionName', event.target.value)} placeholder="e.g. Symbiosis Institute of Business Management" value={form.institutionName} />
              </label>
              <label>
                <span>Email address *</span>
                <input required onChange={(event) => updateForm('email', event.target.value)} placeholder="you@college.edu.in" type="email" value={form.email} />
              </label>
              <label>
                <span>Phone / WhatsApp *</span>
                <input required onChange={(event) => updateForm('phone', event.target.value)} placeholder="+91 XXXXX XXXXX" value={form.phone} />
              </label>
              <label>
                <span>Partner type *</span>
                <select required onChange={(event) => updateForm('partnerType', event.target.value)} value={form.partnerType}>
                  <option value="">Select partner type...</option>
                  {campusPartnerTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label>
                <span>Interested in *</span>
                <select required onChange={(event) => updateForm('interestedIn', event.target.value)} value={form.interestedIn}>
                  <option value="">Select primary interest...</option>
                  {campusInterestOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label className="ss-campus-form-wide">
                <span>Anything specific to share?</span>
                <textarea onChange={(event) => updateForm('message', event.target.value)} placeholder="Tell us about your student batch, timeline, specific domains, or any other requirement..." value={form.message} />
              </label>
            </div>
            {formMessage ? <p className={formMessage.tone === 'success' ? 'ss-campus-form-alert ss-campus-form-alert--success' : 'ss-campus-form-alert'}>{formMessage.text}</p> : null}
            <button className="ss-button ss-button--primary ss-campus-form-submit" disabled={submitCampusInquiry.isPending} type="submit">
              <ArrowRight size={16} />
              {submitCampusInquiry.isPending ? 'Sending Inquiry...' : 'Send Partnership Inquiry'}
            </button>
            <small>No spam. Just a thoughtful reply from our partnerships team.</small>
          </form>
        </div>
      </section>

      <section className="ss-section ss-section--white">
        <div className="ss-container">
          <div className="ss-section-header">
            <span className="ss-eyebrow">Why Partner</span>
            <h2>Designed for Student Outcomes and Institutional Reporting</h2>
            <p>Campus Connect gives students practical exposure while giving institutions clean documentation and measurable engagement.</p>
          </div>
          <div className="ss-mba-list-grid ss-campus-benefit-grid">
            {['Customized semester calendar', 'Student activity and workshop reports', 'Industry mentor feedback', 'Certificates for workshops and projects', 'Placement-readiness support', 'Cross-college community access', 'Startup and founder exposure', 'Sponsorship for flagship events'].map((item) => (
              <span key={item}><Check size={14} />{item}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="ss-section ss-section--soft">
        <div className="ss-container">
          <div className="ss-mba-schedule">
            <h2>Start the Campus Connect Journey for Your Institution</h2>
            <p>Join colleges already partnered with Skilled Sapiens. Download the handbook or reach out to the partnerships team.</p>
            <div className="ss-professional-cta-actions">
              <a className="ss-button ss-button--yellow" href="https://skilledsapiens.my.canva.site/campus-connect-initiative" rel="noreferrer" target="_blank">
                Download Handbook
              </a>
              <a className="ss-button ss-button--outline-light" href="#campus-inquiry">
                Partner with Us
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="ss-section ss-section--white">
        <div className="ss-container">
          <div className="ss-section-header">
            <span className="ss-eyebrow">FAQs</span>
            <h2>Frequently Asked Questions</h2>
            <p>Everything colleges, clubs, and placement teams need to know before starting.</p>
          </div>
          <div className="ss-faq-list">
            {campusFaqs.map(([question, answer], index) => (
              <article className={`ss-faq ${openFaq === index ? 'ss-faq--open' : ''}`} key={question}>
                <button onClick={() => setOpenFaq((current) => (current === index ? -1 : index))} type="button">
                  {question}
                  <span>{openFaq === index ? 'x' : '+'}</span>
                </button>
                <p>{answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function BusinessConnectContent() {
  const [activeTrackId, setActiveTrackId] = useState<BusinessConnectTrack['id']>('incubation');
  const [openFaq, setOpenFaq] = useState(0);
  const [form, setForm] = useState<BusinessInquiryForm>(initialBusinessInquiryForm);
  const [formMessage, setFormMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const queryClient = useQueryClient();
  const activeTrack = businessConnectTracks.find((track) => track.id === activeTrackId) ?? businessConnectTracks[0];
  const submitBusinessInquiry = useMutation({
    mutationFn: (body: BusinessInquiryForm) =>
      apiPost('/public/business-connect-inquiries', {
        body: {
          ...body,
          interestedIn: body.interestedIn || activeTrack.title,
          metadata: {
            businessTrack: activeTrack.id,
            businessTrackTitle: activeTrack.title
          }
        }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['website-campus-inquiries'] });
    }
  });

  const updateForm = <TKey extends keyof BusinessInquiryForm>(key: TKey, value: BusinessInquiryForm[TKey]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleBusinessInquirySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormMessage(null);
    try {
      await submitBusinessInquiry.mutateAsync(form);
      setForm(initialBusinessInquiryForm);
      setFormMessage({ tone: 'success', text: 'Thanks. Your Business Connect enquiry has been sent to the Skilled Sapiens team.' });
    } catch (error) {
      setFormMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Enquiry could not be submitted right now.' });
    }
  };

  return (
    <div className="ss-mba-page ss-business-connect-page">
      <section className="ss-mba-hero ss-business-hero">
        <div className="ss-container ss-mba-hero__grid">
          <div>
            <div className="ss-live-eyebrow">
              <span />
              Business Connect
            </div>
            <h1>Startup Support and <strong>Digital Growth</strong> in One Place</h1>
            <p>
              Explore Skilled Sapiens business initiatives through one simple page. Choose Incubation Centre for startup
              and founder support, or DigiBrand for digital brand, website, campaign, and growth execution support.
            </p>
            <div className="ss-live-tags">
              <span><Rocket size={14} />Founder support</span>
              <span><TrendingUp size={14} />Digital growth</span>
              <span><Users size={14} />Mentor and talent network</span>
            </div>
          </div>

          <div className="ss-live-visual ss-mba-visual" aria-label="Business Connect preview">
            <div className="ss-live-float ss-live-float--one">
              <TargetIcon size={22} />
              <div>
                <strong>Explore</strong>
                <span>two business paths</span>
              </div>
            </div>
            <div className="ss-live-card">
              <span>Business Connect</span>
              <h2>Support for Founders and Growth Teams</h2>
              <p>
                Use this page to understand both Skilled Sapiens business offerings: startup incubation for founders and
                digital growth support for brands, campaigns, websites, and execution teams.
              </p>
              <div className="ss-live-pills">
                {[
                  'Incubation Centre',
                  'DigiBrand',
                  'Mentor support',
                  'Startup validation',
                  'Website and campaigns',
                  'Growth execution'
                ].map((item) => (
                  <strong key={item}>{item}</strong>
                ))}
              </div>
            </div>
            <div className="ss-live-float ss-live-float--two">
              <Handshake size={22} />
              <div>
                <strong>Partner Ready</strong>
                <span>support via Skilled Sapiens</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="ss-business-global-switch" aria-label="Business Connect view switch">
        <div className="ss-container">
          <div className="ss-business-global-switch__inner">
            <div className="ss-business-global-switch__header">
              <span className="ss-business-global-switch__label">Choose Your Business Connect View</span>
              <p>Switch between the two Skilled Sapiens business offerings without leaving this page.</p>
            </div>
            <div className="ss-business-global-switch__tabs" role="tablist" aria-label="Business Connect views">
              {businessConnectTracks.map((track) => (
                <button
                  aria-selected={activeTrack.id === track.id}
                  className={activeTrack.id === track.id ? 'is-active' : ''}
                  key={track.id}
                  onClick={() => {
                    setActiveTrackId(track.id);
                    setOpenFaq(0);
                    scrollExploreSectionIntoView('business-track-details');
                  }}
                  role="tab"
                  type="button"
                >
                  {track.id === 'incubation' ? <Rocket size={16} /> : <TrendingUp size={16} />}
                  <span>
                    <strong>{track.title}</strong>
                    <small>{track.id === 'incubation' ? 'Startup, founder, and campus venture support' : 'Brand, website, campaign, and growth support'}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="ss-section ss-section--soft" id="business-track-details">
        <div className="ss-container ss-business-track-panel">
          <div className="ss-section-header">
            <span className="ss-eyebrow">{activeTrack.title}</span>
            <h2>{activeTrack.id === 'incubation' ? 'For founders who need structure before scale' : 'For teams that need digital execution without confusion'}</h2>
            <p>{activeTrack.audience}</p>
          </div>
          <div className="ss-mba-why-grid">
            {activeTrack.highlights.map(([title, text, Icon]) => (
              <article key={title}>
                <Icon size={22} />
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="ss-section ss-section--white">
        <div className="ss-container ss-business-services-grid">
          <div>
            <span className="ss-eyebrow">What You Can Explore</span>
            <h2>{activeTrack.title} support areas</h2>
            <p>Select the track above to view the relevant service areas, outcomes, process, and FAQs in one place.</p>
            <a className="ss-button ss-button--primary" href="#business-inquiry">
              {activeTrack.ctaLabel}
              <ArrowRight size={16} />
            </a>
          </div>
          <div className="ss-business-service-list">
            {activeTrack.services.map(([title, text]) => (
              <article key={title}>
                <Check size={16} />
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="ss-section ss-section--soft">
        <div className="ss-container ss-business-process-grid">
          <div>
            <span className="ss-eyebrow">How It Works</span>
            <h2>A simple journey from clarity to action</h2>
            <p>
              The goal is not to overload users with two separate pages. The toggle keeps both initiatives visible while
              showing only the selected track’s details.
            </p>
          </div>
          <div className="ss-professional-timeline">
            {activeTrack.process.map(([title, text], index) => (
              <article key={title}>
                <span>Step {String(index + 1).padStart(2, '0')}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="ss-section ss-section--white">
        <div className="ss-container">
          <div className="ss-section-header">
            <span className="ss-eyebrow">Expected Outcomes</span>
            <h2>What users can walk away with</h2>
            <p>Outcomes change based on the selected track, so founders and business teams can quickly find the right fit.</p>
          </div>
          <div className="ss-mba-list-grid ss-business-outcome-grid">
            {activeTrack.outcomes.map((item) => (
              <span key={item}><Check size={14} />{item}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="ss-section ss-section--soft" id="business-inquiry">
        <div className="ss-container ss-campus-form-section ss-business-form-section">
          <div className="ss-campus-form-copy">
            <span className="ss-eyebrow">{activeTrack.title} Enquiry</span>
            <h2>Tell Us What You Want to Build</h2>
            <p>
              Share a few details and the Skilled Sapiens team can review your selected Business Connect view from the
              admin panel before suggesting the right next step.
            </p>
            <div className="ss-campus-form-proof">
              {[
                activeTrack.id === 'incubation' ? 'Idea-stage and startup support' : 'Brand and growth execution support',
                'Response from the Business Connect team',
                'Clear next-step recommendation',
                'No-obligation discovery discussion'
              ].map((item) => (
                <span key={item}><Check size={14} />{item}</span>
              ))}
            </div>
          </div>
          <form className="ss-campus-inquiry-form" onSubmit={handleBusinessInquirySubmit}>
            <h3>Enquire for {activeTrack.title}</h3>
            <div className="ss-campus-form-grid">
              <label>
                <span>Your name *</span>
                <input required onChange={(event) => updateForm('name', event.target.value)} placeholder="e.g. Saurabh Sharma" value={form.name} />
              </label>
              <label>
                <span>Your role *</span>
                <input required onChange={(event) => updateForm('designation', event.target.value)} placeholder="e.g. Founder / Marketing Lead" value={form.designation} />
              </label>
              <label className="ss-campus-form-wide">
                <span>Company / Startup / Institution name *</span>
                <input required onChange={(event) => updateForm('institutionName', event.target.value)} placeholder="e.g. Skilled Sapiens Ventures" value={form.institutionName} />
              </label>
              <label>
                <span>Email address *</span>
                <input required onChange={(event) => updateForm('email', event.target.value)} placeholder="you@example.com" type="email" value={form.email} />
              </label>
              <label>
                <span>Phone / WhatsApp *</span>
                <input required onChange={(event) => updateForm('phone', event.target.value)} placeholder="+91 XXXXX XXXXX" value={form.phone} />
              </label>
              <label>
                <span>You are *</span>
                <select required onChange={(event) => updateForm('partnerType', event.target.value)} value={form.partnerType}>
                  <option value="">Select profile...</option>
                  {businessPartnerTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label>
                <span>Interested in *</span>
                <select required onChange={(event) => updateForm('interestedIn', event.target.value)} value={form.interestedIn}>
                  <option value="">Select primary need...</option>
                  {businessInterestOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label className="ss-campus-form-wide">
                <span>What support do you need?</span>
                <textarea onChange={(event) => updateForm('message', event.target.value)} placeholder="Tell us about your idea, brand, campaign, website, timeline, budget stage, or current blockers..." value={form.message} />
              </label>
            </div>
            {formMessage ? <p className={formMessage.tone === 'success' ? 'ss-campus-form-alert ss-campus-form-alert--success' : 'ss-campus-form-alert'}>{formMessage.text}</p> : null}
            <button className="ss-button ss-button--primary ss-campus-form-submit" disabled={submitBusinessInquiry.isPending} type="submit">
              <ArrowRight size={16} />
              {submitBusinessInquiry.isPending ? 'Sending Enquiry...' : `Send ${activeTrack.title} Enquiry`}
            </button>
            <small>No spam. Just a clear response from the Business Connect team.</small>
          </form>
        </div>
      </section>

      <section className="ss-section ss-section--white">
        <div className="ss-container">
          <div className="ss-section-header">
            <span className="ss-eyebrow">FAQs</span>
            <h2>{activeTrack.title} FAQs</h2>
            <p>Quick answers for the selected Business Connect track.</p>
          </div>
          <div className="ss-faq-list">
            {activeTrack.faqs.map(([question, answer], index) => (
              <article className={`ss-faq ${openFaq === index ? 'ss-faq--open' : ''}`} key={question}>
                <button onClick={() => setOpenFaq((current) => (current === index ? -1 : index))} type="button">
                  {question}
                  <span>{openFaq === index ? 'x' : '+'}</span>
                </button>
                <p>{answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function LiveProjectsContent() {
  const categories = useMemo(() => ['All', ...Array.from(new Set(liveProjectRoles.map((role) => role.category)))], []);
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedRoleId, setSelectedRoleId] = useState(liveProjectRoles[0]?.id ?? '');
  const [openFaq, setOpenFaq] = useState(0);

  const filteredRoles = activeCategory === 'All' ? liveProjectRoles : liveProjectRoles.filter((role) => role.category === activeCategory);
  const selectedRole = liveProjectRoles.find((role) => role.id === selectedRoleId) ?? filteredRoles[0] ?? liveProjectRoles[0];

  return (
    <div className="ss-mba-page ss-live-project-page">
      <section className="ss-mba-hero ss-live-project-hero">
        <div className="ss-container ss-mba-hero__grid">
          <div>
            <div className="ss-live-eyebrow">
              <span />
              Profile Building-cum-Live Project Program
            </div>
            <h1>Browse and Apply for <strong>Live Project Roles</strong></h1>
            <p>
              Explore real corporate live projects across strategy, marketing, product, HR, finance, and digital domains.
              Review the JD, guidelines, skills, deliverables, and apply to the role that fits your career goal.
            </p>
            <div className="ss-live-actions">
              <a className="ss-button ss-button--primary" href="#live-project-roles">
                <Search size={16} />
                Browse Roles
              </a>
              <a className="ss-button ss-button--ghost" href="https://drive.google.com/file/d/1Kk3MQUYKduRu-LJKBsZ5tB0l1MqQO1zv/view?usp=sharing" rel="noreferrer" target="_blank">
                <Download size={16} />
                Download Detailed JD
              </a>
            </div>
            <div className="ss-live-tags">
              <span><BriefcaseBusiness size={14} />8 open role tracks</span>
              <span><Users size={14} />Personal corporate mentor</span>
              <span><Award size={14} />Certificate & LOR eligible</span>
            </div>
          </div>

          <div className="ss-live-visual ss-mba-visual" aria-label="Live project marketplace preview">
            <div className="ss-live-float ss-live-float--one">
              <Trophy size={22} />
              <div>
                <strong>4000+</strong>
                <span>students onboarded in 3 years</span>
              </div>
            </div>
            <div className="ss-live-card">
              <span>Available Role Tracks</span>
              <h2>Choose a project that builds your resume story</h2>
              <div className="ss-live-pills">
                <strong>Strategy</strong>
                <strong>Marketing</strong>
                <strong>Product</strong>
                <strong>Digital</strong>
                <strong>HR</strong>
                <strong>Finance</strong>
              </div>
              <div className="ss-live-project-card-preview">
                <strong>{selectedRole.title}</strong>
                <span>{selectedRole.category} - {selectedRole.duration} - {selectedRole.level}</span>
              </div>
            </div>
            <div className="ss-live-float ss-live-float--two">
              <Clock3 size={22} />
              <div>
                <strong>4 Weeks</strong>
                <span>guided project execution</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="ss-mba-stats ss-live-project-stats">
        <div className="ss-container">
          <div><strong>4000+</strong><span>Students onboarded across live projects</span></div>
          <div><strong>8</strong><span>Live project role tracks available</span></div>
          <div><strong>4</strong><span>Week guided project roadmap</span></div>
          <div><strong>1-1</strong><span>Corporate mentor allocation</span></div>
        </div>
      </section>

      <section className="ss-section ss-section--soft" id="live-project-roles">
        <div className="ss-container">
          <div className="ss-live-project-toolbar">
            <div>
              <span className="ss-eyebrow">Open Live Project Roles</span>
              <h2>Browse roles by domain</h2>
              <p>Select a role to view JD, responsibilities, guidelines, skills, and application action.</p>
            </div>
            <div className="ss-live-project-filters" aria-label="Live project category filters">
              {categories.map((category) => (
                <button
                  className={activeCategory === category ? 'is-active' : ''}
                  key={category}
                  onClick={() => {
                    setActiveCategory(category);
                    const firstRole = category === 'All' ? liveProjectRoles[0] : liveProjectRoles.find((role) => role.category === category);
                    if (firstRole) setSelectedRoleId(firstRole.id);
                  }}
                  type="button"
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          <div className="ss-live-project-browser">
            <div className="ss-live-project-role-list">
              {filteredRoles.map((role) => (
                <button
                  className={selectedRole.id === role.id ? 'is-active' : ''}
                  key={role.id}
                  onClick={() => setSelectedRoleId(role.id)}
                  type="button"
                >
                  <span>{role.category}</span>
                  <strong>{role.title}</strong>
                  <small>{role.duration} - {role.level}</small>
                  <em>{role.highlights.join(' / ')}</em>
                </button>
              ))}
            </div>

            <article className="ss-live-project-detail">
              <header>
                <span>{selectedRole.category}</span>
                <h2>{selectedRole.title}</h2>
                <p>{selectedRole.description}</p>
                <div>
                  <small>{selectedRole.duration}</small>
                  <small>{selectedRole.level}</small>
                  <small>Mentor reviewed</small>
                </div>
              </header>

              <div className="ss-live-project-detail-grid">
                <section>
                  <h3>Responsibilities</h3>
                  <ul>
                    {selectedRole.responsibilities.map((item) => (
                      <li key={item}><Check size={14} />{item}</li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h3>Project Guidelines</h3>
                  <ul>
                    {selectedRole.guidelines.map((item) => (
                      <li key={item}><CheckSquare size={14} />{item}</li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h3>Final Deliverables</h3>
                  <ul>
                    {selectedRole.deliverables.map((item) => (
                      <li key={item}><FileText size={14} />{item}</li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h3>Skills You Will Build</h3>
                  <div className="ss-live-project-skill-cloud">
                    {selectedRole.skills.map((skill) => (
                      <span key={skill}>{skill}</span>
                    ))}
                  </div>
                </section>
              </div>

              <footer>
                <a className="ss-button ss-button--primary" href="https://rzp.io/l/0CYiRDJgY" rel="noreferrer" target="_blank">
                  Apply for This Role
                  <ArrowRight size={16} />
                </a>
                <a className="ss-button ss-button--ghost" href="https://drive.google.com/file/d/1Kk3MQUYKduRu-LJKBsZ5tB0l1MqQO1zv/view?usp=sharing" rel="noreferrer" target="_blank">
                  View Detailed JD
                </a>
              </footer>
            </article>
          </div>
        </div>
      </section>

      <section className="ss-section ss-section--white">
        <div className="ss-container ss-professional-journey-grid">
          <div>
            <span className="ss-eyebrow">Roadmap</span>
            <h2>Roadmap to build your dream profile</h2>
            <p className="ss-campus-lead">
              The live project journey is designed to convert interest into tangible resume proof through mentor allocation,
              structured training, project execution, review, and final certification.
            </p>
          </div>
          <div className="ss-professional-timeline">
            {[
              ['01', 'Registration Process', 'Fill the registration form, pay the fee, and submit your preferred domain or role through the online portal.'],
              ['02', 'Onboarding Phase', 'A program manager collects your CV, expectations, timeline, and preferred live project domain.'],
              ['03', 'Allocation of Mentor', 'After evaluation, you are allocated a personal mentor and project role in your chosen domain.'],
              ['04', 'Training & Review', 'Attend live workshops, execute the project, receive mentor feedback, and prepare your final submission.']
            ].map(([step, title, text]) => (
              <article key={title}>
                <span>Step {step}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="ss-section ss-section--soft">
        <div className="ss-container ss-mba-two-col">
          <div>
            <span className="ss-eyebrow">Program Inclusions</span>
            <h2>What students get with live projects</h2>
            <div className="ss-mba-list-grid">
              {['Resume building mentorship', 'Applied corporate live project', 'On-demand 1-1 doubt sessions', 'Access to Skilled Community Group', '1-1 live corporate expert sessions', 'Corporate case studies based on real situations', 'Recorded sessions and previous workshops', 'Industry accepted LOR and mentor referrals', 'Exclusive e-books and compendiums', 'Live project work experience certificate'].map((item) => (
                <span key={item}><Check size={14} />{item}</span>
              ))}
            </div>
          </div>
          <div>
            <span className="ss-eyebrow">Profile Outcomes</span>
            <h2>By completing a live project, students can:</h2>
            <div className="ss-mba-outcomes">
              {['Build credible resume proof in a chosen domain', 'Work on corporate case studies and practical business problems', 'Get structured mentor feedback on project work', 'Improve interview stories with real project examples', 'Strengthen domain confidence before placements', 'Network with peers, mentors, entrepreneurs, and professionals'].map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="ss-section ss-section--white">
        <div className="ss-container">
          <div className="ss-mba-schedule">
            <h2>Corporate Live Projects & Profile Building Program</h2>
            <p>Work on live projects and learn from corporate mentors across McKinsey, BCG, Bain, Deloitte, PwC, HUL, Asian Paints, and more.</p>
            <div className="ss-professional-cta-actions">
              <a className="ss-button ss-button--yellow" href="https://rzp.io/l/0CYiRDJgY" rel="noreferrer" target="_blank">
                Apply Now
              </a>
              <a className="ss-button ss-button--outline-light" href="https://drive.google.com/file/d/1Kk3MQUYKduRu-LJKBsZ5tB0l1MqQO1zv/view?usp=sharing" rel="noreferrer" target="_blank">
                Download Detailed JD
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="ss-section ss-section--soft">
        <div className="ss-container">
          <div className="ss-section-header">
            <span className="ss-eyebrow">FAQs</span>
            <h2>Frequently Asked Questions</h2>
            <p>Everything students need to know before applying for a live project role.</p>
          </div>
          <div className="ss-faq-list">
            {liveProjectFaqs.map(([question, answer], index) => (
              <article className={`ss-faq ${openFaq === index ? 'ss-faq--open' : ''}`} key={question}>
                <button onClick={() => setOpenFaq((current) => (current === index ? -1 : index))} type="button">
                  {question}
                  <span>{openFaq === index ? 'x' : '+'}</span>
                </button>
                <p>{answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function HomeContent() {
  const [openFaq, setOpenFaq] = useState(0);
  const calendar = getWorkshopCalendar();

  return (
    <>
      <section className="ss-live-hero">
        <div className="ss-container ss-live-hero__grid">
          <div className="ss-live-hero__copy">
            <div className="ss-live-eyebrow">
              <span />
              IIM & IIT Alumni Network - Est. 2018
            </div>
            <h1>
              India's Most Trusted
              <strong>Career Ecosystem</strong>
              for Ambitious Minds
            </h1>
            <p>
              From <b>campus placement</b> to <b>corporate growth</b> to <b>startup launch</b>, Skilled Sapiens is the complete ecosystem where students, early professionals, and entrepreneurs connect with industry leaders who have walked the path.
            </p>
            <div className="ss-live-actions">
              <a className="ss-button ss-button--primary" href="#skilled-sapiens-ecosystem">
                Join the Ecosystem
                <ArrowRight size={16} />
              </a>
            </div>
            <div className="ss-live-tags">
              <span><GraduationCap size={15} /> Students</span>
              <span><BriefcaseBusiness size={15} /> Professionals</span>
              <span><Rocket size={15} /> Entrepreneurs</span>
            </div>
            <div className="ss-live-proof">
              <div className="ss-live-avatars">
                <span>AK</span>
                <span>PS</span>
                <span>RV</span>
                <span>MJ</span>
              </div>
              <p><b>10K+</b> members placed at top firms like McKinsey, Amazon & Goldman Sachs</p>
            </div>
          </div>

          <div className="ss-live-visual" aria-label="Skilled Sapiens growth tracks">
            <div className="ss-live-float ss-live-float--one">
              <Building2 size={22} />
              <div>
                <strong>80+ Mentors</strong>
                <span>IIM - IIT - Top Firms</span>
              </div>
            </div>
            <div className="ss-live-card">
              <span>Your Journey in the Ecosystem</span>
              <h2>One platform. Three growth tracks.</h2>
              <div className="ss-live-pills">
                <strong><GraduationCap size={15} /> Campus Placement</strong>
                <strong><BriefcaseBusiness size={15} /> Corporate Growth</strong>
                <strong><Rocket size={15} /> Startup Launchpad</strong>
                <strong>Finance & IB</strong>
                <strong>Consulting</strong>
                <strong>HR & Sales</strong>
              </div>
              <div className="ss-live-mentor">
                <span>RK</span>
                <div>
                  <strong>Rajiv Kapoor</strong>
                  <small>IIM-A - Ex-McKinsey - Mentoring 40+ students</small>
                </div>
                <em><Star size={13} fill="currentColor" /> 4.9 / 5.0</em>
              </div>
            </div>
            <div className="ss-live-float ss-live-float--two">
              <Trophy size={22} />
              <div>
                <strong>96% Success</strong>
                <span>Placement Rate</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="ss-live-workshops">
        <div className="ss-container ss-live-workshops__grid">
          <div>
            <span className="ss-eyebrow">Community Workshops</span>
            <h2>Monthly Workshops for Community Members</h2>
            <p>When students join the Skilled Sapiens community, they get access to a fresh monthly calendar of mentor-led workshops across placements, interviews, domains, projects, and career growth.</p>
            <ul>
              {['Attend exclusive mentor-led workshops every month', 'Interact with mentors and build your network', 'Improve interview and placement readiness', 'Build practical domain competency through live sessions'].map((item) => (
                <li key={item}>
                  <CheckSquare size={19} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="ss-live-calendar">
            <header>
              <h3>{calendar.monthLabel}</h3>
              <span><CalendarDays size={14} /> Current Month</span>
            </header>
            <div className="ss-live-calendar__grid" aria-label="Current month workshop calendar">
              {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((day) => (
                <b key={day}>{day}</b>
              ))}
              {calendar.days.map((item, index) => (
                <div className={`${item.event ? 'has-event' : ''} ${item.inCurrentMonth ? '' : 'is-muted'} ${item.isToday ? 'is-today' : ''}`} key={`${item.day}-${index}`}>
                  <span>{item.day}</span>
                  {item.event ? <small>{item.event.time}<br />{item.event.title}</small> : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="ss-live-stats">
        <div className="ss-container">
          {[
            ['10000+', 'Members Placed'],
            ['80+', 'Expert Mentors'],
            ['200+', 'Partner Colleges'],
            ['30+', 'Top Hiring Firms'],
            ['6+', 'Years of Excellence']
          ].map(([value, label]) => (
            <div key={label}>
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="ss-trust-strip">
        <div className="ss-container">
          <span>Our members work at</span>
          <strong>McKinsey</strong>
          <strong>Goldman Sachs</strong>
          <strong>Amazon</strong>
          <strong>Deloitte</strong>
          <strong>J.P. Morgan</strong>
          <strong>Google</strong>
          <strong>Accenture</strong>
        </div>
      </section>

      <section className="ss-section ss-section--white" id="skilled-sapiens-ecosystem">
        <div className="ss-container">
          <div className="ss-section-header">
            <span className="ss-eyebrow">The Skilled Sapiens Ecosystem</span>
            <h2>Built for three distinct growth journeys</h2>
            <p>
              Whether someone is preparing for placements, building leadership skills, or growing a business, Skilled
              Sapiens gives them a guided path with expert support.
            </p>
          </div>
          <div className="ss-card-grid">
            {ecosystemCards.map((card) => {
              const Icon = card.icon;
              return (
                <article className={`ss-card ss-card--${card.accent}`} key={card.label}>
                  <div className="ss-card__icon">
                    <Icon size={24} />
                  </div>
                  <h3>{card.label}</h3>
                  <p>{card.description}</p>
                  <div className="ss-tags">
                    {card.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="ss-section ss-section--soft">
        <div className="ss-container ss-split">
          <div className="ss-image-panel ss-image-panel--mentorship">
            <span>Expert Guidance</span>
            <h2>Learn directly from mentors who understand your career goals.</h2>
          </div>
          <div className="ss-content-panel">
            <span className="ss-eyebrow">Placement Mentorship</span>
            <h2>Mentorship that is personal, practical, and role-specific.</h2>
            <p>
              Students and professionals get support on resumes, interviews, GD-PI preparation, domain choices, and
              company-specific readiness from people who understand the path.
            </p>
            <div className="ss-checklist">
              {['Resume and profile building', '1-1 personalized mentorship', 'Campus and off-campus placement support', 'Mock GD-PI with feedback'].map((item) => (
                <span key={item}>
                  <Check size={15} />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="ss-section ss-section--white">
        <div className="ss-container ss-split">
          <div className="ss-image-panel ss-image-panel--leadership">
            <span>Leadership Development</span>
            <h2>Build practical skills through guided industry learning.</h2>
          </div>
          <div className="ss-content-panel">
            <span className="ss-eyebrow">Certified Leadership</span>
            <h2>Training programs built around live projects and industry exposure.</h2>
            <p>
              Learners build practical confidence in consulting, finance, marketing, HR, and business roles through live
              sessions, case discussions, mentor feedback, and applied project work.
            </p>
            <div className="ss-checklist">
              {['Case-study based learning', 'Corporate mentor interaction', 'Industry certificate for resume impact', 'Tools, projects, and hands-on skills'].map((item) => (
                <span key={item}>
                  <Check size={15} />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="ss-section ss-section--soft">
        <div className="ss-container ss-split">
          <div className="ss-image-panel ss-image-panel--business">
            <span>Business Growth</span>
            <h2>Turn ideas into growth with hands-on business support.</h2>
          </div>
          <div className="ss-content-panel">
            <span className="ss-eyebrow">Creative & Digital Services</span>
            <h2>Support for startups, businesses, and growth-focused teams.</h2>
            <p>
              Skilled Sapiens also supports founders and companies with idea assessment, digital growth, website support,
              intern pipelines, and access to a wider alumni and advisor network.
            </p>
            <div className="ss-checklist">
              {['Idea identification and assessment', 'Pitch, funding, and investment support', 'Digital marketing and UI-UX support', 'Intern pipeline and business process support'].map((item) => (
                <span key={item}>
                  <Check size={15} />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="ss-section ss-section--white">
        <div className="ss-container">
          <div className="ss-section-header">
            <span className="ss-eyebrow">Initiatives</span>
            <h2>Explore our initiatives</h2>
            <p>Three active channels through which Skilled Sapiens connects people, builds networks, and powers careers.</p>
          </div>
          <div className="ss-live-initiatives">
            <article>
              <div className="ss-live-thumb ss-live-thumb--campus">
                <span>Collaborate with us</span>
                <strong>Campus Connect<br />Initiative</strong>
                <small>campusconnect@skilledsapiens.com</small>
              </div>
              <h3>Campus Connect Initiative</h3>
              <p>We partner with colleges to deliver expert mentorship, resume workshops, and placement prep directly on campus.</p>
            </article>
            <article>
              <div className="ss-live-thumb ss-live-thumb--mentor">
                <span>Join us as mentor</span>
                <strong>Mentors Connect<br />Initiative</strong>
                <small>Mentors@skilledsapiens.com</small>
              </div>
              <h3>Mentors Connect Initiative</h3>
              <p>IIM/IIT alumni and senior experts can shape the next generation of leaders by joining the mentor network.</p>
            </article>
            <article>
              <div className="ss-live-thumb ss-live-thumb--business">
                <span>Grow your business</span>
                <strong>Business Connect<br />Initiative</strong>
                <small>businessconnect@skilledsapiens.com</small>
              </div>
              <h3>Business Connect Initiative</h3>
              <p>Scale with digital marketing services, incubation support, and a student talent pipeline.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="ss-section ss-section--soft">
        <div className="ss-container">
          <div className="ss-section-header">
            <span className="ss-eyebrow">Success Stories</span>
            <h2>Our community members work at the best</h2>
            <p>Members have cracked opportunities across consulting, tech, product, finance, consumer, manufacturing, and startup roles.</p>
          </div>
          <div className="ss-logo-cloud">
            {['McKinsey', 'BCG', 'Goldman Sachs', 'Amazon', 'Deloitte', 'J.P. Morgan', 'Google', 'Accenture', 'HDFC Bank', 'Axis Capital', 'Infosys', 'Unilever'].map((company) => (
              <span key={company}>{company}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="ss-section ss-section--white">
        <div className="ss-container">
          <div className="ss-section-header">
            <span className="ss-eyebrow">Your Journey</span>
            <h2>From sign-up to dream outcome</h2>
            <p>A structured, guided path. We walk with learners at every step.</p>
          </div>
          <div className="ss-steps">
            {journeySteps.map(([title, description], index) => (
              <article className="ss-step" key={title}>
                <span>{index + 1}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="ss-section ss-section--white ss-section--tight">
        <div className="ss-container">
          <div className="ss-cta-band">
            <div>
              <h2>Ready to join the ecosystem?</h2>
              <p>10K+ members. 80+ mentors. One community built to take learners from where they are to where they want to be.</p>
            </div>
            <div className="ss-cta-actions">
              <a className="ss-button ss-button--light" href="https://skilledsapiens.com/1-1-personalized-mentorship/" rel="noreferrer" target="_blank">
                Schedule a 1-1 Session
              </a>
              <a className="ss-button ss-button--outline-light" href="https://skilledsapiens.com/placement-program/" rel="noreferrer" target="_blank">
                View All Programs
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="ss-section ss-section--soft">
        <div className="ss-container">
          <div className="ss-section-header">
            <span className="ss-eyebrow">Ecosystem Voices</span>
            <h2>Real members. Real outcomes.</h2>
            <p>Stories of people who committed to their growth and got results.</p>
          </div>
          <div className="ss-testimonial-grid">
            {testimonials.map(([initials, name, college, placement, quote], index) => (
              <article key={name}>
                <div className="ss-stars" aria-label="Five star rating">
                  {[0, 1, 2, 3, 4].map((star) => (
                    <Star fill="currentColor" key={star} size={14} />
                  ))}
                </div>
                <p>{quote}</p>
                <footer>
                  <span className={`ss-testimonial-avatar ss-testimonial-avatar--${index % 4}`}>{initials}</span>
                  <div>
                    <strong>{name}</strong>
                    <small>{college}</small>
                    <em>{placement}</em>
                  </div>
                </footer>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="ss-section ss-section--white">
        <div className="ss-container">
          <div className="ss-section-header">
            <span className="ss-eyebrow">Questions</span>
            <h2>Frequently Asked Questions</h2>
          </div>
          <div className="ss-faq-list">
            {faqs.map((faq, index) => (
              <article className={`ss-faq ${openFaq === index ? 'ss-faq--open' : ''}`} key={faq.question}>
                <button onClick={() => setOpenFaq((current) => (current === index ? -1 : index))} type="button">
                  {faq.question}
                  <span>{openFaq === index ? 'x' : '+'}</span>
                </button>
                <p>{faq.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function AboutContent() {
  const [openFaq, setOpenFaq] = useState(0);

  return (
    <>
      <section className="ss-section ss-section--white ss-section--intro">
        <div className="ss-container">
          <div className="ss-section-header">
            <span className="ss-eyebrow">About Skilled Sapiens</span>
            <h1>Career growth, mentorship, and leadership learning inside one ecosystem.</h1>
            <p>
              Skilled Sapiens helps learners move from confusion to clarity through live mentorship, practical programs,
              guided projects, and a strong community of mentors, alumni, colleges, and business partners.
            </p>
          </div>
          <div className="ss-card-grid">
            {ecosystemCards.map((card) => {
              const Icon = card.icon;
              return (
                <article className={`ss-card ss-card--${card.accent}`} key={card.label}>
                  <div className="ss-card__icon">
                    <Icon size={24} />
                  </div>
                  <h3>{card.label}</h3>
                  <p>{card.description}</p>
                  <div className="ss-tags">
                    {card.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="ss-section ss-section--soft">
        <div className="ss-container ss-split">
          <div className="ss-image-panel ss-image-panel--mentorship">
            <span>Why it exists</span>
            <h2>Students need more than content. They need guidance, practice, and access.</h2>
          </div>
          <div className="ss-content-panel">
            <span className="ss-eyebrow">Our Approach</span>
            <h2>Live support for real career decisions.</h2>
            <p>
              The LMS gives enrolled users their learning workspace. Explore Skilled Sapiens gives them the bigger picture:
              how programs, mentors, initiatives, certificates, projects, and community fit together.
            </p>
            <div className="ss-checklist">
              {['Mentor-led learning', 'Career and placement readiness', 'Live projects and practical exposure', 'Long-term community access'].map((item) => (
                <span key={item}>
                  <Check size={15} />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="ss-section ss-section--white">
        <div className="ss-container">
          <div className="ss-section-header">
            <span className="ss-eyebrow">Your Journey</span>
            <h2>How learners move through the ecosystem</h2>
          </div>
          <div className="ss-steps">
            {journeySteps.map(([title, description], index) => (
              <article className="ss-step" key={title}>
                <span>{index + 1}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="ss-section ss-section--soft">
        <div className="ss-container">
          <div className="ss-section-header">
            <span className="ss-eyebrow">Questions</span>
            <h2>Frequently Asked Questions</h2>
          </div>
          <div className="ss-faq-list">
            {faqs.map((faq, index) => (
              <article className={`ss-faq ${openFaq === index ? 'ss-faq--open' : ''}`} key={faq.question}>
                <button onClick={() => setOpenFaq((current) => (current === index ? -1 : index))} type="button">
                  {faq.question}
                  <span>{openFaq === index ? 'x' : '+'}</span>
                </button>
                <p>{faq.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

export function ExploreSkilledSapiensPage({ portal }: ExploreSkilledSapiensPageProps) {
  const { pageSlug = 'home' } = useParams();
  const location = useLocation();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isPlacementMenuOpen, setIsPlacementMenuOpen] = useState(false);
  const returnPath = useMemo(() => getReturnPath(portal, location.state), [location.state, portal]);
  const validPage = [...explorePages, ...placementMentorshipPages, { label: 'About', slug: 'about' }].some((page) => page.slug === pageSlug);
  const navModulesQuery = useQuery({
    queryFn: () => apiGet<WebsiteNavModule[]>('/public/website-nav-modules'),
    queryKey: ['website-nav-modules-public'],
    staleTime: 60_000
  });
  const whatsappWidgetQuery = usePublicWhatsAppWidgetFeatureControl();
  const visibleModuleKeys = useMemo(() => {
    const modules = navModulesQuery.data ?? [];
    if (modules.length === 0) return null;
    return new Set(modules.filter((module) => module.status === 'visible').map((module) => module.moduleKey));
  }, [navModulesQuery.data]);
  const isModuleVisible = (moduleKey: string) => !visibleModuleKeys || visibleModuleKeys.has(moduleKey);
  const visibleExplorePages = explorePages.filter((page) => isModuleVisible(page.slug));
  const visiblePlacementPages = placementMentorshipPages.filter((page) => isModuleVisible(page.slug === 'placement-mentorship' ? 'placement-mentorship-students' : page.slug));
  const showPlacementMenu = isModuleVisible('placement-mentorship') && visiblePlacementPages.length > 0;

  if (!validPage) {
    return <Navigate replace to={`/${portal}/explore`} />;
  }

  return (
    <div className="ss-explore-shell">
      <header className="ss-explore-header">
        <Link className="ss-explore-brand" to={`/${portal}/explore`} state={location.state}>
          <img alt="Skilled Sapiens logo" src="/apple-touch-icon.png" />
        </Link>

        <button
          aria-expanded={isMobileNavOpen}
          aria-label="Toggle Explore navigation"
          className="ss-explore-menu-button"
          onClick={() => setIsMobileNavOpen((current) => !current)}
          type="button"
        >
          <Menu size={20} />
        </button>

        <nav className={`ss-explore-nav ${isMobileNavOpen ? 'ss-explore-nav--open' : ''}`} aria-label="Skilled Sapiens pages">
          {isModuleVisible('home') ? (
            <NavLink
              className={({ isActive }) => `ss-explore-nav__link ${isActive ? 'ss-explore-nav__link--active' : ''}`}
              end
              onClick={() => setIsMobileNavOpen(false)}
              state={location.state}
              to={`/${portal}/explore`}
            >
              Home
            </NavLink>
          ) : null}

          {showPlacementMenu ? (
            <div
              className={`ss-explore-nav__dropdown ${isPlacementMenuOpen ? 'ss-explore-nav__dropdown--open' : ''}`}
              onMouseEnter={() => {
                if (window.innerWidth > 1120 && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
                  setIsPlacementMenuOpen(true);
                }
              }}
              onMouseLeave={() => {
                if (window.innerWidth > 1120 && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
                  setIsPlacementMenuOpen(false);
                }
              }}
            >
              <button
                aria-expanded={isPlacementMenuOpen}
                className={`ss-explore-nav__link ${pageSlug.startsWith('placement-mentorship') ? 'ss-explore-nav__link--active' : ''}`}
                onClick={() => setIsPlacementMenuOpen((current) => !current)}
                type="button"
              >
                Placement Mentorship
                <ChevronDown size={15} />
              </button>
              <div className="ss-explore-nav__menu">
                {visiblePlacementPages.map((page) => (
                  <NavLink
                    className={({ isActive }) => `ss-explore-nav__menu-link ${isActive ? 'ss-explore-nav__menu-link--active' : ''}`}
                    key={page.slug}
                    onClick={() => {
                      setIsMobileNavOpen(false);
                      setIsPlacementMenuOpen(false);
                    }}
                    state={location.state}
                    to={`/${portal}/explore/${page.slug}`}
                  >
                    {page.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ) : null}

          {visibleExplorePages.filter((page) => page.slug !== 'home').map((page) => (
            <NavLink
              className={({ isActive }) => `ss-explore-nav__link ${isActive ? 'ss-explore-nav__link--active' : ''}`}
              key={page.slug}
              onClick={() => setIsMobileNavOpen(false)}
              state={location.state}
              to={`/${portal}/explore/${page.slug}`}
            >
              {page.label}
            </NavLink>
          ))}
        </nav>

        <Link className="ss-back-link" to={returnPath}>
          <ArrowLeft size={16} />
          <span>Back to LMS</span>
        </Link>
        <Link aria-label="Back to LMS" className="ss-explore-close" to={returnPath}>
          <X size={19} />
        </Link>
      </header>

      <main className="ss-homepage">
        {pageSlug === 'home' ? <HomeContent /> : null}
        {pageSlug === 'about' ? <AboutContent /> : null}
        {pageSlug === 'placement-mentorship' ? <StudentPlacementContent /> : null}
        {pageSlug === 'placement-mentorship-professionals' ? <ProfessionalPlacementContent /> : null}
        {pageSlug === 'business-connect' ? <BusinessConnectContent /> : null}
        {pageSlug === 'campus-connect' ? <CampusConnectContent /> : null}
        {pageSlug === 'live-projects' ? <LiveProjectsContent /> : null}
        {pageSlug === 'leadership-programs' ? <LeadershipProgramsContent /> : null}
        {pageSlug !== 'home' &&
        pageSlug !== 'about' &&
        pageSlug !== 'placement-mentorship' &&
        pageSlug !== 'placement-mentorship-professionals' &&
        pageSlug !== 'business-connect' &&
        pageSlug !== 'campus-connect' &&
        pageSlug !== 'live-projects' &&
        pageSlug !== 'leadership-programs' ? (
          <ComingSoonContent pageSlug={pageSlug} />
        ) : null}
      </main>
      <WhatsAppContactWidget feature={whatsappWidgetQuery.data} />
    </div>
  );
}
