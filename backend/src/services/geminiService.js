const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy_key');

const fallbackTranslations = {
  es: {
    category: {
      Medical: 'Medico',
      Logistics: 'Logistica',
      Education: 'Educacion',
      Labor: 'Trabajo Manual',
      Food: 'Distribucion de Alimentos'
    },
    urgency: {
      Low: 'Baja',
      Medium: 'Media',
      High: 'Alta',
      Critical: 'Critica'
    }
  },
  fr: {
    category: {
      Medical: 'Medical',
      Logistics: 'Logistique',
      Education: 'Education',
      Labor: 'Travail Manuel',
      Food: 'Distribution Alimentaire'
    },
    urgency: {
      Low: 'Faible',
      Medium: 'Moyenne',
      High: 'Elevee',
      Critical: 'Critique'
    }
  },
  hi: {
    category: {
      Medical: 'Chikitsa',
      Logistics: 'Logistics',
      Education: 'Shiksha',
      Labor: 'Shram',
      Food: 'Bhojan Vitran'
    },
    urgency: {
      Low: 'Kam',
      Medium: 'Madhyam',
      High: 'Uchch',
      Critical: 'Tatkal'
    }
  }
};

function hasGeminiKey() {
  return Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'dummy_key');
}

function buildVolunteerRecommendations(needs, volunteers) {
  return needs.map((need) => {
    const rankedVolunteers = volunteers
      .map((volunteer) => {
        let score = 0;
        const hasRequiredBadge = !need.requiredBadge || (volunteer.certifications || []).includes(need.requiredBadge);

        if (volunteer.skill === need.category) {
          score += 6;
        }

        if (hasRequiredBadge) {
          score += need.requiredBadge ? 8 : 2;
        } else if (need.requiredBadge) {
          score -= 10;
        }

        if (String(volunteer.location || '').toLowerCase() === String(need.location || '').toLowerCase()) {
          score += 4;
        }

        score += Math.min(Number(volunteer.radius || 0), 25) / 5;
        score += Math.min(Number(volunteer.impactScore || 0), 400) / 100;

        return {
          id: volunteer.id,
          name: volunteer.name,
          skill: volunteer.skill,
          location: volunteer.location,
          certifications: volunteer.certifications || [],
          eligible: hasRequiredBadge,
          score: Number(score.toFixed(2))
        };
      })
      .filter((volunteer) => volunteer.eligible || !need.requiredBadge)
      .sort((left, right) => right.score - left.score)
      .slice(0, 3);

    return {
      needId: String(need.id),
      volunteers: rankedVolunteers
    };
  });
}

function buildMockExtractedNeed(fileName = 'field-report', reason = '') {
  const normalizedName = String(fileName || 'field-report')
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]/g, ' ');

  return {
    title: `Scanned Report: ${normalizedName}`,
    location: 'Downtown Relief Camp',
    category: 'Medical',
    urgency: 'High',
    notes: `Auto-filled from demo OCR fallback.${reason ? ` ${reason}` : ''}`.trim(),
    volunteersNeeded: 6
  };
}

async function getSmartMatches(needs, volunteers) {
  const fallbackNeed = needs[0];
  const fallbackVolunteer = volunteers.find((item) => item.skill === fallbackNeed?.category) || volunteers[0];

  const fallbackInsight = !fallbackNeed || !fallbackVolunteer
    ? 'Simulation Mode: Add at least one need and volunteer to generate match guidance.'
    : `Simulation Mode: ${fallbackVolunteer.name} is the best fit for "${fallbackNeed.title}" because their ${fallbackVolunteer.skill} skills align with the ${fallbackNeed.category} request and they are close enough to respond quickly.`;

  if (!hasGeminiKey()) {
    return fallbackInsight;
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `
    You are the "Smart Allocation Logic Engine" for a volunteer coordination system.

    Current Community Needs:
    ${JSON.stringify(needs, null, 2)}

    Available Volunteers:
    ${JSON.stringify(volunteers, null, 2)}

    Task: Analyze the category, location, radius, and urgency to propose the best volunteer-to-need pairings.
    Output a concise response in 2-4 sentences suitable for a system alert panel.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Generative AI Error:', error);
    return `${fallbackInsight}\n\nGemini was unavailable, so the system used resilient local matching instead.`;
  }
}

async function translateNeeds(needs, language = 'en') {
  if (!language || language === 'en') {
    return needs;
  }

  if (!hasGeminiKey()) {
    const dictionary = fallbackTranslations[language] || fallbackTranslations.es;

    return needs.map((need) => ({
      ...need,
      translatedTitle: `[${language.toUpperCase()}] ${need.title}`,
      translatedCategory: dictionary.category[need.category] || need.category,
      translatedUrgency: dictionary.urgency[need.urgency] || need.urgency
    }));
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `
    Translate the following need records into ${language}.
    Return strict JSON only as an array of objects with keys:
    id, translatedTitle, translatedCategory, translatedUrgency.

    Records:
    ${JSON.stringify(needs, null, 2)}
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().replace(/```json|```/g, '').trim();
    const translated = JSON.parse(text);
    const translatedMap = new Map(translated.map((item) => [String(item.id), item]));

    return needs.map((need) => {
      const translatedNeed = translatedMap.get(String(need.id));
      return {
        ...need,
        translatedTitle: translatedNeed?.translatedTitle || need.title,
        translatedCategory: translatedNeed?.translatedCategory || need.category,
        translatedUrgency: translatedNeed?.translatedUrgency || need.urgency
      };
    });
  } catch (error) {
    console.error('Translation Error:', error);
    return translateNeeds(needs, 'es');
  }
}

async function extractNeedFromImage({ mimeType, base64Data, fileName }) {
  if (!base64Data) {
    throw new Error('Image data is required');
  }

  if (!hasGeminiKey()) {
    return buildMockExtractedNeed(
      fileName,
      'Supplies and triage support requested from handwritten intake sheet.'
    );
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `
    Read this intake form image and extract the disaster relief need.
    Return strict JSON only with these keys:
    title, location, category, urgency, notes, volunteersNeeded.

    Valid category values: Medical, Logistics, Education, Labor, Food.
    Valid urgency values: Low, Medium, High, Critical.
    volunteersNeeded must be a number.
    If a field is unclear, infer the safest likely value.
    `;

    const result = await model.generateContent([
      { text: prompt },
      {
        inlineData: {
          mimeType: mimeType || 'image/png',
          data: base64Data
        }
      }
    ]);

    const response = await result.response;
    const text = response.text().replace(/```json|```/g, '').trim();
    return JSON.parse(text);
  } catch (error) {
    console.error('OCR Extraction Error:', error);
    return buildMockExtractedNeed(
      fileName,
      'Gemini OCR was unavailable, so the system switched to resilient demo mode.'
    );
  }
}

function buildFallbackChatReply({ message, role, pageLabel, snapshot }) {
  const normalizedMessage = String(message || '').toLowerCase();
  const urgentNeeds = snapshot.needs.filter((need) => ['High', 'Critical'].includes(need.urgency));
  const unreadNotifications = snapshot.notifications.filter((notification) => !notification.read);
  const pendingReviews = snapshot.reviewQueue.filter((item) => item.status === 'pending');
  const openNeeds = snapshot.needs.filter((need) => Number(need.openSpots || need.volunteersNeeded || 0) > 0);
  const escalatedNeeds = snapshot.needs
    .filter((need) => ['escalated', 'acknowledged'].includes(need.escalation?.status))
    .sort((left, right) => Number(right.escalation?.score || 0) - Number(left.escalation?.score || 0));
  const lowInventoryItems = (snapshot.inventory || []).filter((item) => item.status === 'low');
  const topVolunteers = snapshot.volunteers
    .slice()
    .sort((a, b) => Number(b.impactScore || 0) - Number(a.impactScore || 0))
    .slice(0, 3);
  const pagePrompts = buildSuggestedPrompts({ role, pageLabel, snapshot });

  const response = {
    reply: '',
    actions: [],
    suggestedPrompts: pagePrompts
  };

  if (
    normalizedMessage.includes('summary')
    || normalizedMessage.includes('overview')
    || normalizedMessage.includes('what can i do')
    || normalizedMessage.includes('focus')
  ) {
    response.reply = buildOperationalSummary({ role, pageLabel, snapshot, urgentNeeds, openNeeds, pendingReviews, unreadNotifications, escalatedNeeds, lowInventoryItems });
    response.actions = role === 'viewer'
      ? [
          { label: 'Open Transparency', route: '/transparency' },
          { label: 'Open Analytics', route: '/analytics' }
        ]
      : [
          { label: 'Open Mission Control', route: '/dashboard' },
          { label: 'Open Approval Queue', route: '/approval-queue' }
        ];
    return response;
  }

  if (normalizedMessage.includes('urgent') || normalizedMessage.includes('need') || normalizedMessage.includes('escalat')) {
    if (!urgentNeeds.length) {
      response.reply = `There are no high or critical needs live right now. From ${pageLabel}, the main remaining pressure is ${pendingReviews.length} approval draft${pendingReviews.length === 1 ? '' : 's'} and ${unreadNotifications.length} unread notification${unreadNotifications.length === 1 ? '' : 's'}.`;
      response.actions = [
        { label: 'Open Approval Queue', route: '/approval-queue' },
        { label: 'Open Mission Control', route: '/dashboard' }
      ];
      return response;
    }

    const topUrgent = urgentNeeds
      .slice()
      .sort((left, right) => Number(right.escalation?.score || 0) - Number(left.escalation?.score || 0))
      .slice(0, 3)
      .map((need) => `${need.title} in ${need.location} (${need.urgency}, ${need.openSpots} open spots, score ${need.escalation?.score || 0})`)
      .join('; ');

    response.reply = `There are ${urgentNeeds.length} urgent needs and ${escalatedNeeds.length} items already in the escalation workflow. The top priorities are ${topUrgent}. ${role === 'viewer' ? 'Your role is best for monitoring the situation and opening the public-facing views.' : 'Your next best move is to open Mission Control and close the highest-score coverage gaps first.'}`;
    response.actions = [
      { label: 'Open Mission Control', route: '/dashboard' },
      { label: 'Open Analytics', route: '/analytics' }
    ];
    return response;
  }

  if (normalizedMessage.includes('volunteer') || normalizedMessage.includes('assignment') || normalizedMessage.includes('match')) {
    const activeAssignments = snapshot.assignments.filter((assignment) => assignment.status !== 'completed').length;
    const volunteerSummary = topVolunteers.length
      ? topVolunteers.map((volunteer) => `${volunteer.name} (${volunteer.skill}, score ${volunteer.impactScore || 0})`).join('; ')
      : 'the currently registered volunteer pool';

    response.reply = `There are ${snapshot.volunteers.length} volunteers in the system and ${activeAssignments} active assignments. Strong responders right now include ${volunteerSummary}. ${openNeeds.length} need${openNeeds.length === 1 ? ' still needs' : 's still need'} more coverage. ${role === 'admin' || role === 'coordinator' ? 'Use Mission Control to find matches, assign qualified volunteers, and watch badge requirements.' : 'Use the volunteer portal to understand routing, training readiness, and your current field role.'}`;
    response.actions = [
      { label: 'Open Mission Control', route: '/dashboard' },
      { label: 'Open Volunteer Portal', route: '/volunteer' }
    ];
    return response;
  }

  if (normalizedMessage.includes('approval') || normalizedMessage.includes('review') || normalizedMessage.includes('ocr') || normalizedMessage.includes('sms')) {
    const draftHighlights = pendingReviews
      .slice(0, 2)
      .map((item) => item.fields?.title || item.title || 'Untitled draft')
      .join('; ');

    response.reply = `There are ${pendingReviews.length} approval draft${pendingReviews.length === 1 ? '' : 's'} waiting right now. ${draftHighlights ? `The most recent drafts are ${draftHighlights}. ` : ''}${unreadNotifications.length} notification${unreadNotifications.length === 1 ? '' : 's'} remain unread, including intake and workflow alerts when available. ${role === 'admin' || role === 'coordinator' ? 'Open the approval queue to verify extracted fields before publication.' : 'Your role is best for understanding the review flow rather than publishing drafts directly.'}`;
    response.actions = [
      { label: 'Open Approval Queue', route: '/approval-queue' },
      { label: 'Open Data Intake', route: '/intake' }
    ];
    return response;
  }

  if (normalizedMessage.includes('notification') || normalizedMessage.includes('alert')) {
    const latestAlerts = unreadNotifications
      .slice(0, 3)
      .map((notification) => notification.title)
      .join('; ');

    response.reply = unreadNotifications.length
      ? `There are ${unreadNotifications.length} unread notifications. The latest alerts are ${latestAlerts}. ${escalatedNeeds.length ? `There are also ${escalatedNeeds.length} escalated needs that may require coordinator attention.` : ''}`
      : `All notifications are currently read. The main live pressure now is ${openNeeds.length} open need${openNeeds.length === 1 ? '' : 's'} and ${pendingReviews.length} approval draft${pendingReviews.length === 1 ? '' : 's'}.`;
    response.actions = [
      { label: 'Open Mission Control', route: '/dashboard' },
      { label: 'Open Approval Queue', route: '/approval-queue' }
    ];
    return response;
  }

  if (normalizedMessage.includes('intake') || normalizedMessage.includes('scan') || normalizedMessage.includes('form')) {
    response.reply = `The intake flow supports manual entry and OCR-assisted scans. OCR submissions do not go live immediately; they become review drafts first, which is how ResourceSync keeps the AI workflow responsible. ${role === 'admin' || role === 'coordinator' ? 'You can create intake records and move OCR drafts through approval.' : 'You can still understand the workflow here even if your role is more limited operationally.'}`;
    response.actions = [
      { label: 'Open Data Intake', route: '/intake' },
      { label: 'Open Approval Queue', route: '/approval-queue' }
    ];
    return response;
  }

  if (normalizedMessage.includes('analytics') || normalizedMessage.includes('chart') || normalizedMessage.includes('dashboard')) {
    response.reply = `The analytics layer is best for leadership snapshots. Right now it would show ${snapshot.metrics?.totalNeeds || snapshot.needs.length} live needs, ${snapshot.metrics?.activeAssignments || 0} active assignments, ${snapshot.metrics?.escalatedNeeds || escalatedNeeds.length} escalated cases, and ${snapshot.metrics?.lowInventory || lowInventoryItems.length} low-inventory signal${(snapshot.metrics?.lowInventory || lowInventoryItems.length) === 1 ? '' : 's'}. Mission Control is the better place to act; Analytics is the better place to explain.`;
    response.actions = [
      { label: 'Open Analytics', route: '/analytics' },
      { label: 'Open Mission Control', route: '/dashboard' }
    ];
    return response;
  }

  response.reply = buildOperationalSummary({ role, pageLabel, snapshot, urgentNeeds, openNeeds, pendingReviews, unreadNotifications, escalatedNeeds, lowInventoryItems });
  response.actions = defaultActionsForRole(role);
  return response;
}

async function generateChatbotReply({ message, role = 'viewer', pageLabel = 'the current page', snapshot }) {
  if (!hasGeminiKey()) {
    return buildFallbackChatReply({ message, role, pageLabel, snapshot });
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `
    You are the in-app operations assistant for a crisis response platform called ResourceSync.
    Return strict JSON only with keys:
    reply: string
    actions: array of objects with keys label and route
    suggestedPrompts: array of strings

    Rules:
    - Keep the reply concise, practical, operational, and specific to the live snapshot.
    - Be role-aware for this user role: ${role}
    - The user is currently on: ${pageLabel}
    - Only suggest routes from this allowlist: /, /dashboard, /intake, /approval-queue, /volunteer, /login, /register, /analytics, /transparency, /training, /community-report, /partners
    - Suggest at most 3 actions.
    - Suggest at most 4 short follow-up prompts.
    - If the user asks about live status, use the provided operational snapshot and mention concrete counts or titles.
    - Never answer vaguely when the snapshot has enough information.

    User message:
    ${JSON.stringify(message)}

    Operational snapshot:
    ${JSON.stringify(snapshot, null, 2)}
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(text);

    if (!parsed?.reply || !Array.isArray(parsed?.actions)) {
      throw new Error('Invalid chatbot response shape');
    }

    return {
      reply: parsed.reply,
      actions: parsed.actions
        .filter((action) => action?.label && action?.route)
        .slice(0, 3),
      suggestedPrompts: Array.isArray(parsed.suggestedPrompts)
        ? parsed.suggestedPrompts.filter(Boolean).slice(0, 4)
        : buildSuggestedPrompts({ role, pageLabel, snapshot })
    };
  } catch (error) {
    console.error('Chatbot Error:', error);
    return buildFallbackChatReply({ message, role, pageLabel, snapshot });
  }
}

function defaultActionsForRole(role) {
  if (role === 'viewer') {
    return [
      { label: 'Open Transparency', route: '/transparency' },
      { label: 'Open Analytics', route: '/analytics' }
    ];
  }

  if (role === 'field_volunteer') {
    return [
      { label: 'Open Volunteer Portal', route: '/volunteer' },
      { label: 'Open Mission Control', route: '/dashboard' }
    ];
  }

  return [
    { label: 'Open Mission Control', route: '/dashboard' },
    { label: 'Open Approval Queue', route: '/approval-queue' },
    { label: 'Open Analytics', route: '/analytics' }
  ];
}

function buildSuggestedPrompts({ role, pageLabel, snapshot }) {
  const prompts = [];

  if (String(pageLabel).includes('Mission Control')) {
    prompts.push('What are the top 3 urgent needs right now?');
    prompts.push('Which escalations need attention first?');
  }

  if (String(pageLabel).includes('Approval Queue')) {
    prompts.push('Summarize pending approvals');
    prompts.push('What should I verify before approving?');
  }

  if (String(pageLabel).includes('Volunteer')) {
    prompts.push('Explain the volunteer workflow');
    prompts.push('Which volunteers look strongest right now?');
  }

  if (String(pageLabel).includes('landing')) {
    prompts.push('What does this platform do?');
    prompts.push('Which page should I open next?');
  }

  prompts.push(role === 'viewer' ? 'Give me a quick platform summary' : 'What should I focus on first?');
  prompts.push(snapshot.metrics?.urgentNeeds ? 'Which urgent needs still need volunteers?' : 'How does intake and approval work here?');

  return Array.from(new Set(prompts)).slice(0, 4);
}

function buildOperationalSummary({ role, pageLabel, snapshot, urgentNeeds, openNeeds, pendingReviews, unreadNotifications, escalatedNeeds, lowInventoryItems }) {
  const topEscalation = escalatedNeeds[0];
  const topNeedLine = topEscalation
    ? `${topEscalation.title} in ${topEscalation.location} is currently the highest-priority case with a score of ${topEscalation.escalation?.score || 0}/100.`
    : urgentNeeds[0]
      ? `${urgentNeeds[0].title} in ${urgentNeeds[0].location} is currently one of the strongest urgent signals.`
      : 'There is no critical escalation leading the queue right now.';

  const roleLine = role === 'viewer'
    ? 'Your role is read-only, so the best next step is to use transparency and analytics views to understand the operational story.'
    : role === 'field_volunteer'
      ? 'Your role is best suited for understanding assignments, readiness, and field workflows.'
      : 'Your role can act on approvals, assignments, and live response priorities.';

  return `You are on ${pageLabel}. ResourceSync currently has ${snapshot.metrics?.totalNeeds || snapshot.needs.length} live needs, ${openNeeds.length} still needing coverage, ${urgentNeeds.length} urgent cases, ${escalatedNeeds.length} escalated items, ${pendingReviews.length} approval drafts, ${unreadNotifications.length} unread notifications, and ${lowInventoryItems.length} low-inventory signals. ${topNeedLine} ${roleLine}`;
}

module.exports = {
  buildVolunteerRecommendations,
  extractNeedFromImage,
  generateChatbotReply,
  getSmartMatches,
  translateNeeds
};
