const TRAINING_COURSES = [
  {
    id: 'first-aid-basics',
    title: 'First Aid Basics',
    badge: 'First Aid Ready',
    certificateTitle: 'First Aid Basics Certificate',
    category: 'Medical',
    level: 'Foundational',
    duration: '20 min',
    description: 'Covers safe first response, scene awareness, and when to escalate medical incidents.',
    outcomes: [
      'Assess scene safety before helping.',
      'Understand when to call for medical escalation.',
      'Follow the correct first-response sequence.'
    ],
    assessment: [
      {
        id: 'fa-1',
        question: 'What is the first thing a volunteer should do at a medical incident?',
        options: ['Move the person immediately', 'Check scene safety', 'Ask for their ID', 'Start giving food'],
        correctIndex: 1
      },
      {
        id: 'fa-2',
        question: 'If a person is unresponsive, the volunteer should:',
        options: ['Wait for instructions only', 'Call for professional help and follow protocol', 'Leave the area', 'Offer water first'],
        correctIndex: 1
      },
      {
        id: 'fa-3',
        question: 'A trained volunteer should avoid:',
        options: ['Escalating serious symptoms quickly', 'Using basic PPE', 'Attempting procedures beyond training', 'Keeping others clear'],
        correctIndex: 2
      }
    ]
  },
  {
    id: 'food-distribution-safety',
    title: 'Food Distribution Safety',
    badge: 'Food Safety Steward',
    certificateTitle: 'Food Distribution Safety Certificate',
    category: 'Food',
    level: 'Operational',
    duration: '15 min',
    description: 'Teaches safe handling, line flow, and contamination prevention during food distribution.',
    outcomes: [
      'Handle donated food safely.',
      'Reduce contamination risks in distribution zones.',
      'Manage food lines with dignity and order.'
    ],
    assessment: [
      {
        id: 'food-1',
        question: 'Which practice best reduces food contamination risk?',
        options: ['Stacking raw and cooked food together', 'Frequent hand hygiene and clean surfaces', 'Serving uncovered food outdoors', 'Skipping temperature checks'],
        correctIndex: 1
      },
      {
        id: 'food-2',
        question: 'If packaged food looks damaged, a volunteer should:',
        options: ['Distribute it quickly', 'Discard or isolate it for review', 'Open and smell it', 'Hide the damage'],
        correctIndex: 1
      },
      {
        id: 'food-3',
        question: 'During a crowded distribution, the best approach is to:',
        options: ['Keep no queue structure', 'Create a calm, guided line flow', 'Let people rush the tables', 'Stop speaking to the crowd'],
        correctIndex: 1
      }
    ]
  },
  {
    id: 'child-support-protocols',
    title: 'Child Support Protocols',
    badge: 'Child Support Ally',
    certificateTitle: 'Child Support Protocols Certificate',
    category: 'Education',
    level: 'Trust & Safety',
    duration: '18 min',
    description: 'Focuses on safe volunteer behavior, escalation boundaries, and respectful support for children and families.',
    outcomes: [
      'Maintain child-safe boundaries.',
      'Recognize when to escalate to a coordinator.',
      'Support learning and care environments responsibly.'
    ],
    assessment: [
      {
        id: 'child-1',
        question: 'If a child shares a serious concern, a volunteer should:',
        options: ['Keep it secret', 'Report it through the proper safeguarding channel', 'Ignore it', 'Post it in the team chat'],
        correctIndex: 1
      },
      {
        id: 'child-2',
        question: 'A good child-support practice is:',
        options: ['Working fully alone without oversight', 'Maintaining visible, accountable interactions', 'Taking children off-site', 'Skipping coordinator check-ins'],
        correctIndex: 1
      },
      {
        id: 'child-3',
        question: 'Volunteers should provide support that is:',
        options: ['Within role boundaries and approved processes', 'Improvised without guidance', 'Private and undocumented', 'Based only on instinct'],
        correctIndex: 0
      }
    ]
  }
];

function getDefaultTrainingState(training = {}) {
  return {
    completedCourses: Array.isArray(training.completedCourses) ? training.completedCourses : [],
    badges: Array.isArray(training.badges) ? training.badges : [],
    certificates: Array.isArray(training.certificates) ? training.certificates : [],
    attempts: Array.isArray(training.attempts) ? training.attempts : []
  };
}

function addOneYear(isoDate) {
  const date = new Date(isoDate);
  date.setFullYear(date.getFullYear() + 1);
  return date.toISOString();
}

function daysUntil(dateString) {
  if (!dateString) {
    return null;
  }

  const diff = new Date(dateString).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

function sanitizeCourse(course) {
  return {
    id: course.id,
    title: course.title,
    badge: course.badge,
    certificateTitle: course.certificateTitle,
    category: course.category,
    level: course.level,
    duration: course.duration,
    description: course.description,
    outcomes: course.outcomes,
    assessment: course.assessment.map(({ id, question, options }) => ({
      id,
      question,
      options
    }))
  };
}

function listTrainingCourses() {
  return TRAINING_COURSES.map(sanitizeCourse);
}

function getTrainingCourse(courseId) {
  return TRAINING_COURSES.find((course) => course.id === courseId) || null;
}

function buildTrainingView(profile = {}) {
  const training = getDefaultTrainingState(profile.training);

  return {
    ...training,
    certificates: training.certificates.map((certificate) => ({
      ...certificate,
      validUntil: certificate.validUntil || addOneYear(certificate.issuedAt),
      reminderStatus: getReminderStatus(certificate.validUntil || addOneYear(certificate.issuedAt)),
      daysUntilExpiry: daysUntil(certificate.validUntil || addOneYear(certificate.issuedAt))
    }))
  };
}

function buildCoursesForProfile(profile = {}) {
  const training = buildTrainingView(profile);

  return listTrainingCourses().map((course) => {
    const completion = training.completedCourses.find((item) => item.courseId === course.id);

    return {
      ...course,
      completed: Boolean(completion),
      completedAt: completion?.completedAt || null,
      score: completion?.score || null,
      badgeEarned: completion?.badge || null
    };
  });
}

function gradeCourseSubmission(courseId, answers = {}) {
  const course = getTrainingCourse(courseId);
  if (!course) {
    return null;
  }

  const totalQuestions = course.assessment.length;
  const correctAnswers = course.assessment.reduce((count, question) => {
    const selectedIndex = Number(answers[question.id]);
    return count + (selectedIndex === question.correctIndex ? 1 : 0);
  }, 0);

  const score = Math.round((correctAnswers / totalQuestions) * 100);
  const passed = score >= 70;

  return {
    course,
    score,
    passed,
    correctAnswers,
    totalQuestions
  };
}

function mergeTrainingCompletion(profile = {}, result) {
  const training = getDefaultTrainingState(profile.training);
  const completedAt = new Date().toISOString();
  const validUntil = addOneYear(completedAt);
  const attempts = [
    ...training.attempts.filter((entry) => entry.courseId !== result.course.id),
    {
      courseId: result.course.id,
      score: result.score,
      passed: result.passed,
      attemptedAt: completedAt
    }
  ];

  if (!result.passed) {
    return {
      ...training,
      attempts
    };
  }

  const completedCourses = [
    ...training.completedCourses.filter((entry) => entry.courseId !== result.course.id),
    {
      courseId: result.course.id,
      title: result.course.title,
      badge: result.course.badge,
      score: result.score,
      completedAt,
      validUntil
    }
  ];
  const badges = Array.from(new Set([...training.badges, result.course.badge]));
  const certificates = [
    ...training.certificates.filter((entry) => entry.courseId !== result.course.id),
    {
      courseId: result.course.id,
      title: result.course.certificateTitle,
      issuedAt: completedAt,
      validUntil
    }
  ];

  return {
    completedCourses,
    badges,
    certificates,
    attempts
  };
}

function getReminderStatus(validUntil) {
  const remainingDays = daysUntil(validUntil);
  if (remainingDays === null) {
    return 'active';
  }
  if (remainingDays < 0) {
    return 'expired';
  }
  if (remainingDays <= 30) {
    return 'renew_soon';
  }
  return 'active';
}

function buildRenewalReminders(profile = {}) {
  const training = buildTrainingView(profile);

  return training.certificates
    .filter((certificate) => ['renew_soon', 'expired'].includes(certificate.reminderStatus))
    .map((certificate) => ({
      courseId: certificate.courseId,
      title: certificate.title,
      validUntil: certificate.validUntil,
      daysUntilExpiry: certificate.daysUntilExpiry,
      reminderStatus: certificate.reminderStatus,
      message: certificate.reminderStatus === 'expired'
        ? `${certificate.title} has expired and should be renewed.`
        : `${certificate.title} expires in ${certificate.daysUntilExpiry} day${certificate.daysUntilExpiry === 1 ? '' : 's'}.`
    }));
}

function buildTrainedVolunteerLeaderboard(volunteers = []) {
  return volunteers
    .filter((volunteer) => (volunteer.certifications || []).length > 0)
    .map((volunteer) => ({
      id: volunteer.id,
      name: volunteer.name,
      skill: volunteer.skill,
      location: volunteer.location,
      certifications: volunteer.certifications || [],
      certificationCount: (volunteer.certifications || []).length,
      hoursVolunteered: volunteer.hoursVolunteered || 0,
      missionsCompleted: volunteer.missionsCompleted || 0,
      impactScore: volunteer.impactScore || 0,
      trainingScore: ((volunteer.certifications || []).length * 120) + Number(volunteer.impactScore || 0)
    }))
    .sort((left, right) => right.trainingScore - left.trainingScore)
    .slice(0, 8);
}

module.exports = {
  buildCoursesForProfile,
  buildRenewalReminders,
  buildTrainedVolunteerLeaderboard,
  buildTrainingView,
  gradeCourseSubmission,
  mergeTrainingCompletion
};
