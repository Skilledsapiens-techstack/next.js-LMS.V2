export type PulseCollegeOption = {
  city?: string | null;
  country?: string | null;
  id: string;
  name: string;
  state?: string | null;
};

export const PULSE_OTHER_COLLEGE_ID = '__pulse_other_college__';
const STATIC_COLLEGE_PREFIX = 'pulse-college-static:';

const staticCollegeNames = [
  'Indian Institute of Management Ahmedabad',
  'Indian Institute of Management Amritsar',
  'Indian Institute of Management Bangalore',
  'Indian Institute of Management Bodh Gaya',
  'Indian Institute of Management Calcutta',
  'Indian Institute of Management Indore',
  'Indian Institute of Management Jammu',
  'Indian Institute of Management Kashipur',
  'Indian Institute of Management Kozhikode',
  'Indian Institute of Management Lucknow',
  'Indian Institute of Management Mumbai',
  'Indian Institute of Management Nagpur',
  'Indian Institute of Management Raipur',
  'Indian Institute of Management Ranchi',
  'Indian Institute of Management Rohtak',
  'Indian Institute of Management Sambalpur',
  'Indian Institute of Management Shillong',
  'Indian Institute of Management Sirmaur',
  'Indian Institute of Management Tiruchirappalli',
  'Indian Institute of Management Udaipur',
  'Indian Institute of Management Visakhapatnam',
  'Indian Institute of Technology Bhilai',
  'Indian Institute of Technology Bhubaneswar',
  'Indian Institute of Technology Bombay',
  'Indian Institute of Technology Delhi',
  'Indian Institute of Technology Dharwad',
  'Indian Institute of Technology Gandhinagar',
  'Indian Institute of Technology Goa',
  'Indian Institute of Technology Guwahati',
  'Indian Institute of Technology Hyderabad',
  'Indian Institute of Technology Indore',
  'Indian Institute of Technology Jammu',
  'Indian Institute of Technology Jodhpur',
  'Indian Institute of Technology Kanpur',
  'Indian Institute of Technology Kharagpur',
  'Indian Institute of Technology Madras',
  'Indian Institute of Technology Mandi',
  'Indian Institute of Technology Palakkad',
  'Indian Institute of Technology Patna',
  'Indian Institute of Technology Roorkee',
  'Indian Institute of Technology Ropar',
  'Indian Institute of Technology Tirupati',
  'Indian Institute of Technology Varanasi',
  'Indian Institute of Technology Dhanbad',
  'Indian School of Business',
  'XLRI Xavier School of Management Jamshedpur',
  'XLRI Delhi NCR',
  'Faculty of Management Studies, University of Delhi',
  'SP Jain Institute of Management and Research',
  'Management Development Institute Gurgaon',
  'Management Development Institute Murshidabad',
  'Indian Institute of Foreign Trade Delhi',
  'Indian Institute of Foreign Trade Kolkata',
  'Indian Institute of Foreign Trade Kakinada',
  'Jamnalal Bajaj Institute of Management Studies',
  'Shailesh J. Mehta School of Management, IIT Bombay',
  'Department of Management Studies, IIT Delhi',
  'Department of Management Studies, IIT Madras',
  'Vinod Gupta School of Management, IIT Kharagpur',
  'Department of Management Studies, IIT Roorkee',
  'Department of Management Studies, IIT Kanpur',
  'Department of Management Studies, IIT Dhanbad',
  'Tata Institute of Social Sciences Mumbai',
  'Narsee Monjee Institute of Management Studies Mumbai',
  'NMIMS Bengaluru',
  'NMIMS Hyderabad',
  'NMIMS Indore',
  'NMIMS Navi Mumbai',
  'Symbiosis Institute of Business Management Pune',
  'Symbiosis Institute of Business Management Bengaluru',
  'Symbiosis Institute of Business Management Hyderabad',
  'Symbiosis Centre for Management and Human Resource Development',
  'Symbiosis Institute of International Business',
  'Institute of Management Technology Ghaziabad',
  'Institute of Management Technology Hyderabad',
  'Institute of Management Technology Nagpur',
  'International Management Institute New Delhi',
  'International Management Institute Kolkata',
  'International Management Institute Bhubaneswar',
  'Xavier Institute of Management Bhubaneswar',
  'Xavier Institute of Management and Entrepreneurship Bangalore',
  'T. A. Pai Management Institute Manipal',
  'Goa Institute of Management',
  'Great Lakes Institute of Management Chennai',
  'Great Lakes Institute of Management Gurgaon',
  'FORE School of Management',
  'Lal Bahadur Shastri Institute of Management',
  'K. J. Somaiya Institute of Management',
  'Prin. L. N. Welingkar Institute of Management Development and Research Mumbai',
  'Prin. L. N. Welingkar Institute of Management Development and Research Bengaluru',
  'Bharathidasan Institute of Management Tiruchirappalli',
  'Institute of Rural Management Anand',
  'MICA Ahmedabad',
  'IFMR Graduate School of Business, Krea University',
  'Loyola Institute of Business Administration',
  'SDA Bocconi Asia Center',
  'BITS School of Management',
  'Masters Union School of Business',
  'SOIL Institute of Management',
  'BIMTECH Greater Noida',
  'Christ University Institute of Management',
  'Christ University Bengaluru',
  'Alliance School of Business',
  'Woxsen University School of Business',
  'Jagdish Sheth School of Management',
  'Praxis Business School',
  'ICFAI Business School Hyderabad',
  'ICFAI Business School Mumbai',
  'ICFAI Business School Bengaluru',
  'ICFAI Business School Pune',
  'ICFAI Business School Gurgaon',
  'ICFAI Business School Kolkata',
  'ICFAI Business School Ahmedabad',
  'Jaipuria Institute of Management Lucknow',
  'Jaipuria Institute of Management Noida',
  'Jaipuria Institute of Management Jaipur',
  'Jaipuria Institute of Management Indore',
  'Jagan Institute of Management Studies Rohini',
  'GL Bajaj Institute of Management and Research',
  'Apeejay School of Management',
  'Delhi School of Business',
  'New Delhi Institute of Management',
  'Birla Institute of Management Technology',
  'Institute of Public Enterprise Hyderabad',
  'Vignana Jyothi Institute of Management',
  'SDM Institute for Management Development Mysore',
  'Rajagiri Business School',
  'Thiagarajar School of Management',
  'Amrita School of Business Coimbatore',
  'Amrita School of Business Bengaluru',
  'Amrita School of Business Kochi',
  'Amrita School of Business Amritapuri',
  'Kirloskar Institute of Management',
  'MIT School of Business Pune',
  'Balaji Institute of Modern Management',
  'Indira School of Business Studies Pune',
  'Doon Business School',
  'UPES School of Business',
  'Chandigarh University University School of Business',
  'Lovely Professional University Mittal School of Business',
  'KIIT School of Management',
  'Amity Business School Noida',
  'Jain University CMS Business School',
  'Gitam School of Business',
  'Shiv Nadar University School of Management and Entrepreneurship',
  'Bennett University School of Management',
  'Flame University School of Business',
  'Ahmedabad University Amrut Mody School of Management',
  'Nirma University Institute of Management',
  'Pune Institute of Business Management',
  'Ramaiah Institute of Management',
  'Dayananda Sagar Business School',
  'St. Josephs Institute of Management',
  'Xavier Business School Kolkata',
  'Calcutta Business School',
  'Army Institute of Management Kolkata',
  'Institute of Management Studies Ghaziabad',
  'University Business School, Panjab University',
  'Department of Financial Studies, University of Delhi',
  'Delhi Technological University Delhi School of Management',
  'Netaji Subhas University of Technology School of Management',
  'Banaras Hindu University Institute of Management Studies',
  'Aligarh Muslim University Faculty of Management Studies and Research',
  'Jamia Millia Islamia Centre for Management Studies',
  'Pondicherry University Department of Management Studies',
  'University of Hyderabad School of Management Studies',
  'Osmania University Department of Business Management',
  'Mumbai University Alkesh Dinesh Mody Institute',
  'Sydenham Institute of Management Studies',
  'Jamia Hamdard School of Management and Business Studies'
];

export function normalizeCollegeName(name: string) {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

function collegeSlug(name: string) {
  return normalizeCollegeName(name)
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function isPulseStaticCollegeId(id?: string | null) {
  return Boolean(id?.startsWith(STATIC_COLLEGE_PREFIX));
}

export function buildPulseCollegeOptions(colleges: PulseCollegeOption[] = []) {
  const optionsByName = new Map<string, PulseCollegeOption>();

  colleges.forEach((college) => {
    const key = normalizeCollegeName(college.name);
    if (key) optionsByName.set(key, college);
  });

  staticCollegeNames.forEach((name) => {
    const key = normalizeCollegeName(name);
    if (!optionsByName.has(key)) {
      optionsByName.set(key, {
        country: 'India',
        id: `${STATIC_COLLEGE_PREFIX}${collegeSlug(name)}`,
        name
      });
    }
  });

  return [...optionsByName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function getPulseCollegeOptionName(options: PulseCollegeOption[], collegeId?: string) {
  if (!collegeId || collegeId === PULSE_OTHER_COLLEGE_ID) return '';
  return options.find((college) => college.id === collegeId)?.name ?? '';
}
