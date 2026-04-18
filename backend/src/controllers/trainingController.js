const { enrichVolunteer, getUserProfile, listCollection, setDocument, setUserProfile } = require('../models/dataStore');
const { createNotification, logAuditEvent } = require('../services/operationsService');
const { REWARD_POINTS, applyRewardEvent } = require('../utils/rewardHelpers');
const {
  buildCoursesForProfile,
  buildRenewalReminders,
  buildTrainedVolunteerLeaderboard,
  buildTrainingView,
  gradeCourseSubmission,
  mergeTrainingCompletion
} = require('../services/trainingService');

function buildBaseProfile(req, profile) {
  return profile || {
    uid: req.user.uid,
    email: req.user.email || '',
    role: req.user.role || 'viewer',
    training: {
      completedCourses: [],
      badges: [],
      certificates: [],
      attempts: []
    }
  };
}

async function listTrainingCourses(req, res) {
  try {
    const profile = buildBaseProfile(req, await getUserProfile(req.user.uid));
    const volunteers = (await listCollection('volunteers')).map(enrichVolunteer);
    return res.json({
      success: true,
      courses: buildCoursesForProfile(profile),
      training: buildTrainingView(profile),
      renewalReminders: buildRenewalReminders(profile),
      leaderboard: buildTrainedVolunteerLeaderboard(volunteers)
    });
  } catch (error) {
    console.error('Training course fetch error:', error);
    return res.status(500).json({ success: false, error: 'Failed to load training courses' });
  }
}

async function submitTrainingCourse(req, res) {
  try {
    const profile = buildBaseProfile(req, await getUserProfile(req.user.uid));
    const result = gradeCourseSubmission(req.params.id, req.body.answers || {});

    if (!result) {
      return res.status(404).json({ success: false, error: 'Training course not found' });
    }

    const mergedTraining = mergeTrainingCompletion(profile, result);
    const nextProfile = await setUserProfile(req.user.uid, {
      ...profile,
      email: profile.email || req.user.email || '',
      role: profile.role || req.user.role || 'viewer',
      training: mergedTraining
    });

    if (result.passed) {
      const volunteers = await listCollection('volunteers');
      const linkedVolunteers = volunteers.filter(
        (volunteer) => String(volunteer.createdBy || '') === String(req.user.uid)
          || String(volunteer.email || '').toLowerCase() === String(req.user.email || '').toLowerCase()
      );

      await Promise.all(linkedVolunteers.map((volunteer) => setDocument('volunteers', volunteer.id, {
        ...applyRewardEvent(
          {
            ...volunteer,
            certifications: Array.from(new Set([...(volunteer.certifications || []), result.course.badge]))
          },
          {
            type: 'training_completed',
            points: REWARD_POINTS.certificationCompleted,
            summary: `Completed certification course: ${result.course.title}.`,
            awardedAt: new Date().toISOString(),
            dedupeKey: `training-completed:${result.course.id}:${volunteer.id}`,
            metadata: {
              badge: result.course.badge,
              courseId: result.course.id
            }
          }
        )
      })));
    }

    if (result.passed) {
      await createNotification(
        'training_completed',
        'Volunteer certification earned',
        `${result.course.title} completed successfully. Badge earned: ${result.course.badge}.`
      );

      await logAuditEvent({
        actor: {
          uid: req.user.uid,
          email: req.user.email,
          role: req.user.role,
          source: 'training-center'
        },
        action: 'training_course_completed',
        entityType: 'training_course',
        entityId: result.course.id,
        summary: `${result.course.title} completed with a score of ${result.score}%.`,
        metadata: {
          badge: result.course.badge,
          score: result.score
        },
        severity: 'info'
      });
    }

    const volunteers = (await listCollection('volunteers')).map(enrichVolunteer);

    return res.json({
      success: true,
      result: {
        courseId: result.course.id,
        title: result.course.title,
        badge: result.course.badge,
        score: result.score,
        passed: result.passed,
        correctAnswers: result.correctAnswers,
        totalQuestions: result.totalQuestions
      },
      training: buildTrainingView(nextProfile),
      courses: buildCoursesForProfile(nextProfile),
      renewalReminders: buildRenewalReminders(nextProfile),
      leaderboard: buildTrainedVolunteerLeaderboard(volunteers)
    });
  } catch (error) {
    console.error('Training course submission error:', error);
    return res.status(500).json({ success: false, error: 'Failed to submit training assessment' });
  }
}

module.exports = {
  listTrainingCourses,
  submitTrainingCourse
};
