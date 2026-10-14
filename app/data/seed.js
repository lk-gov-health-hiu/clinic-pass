// Simulated data only. Synthetic patient; no real person or record.
// Hospital directory, specialties and health record are OUR simulated systems (not government APIs).

const specialties = [
  { id: 'cardiology', name: 'Cardiology', keywords: ['chest', 'heart', 'palpitation', 'breath', 'breathless', 'swelling legs'] },
  { id: 'endocrinology', name: 'Endocrinology / Diabetes', keywords: ['sugar', 'diabet', 'thirst', 'urinat', 'thyroid'] },
  { id: 'ophthalmology', name: 'Ophthalmology', keywords: ['eye', 'vision', 'blurred', 'cataract', 'sight'] },
  { id: 'neurology', name: 'Neurology', keywords: ['headache', 'numb', 'dizz', 'tremor', 'memory', 'weakness', 'stroke'] },
  { id: 'nephrology', name: 'Nephrology', keywords: ['kidney', 'urine', 'swelling', 'creatinine'] },
  { id: 'orthopaedics', name: 'Orthopaedics', keywords: ['knee', 'joint', 'back pain', 'hip', 'fracture', 'bone'] },
  { id: 'general-medicine', name: 'General Medicine', keywords: [] },
];

// slots: simple labels per day; capacity tracked at runtime
const hospitals = [
  { id: 'h1', name: 'Colombo North Teaching Hospital (simulated)', distanceKm: 4.2, specialties: ['cardiology', 'endocrinology', 'neurology', 'nephrology', 'general-medicine'] },
  { id: 'h2', name: 'Ragama Base Hospital (simulated)', distanceKm: 9.8, specialties: ['ophthalmology', 'orthopaedics', 'endocrinology', 'general-medicine'] },
  { id: 'h3', name: 'Kandy Provincial Hospital (simulated)', distanceKm: 112, specialties: ['cardiology', 'ophthalmology', 'neurology', 'orthopaedics', 'nephrology', 'general-medicine'] },
];

const slotTimes = ['08:30', '09:00', '09:30', '10:00', '10:30', '11:00'];

const patients = [
  {
    sludiId: 'SLUDI-1952-0001',
    nic: '195212345V',
    name: 'K. A. Perera',
    dob: '1952-03-14',
    age: 74,
    phone: '+94 77 123 4567',
    address: 'Ragama, Sri Lanka',
    pensioner: true,
    phn: 'PHN-0001-2345',
  },
];

// Past health record keyed by PHN (released only with patient consent)
const records = {
  'PHN-0001-2345': {
    conditions: ['Type 2 diabetes (2009)', 'Hypertension (2012)', 'Dyslipidaemia (2015)'],
    allergies: ['Penicillin (rash)'],
    regularMedicines: ['Metformin 500 mg twice daily', 'Amlodipine 5 mg daily', 'Atorvastatin 20 mg nightly'],
    visits: [
      { date: '2026-06-12', clinic: 'Endocrinology', note: 'HbA1c 7.4%. Continue current regimen.' },
      { date: '2026-02-03', clinic: 'General Medicine', note: 'BP 138/84. Review in 4 months.' },
    ],
  },
};

module.exports = { specialties, hospitals, slotTimes, patients, records };
