const { db, admin } = require('./firebase');

if (!db || !admin) {
  if (process.env.NODE_ENV === 'development') {
    console.warn('Firebase not configured — using in-memory mock DB for development.');
    // Simple in-memory mock data (not persistent)
    const mockParticipants = new Map();
    const mockTeams = new Map();
    let nextId = 1;

    function mkId() { return `mock-${nextId++}`; }

    // Seed one individual and one team for testing
    (function seed() {
      const t1 = { id: mkId(), name: 'Alice Solo', source: 'individual_form', status: 'active', contactName: 'Alice', contactEmail: 'alice@example.com', contactPhone: '555-0101', contactProfile: null, attendanceMarked: false, seatNumber: null, notes: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      mockTeams.set(t1.id, t1);
      const p1 = { id: mkId(), teamId: t1.id, name: t1.contactName, email: t1.contactEmail, phone: t1.contactPhone, profile: null, role: 'leader', original_registration_source: 'individual_form', created_at: t1.createdAt, updated_at: t1.updatedAt };
      mockParticipants.set(p1.id, p1);

      const t2 = { id: mkId(), name: 'Team Beta', source: 'team_form', status: 'active', contactName: 'Bob Lead', contactEmail: 'bob@example.com', contactPhone: '555-0202', contactProfile: null, attendanceMarked: false, seatNumber: null, notes: 'Seed team', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      mockTeams.set(t2.id, t2);
      const leader = { id: mkId(), teamId: t2.id, name: 'Bob Lead', email: 'bob@example.com', phone: '555-0202', profile: null, role: 'leader', original_registration_source: 'team_form', created_at: t2.createdAt, updated_at: t2.updatedAt };
      const member = { id: mkId(), teamId: t2.id, name: 'Carol Member', email: 'carol@example.com', phone: '555-0303', profile: null, role: 'member', original_registration_source: 'team_form', created_at: t2.createdAt, updated_at: t2.updatedAt };
      mockParticipants.set(leader.id, leader);
      mockParticipants.set(member.id, member);
    }());

    async function listTeams(view = 'all') {
      const teams = Array.from(mockTeams.values());
      const filtered = teams.filter((team) => {
        if (view === 'individuals') return team.source === 'individual_form';
        if (view === 'teams') return team.source !== 'individual_form';
        return true;
      });
      return filtered.map((team) => {
        const participants = Array.from(mockParticipants.values()).filter((p) => p.teamId === team.id);
        return {
          id: team.id,
          name: team.name,
          source: team.source,
          status: team.status,
          contact_name: team.contactName,
          contact_email: team.contactEmail,
          contact_phone: team.contactPhone || null,
          contact_profile: team.contactProfile || null,
          attendance_marked: !!team.attendanceMarked,
          seat_number: team.seatNumber || null,
          notes: team.notes || null,
          created_at: team.createdAt,
          updated_at: team.updatedAt,
          participants: participants.map((p) => ({ ...p }))
        };
      });
    }

    async function createIndividualRegistration({ name, email, phone, profile, notes }) {
      const teamId = mkId();
      const now = new Date().toISOString();
      const team = { id: teamId, name, source: 'individual_form', status: 'active', contactName: name, contactEmail: email, contactPhone: phone || null, contactProfile: profile || null, attendanceMarked: false, seatNumber: null, notes: notes || null, createdAt: now, updatedAt: now };
      mockTeams.set(teamId, team);
      const pid = mkId();
      const participant = { id: pid, teamId, name, email, phone: phone || null, profile: profile || null, role: 'leader', original_registration_source: 'individual_form', created_at: now, updated_at: now };
      mockParticipants.set(pid, participant);
      return { id: teamId };
    }

    async function createTeamRegistration({ teamName, leader, members = [], notes }) {
      const teamId = mkId();
      const now = new Date().toISOString();
      const team = { id: teamId, name: teamName, source: 'team_form', status: 'active', contactName: leader.name, contactEmail: leader.email, contactPhone: leader.phone || null, contactProfile: leader.profile || null, attendanceMarked: false, seatNumber: null, notes: notes || null, createdAt: now, updatedAt: now };
      mockTeams.set(teamId, team);
      const leaderId = mkId();
      mockParticipants.set(leaderId, { id: leaderId, teamId, name: leader.name, email: leader.email, phone: leader.phone || null, profile: leader.profile || null, role: 'leader', original_registration_source: 'team_form', created_at: now, updated_at: now });
      members.slice(0, 3).forEach((m) => {
        const mid = mkId();
        mockParticipants.set(mid, { id: mid, teamId, name: m.name || '', email: m.email || '', phone: m.phone || null, profile: m.profile || null, role: 'member', original_registration_source: 'team_form', created_at: now, updated_at: now });
      });
      return { id: teamId };
    }

    async function teamUpIndividuals({ participantIds, teamName, contactParticipantId, notes }) {
      const now = new Date().toISOString();
      const newTeamId = mkId();
      const leaderId = participantIds.includes(contactParticipantId) ? contactParticipantId : participantIds[0];
      const leader = mockParticipants.get(leaderId);
      const team = { id: newTeamId, name: teamName, source: 'admin_team_up', status: 'active', contactName: leader?.name || '', contactEmail: leader?.email || '', contactPhone: leader?.phone || null, contactProfile: leader?.profile || null, attendanceMarked: false, seatNumber: null, notes: notes || null, createdAt: now, updatedAt: now };
      mockTeams.set(newTeamId, team);
      participantIds.forEach((pid) => {
        const p = mockParticipants.get(pid);
        if (p) p.teamId = newTeamId, p.role = p.id === leaderId ? 'leader' : 'member';
      });
      return { newTeamId };
    }

    async function markAttendance({ teamId, present = true, seatNumber }) {
      const team = mockTeams.get(teamId);
      if (!team) throw new Error('Team not found');
      team.attendanceMarked = !!present;
      team.seatNumber = present ? (seatNumber || '1') : null;
      team.updatedAt = new Date().toISOString();
      return { teamId, attendanceMarked: team.attendanceMarked, seatNumber: team.seatNumber };
    }

    async function exportTeams(view = 'all') {
      const teams = await listTeams(view);
    // Include Team ID and Participant ID so rows clearly map participants to teams
    const header = ['Team ID','Team Name','Team Source','Team Status','Contact Name','Contact Email','Contact Phone','Contact Profile','Attendance Marked','Seat / Room','Participant Role','Participant ID','Participant Name','Participant Email','Participant Phone','Participant Profile','Participant Origin','Team Notes','Created At','Updated At'];
      const rows = teams.flatMap((team) => {
        const participants = team.participants.length ? team.participants : [null];
        return participants.map((participant) => ([
          team.id,
          team.name,
          team.source,
          team.status,
          team.contact_name || '',
          team.contact_email || '',
          team.contact_phone || '',
          team.contact_profile || '',
          team.attendance_marked ? 'Yes' : 'No',
          team.seat_number || '',
          participant?.role || '',
          participant?.id || '',
          participant?.name || '',
          participant?.email || '',
          participant?.phone || '',
          participant?.profile || '',
          participant?.original_registration_source || '',
          team.notes || '',
          team.created_at || '',
          team.updated_at || ''
        ]));
      });
      return [header, ...rows];
    }

    module.exports = {
      createIndividualRegistration,
      createTeamRegistration,
      listTeams,
      teamUpIndividuals,
      markAttendance,
      exportTeams
    };
  }

  // Non-development (production) without Firebase: export throwing stubs
  module.exports = {
    createIndividualRegistration: async () => { throw new Error('Database not configured. Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_CREDENTIALS.'); },
    createTeamRegistration: async () => { throw new Error('Database not configured.'); },
    listTeams: async () => { throw new Error('Database not configured.'); },
    teamUpIndividuals: async () => { throw new Error('Database not configured.'); },
    markAttendance: async () => { throw new Error('Database not configured.'); },
    exportTeams: async () => { throw new Error('Database not configured.'); }
  };
}

const teamsCollection = db.collection('teams');
const participantsCollection = db.collection('participants');
const attendanceSettingsRef = db.collection('settings').doc('attendance');

const FieldValue = admin.firestore.FieldValue;
const MAX_TEAM_UP_SELECTION = 4;

function sanitizeString(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

function normalizeOptional(value) {
  const sanitized = sanitizeString(value);
  return sanitized.length ? sanitized : null;
}

function serializeTimestamp(timestamp) {
  if (!timestamp) {
    return null;
  }
  if (typeof timestamp.toDate === 'function') {
    return timestamp.toDate().toISOString();
  }
  return null;
}

async function createIndividualRegistration({ name, email, phone, profile, notes }) {
  const contactName = sanitizeString(name);
  const contactEmail = sanitizeString(email);

  if (!contactName || !contactEmail) {
    throw new Error('Name and email are required.');
  }

  const contactPhone = normalizeOptional(phone);
  const contactProfile = normalizeOptional(profile);
  const teamNotes = normalizeOptional(notes);

  const result = await db.runTransaction(async (transaction) => {
    const teamRef = teamsCollection.doc();
    const now = FieldValue.serverTimestamp();

    transaction.set(teamRef, {
      name: contactName,
      source: 'individual_form',
      status: 'active',
      contactName,
      contactEmail,
      contactPhone,
      contactProfile,
      attendanceMarked: false,
      seatNumber: null,
      notes: teamNotes,
      createdAt: now,
      updatedAt: now
    });

    const participantRef = participantsCollection.doc();
    transaction.set(participantRef, {
      teamId: teamRef.id,
      name: contactName,
      email: contactEmail,
      phone: contactPhone,
      profile: contactProfile,
      role: 'leader',
      originalRegistrationSource: 'individual_form',
      createdAt: now,
      updatedAt: now
    });

    return { teamId: teamRef.id };
  });

  return {
    id: result.teamId,
    name: contactName,
    source: 'individual_form'
  };
}

async function createTeamRegistration({ teamName, leader, members = [], notes }) {
  const sanitizedTeamName = sanitizeString(teamName);
  if (!sanitizedTeamName) {
    throw new Error('Team name is required.');
  }

  const leaderName = sanitizeString(leader?.name);
  const leaderEmail = sanitizeString(leader?.email);

  if (!leaderName || !leaderEmail) {
    throw new Error('Leader name and email are required.');
  }

  const leaderPhone = normalizeOptional(leader?.phone);
  const leaderProfile = normalizeOptional(leader?.profile);
  const teamNotes = normalizeOptional(notes);

  const normalizedMembers = Array.isArray(members)
    ? members
        .slice(0, MAX_TEAM_UP_SELECTION - 1)
        .map((member) => ({
          name: sanitizeString(member?.name),
          email: sanitizeString(member?.email),
          phone: normalizeOptional(member?.phone),
          profile: normalizeOptional(member?.profile)
        }))
        .filter((member) => member.name || member.email || member.phone || member.profile)
    : [];

  const result = await db.runTransaction(async (transaction) => {
    const teamRef = teamsCollection.doc();
    const now = FieldValue.serverTimestamp();

    transaction.set(teamRef, {
      name: sanitizedTeamName,
      source: 'team_form',
      status: 'active',
      contactName: leaderName,
      contactEmail: leaderEmail,
      contactPhone: leaderPhone,
      contactProfile: leaderProfile,
      attendanceMarked: false,
      seatNumber: null,
      notes: teamNotes,
      createdAt: now,
      updatedAt: now
    });

    const leaderRef = participantsCollection.doc();
    transaction.set(leaderRef, {
      teamId: teamRef.id,
      name: leaderName,
      email: leaderEmail,
      phone: leaderPhone,
      profile: leaderProfile,
      role: 'leader',
      originalRegistrationSource: 'team_form',
      createdAt: now,
      updatedAt: now
    });

    normalizedMembers.forEach((member) => {
      const participantRef = participantsCollection.doc();
      transaction.set(participantRef, {
        teamId: teamRef.id,
        name: member.name,
        email: member.email,
        phone: member.phone,
        profile: member.profile,
        role: 'member',
        originalRegistrationSource: 'team_form',
        createdAt: now,
        updatedAt: now
      });
    });

    return { teamId: teamRef.id };
  });

  return {
    id: result.teamId,
    name: sanitizedTeamName,
    source: 'team_form'
  };
}

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function fetchParticipantsByTeamIds(teamIds) {
  const map = new Map();
  const chunks = chunkArray(teamIds, 10);

  await Promise.all(
    chunks.map(async (chunk) => {
      if (!chunk.length) {
        return;
      }
      const snapshot = await participantsCollection.where('teamId', 'in', chunk).get();
      snapshot.forEach((doc) => {
        const data = doc.data();
        const participants = map.get(data.teamId) || [];
        participants.push({
          id: doc.id,
          name: data.name,
          email: data.email,
          phone: data.phone || null,
          profile: data.profile || null,
          role: data.role,
          original_registration_source: data.originalRegistrationSource,
          created_at: serializeTimestamp(data.createdAt),
          updated_at: serializeTimestamp(data.updatedAt)
        });
        map.set(data.teamId, participants);
      });
    })
  );

  return map;
}

async function listTeams(view = 'all') {
  const snapshot = await teamsCollection.where('status', '==', 'active').get();
  const teams = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  const filtered = teams.filter((team) => {
    if (view === 'individuals') {
      return team.source === 'individual_form';
    }
    if (view === 'teams') {
      return team.source !== 'individual_form';
    }
    return true;
  });

  const participantsMap = await fetchParticipantsByTeamIds(filtered.map((team) => team.id));

  return filtered.map((team) => ({
    id: team.id,
    name: team.name,
    source: team.source,
    status: team.status,
    contact_name: team.contactName,
    contact_email: team.contactEmail,
    contact_phone: team.contactPhone || null,
    contact_profile: team.contactProfile || null,
    attendance_marked: !!team.attendanceMarked,
    seat_number: team.seatNumber || null,
    notes: team.notes || null,
    created_at: serializeTimestamp(team.createdAt),
    updated_at: serializeTimestamp(team.updatedAt),
    participants: (participantsMap.get(team.id) || []).sort((a, b) => {
      if (a.role === b.role) {
        return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      }
      return a.role === 'leader' ? -1 : 1;
    })
  }));
}

async function teamUpIndividuals({ participantIds, teamName, contactParticipantId, notes }) {
  if (!Array.isArray(participantIds) || participantIds.length < 2) {
    throw new Error('At least two participants are required to form a team.');
  }

  if (participantIds.length > MAX_TEAM_UP_SELECTION) {
    throw new Error(`You can only combine up to ${MAX_TEAM_UP_SELECTION} solo participants.`);
  }

  const sanitizedTeamName = sanitizeString(teamName);
  if (!sanitizedTeamName) {
    throw new Error('Team name is required.');
  }

  const sanitizedNotes = normalizeOptional(notes);

  const result = await db.runTransaction(async (transaction) => {
    const participantDocs = await Promise.all(
      participantIds.map((id) => transaction.get(participantsCollection.doc(id)))
    );

    const participants = participantDocs.map((doc) => {
      if (!doc.exists) {
        throw new Error('One or more participants could not be found.');
      }
      const data = doc.data();
      return {
        id: doc.id,
        teamId: data.teamId,
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        profile: data.profile || null,
        role: data.role,
        originalRegistrationSource: data.originalRegistrationSource
      };
    });

    const teamIds = Array.from(new Set(participants.map((participant) => participant.teamId)));
    const teamDocs = await Promise.all(teamIds.map((id) => transaction.get(teamsCollection.doc(id))));

    teamDocs.forEach((doc) => {
      if (!doc.exists) {
        throw new Error('Original team not found for a participant.');
      }
      const teamData = doc.data();
      if (teamData.status !== 'active' || teamData.source !== 'individual_form') {
        throw new Error('Only active individual registrations can be teamed up.');
      }
    });

    const leaderId = participantIds.includes(contactParticipantId)
      ? contactParticipantId
      : participants[0].id;
    const leaderParticipant = participants.find((participant) => participant.id === leaderId);

    if (!leaderParticipant) {
      throw new Error('Leader participant must be part of the selection.');
    }

    const now = FieldValue.serverTimestamp();
    const newTeamRef = teamsCollection.doc();

    transaction.set(newTeamRef, {
      name: sanitizedTeamName,
      source: 'admin_team_up',
      status: 'active',
      contactName: leaderParticipant.name,
      contactEmail: leaderParticipant.email,
      contactPhone: leaderParticipant.phone || null,
      contactProfile: leaderParticipant.profile || null,
      attendanceMarked: false,
      seatNumber: null,
      notes: sanitizedNotes,
      createdAt: now,
      updatedAt: now
    });

    participants.forEach((participant) => {
      const participantRef = participantsCollection.doc(participant.id);
      transaction.update(participantRef, {
        teamId: newTeamRef.id,
        role: participant.id === leaderParticipant.id ? 'leader' : 'member',
        updatedAt: now
      });
    });

    teamIds.forEach((id) => {
      const teamRef = teamsCollection.doc(id);
      transaction.update(teamRef, {
        status: 'converted',
        updatedAt: now
      });
    });

    return { newTeamId: newTeamRef.id };
  });

  return result;
}

async function markAttendance({ teamId, present = true, seatNumber }) {
  const normalizedSeatInput = normalizeOptional(seatNumber);

  const result = await db.runTransaction(async (transaction) => {
    const teamRef = teamsCollection.doc(teamId);
    const teamDoc = await transaction.get(teamRef);

    if (!teamDoc.exists) {
      throw new Error('Team not found.');
    }

    const teamData = teamDoc.data();
    if (teamData.status !== 'active') {
      throw new Error('Cannot mark attendance for inactive teams.');
    }

    let resolvedSeat = null;

    if (present) {
      if (normalizedSeatInput) {
        resolvedSeat = normalizedSeatInput;
      } else {
        const attendanceDoc = await transaction.get(attendanceSettingsRef);
        const lastSeatNumber = attendanceDoc.exists ? attendanceDoc.data().lastSeatNumber || 0 : 0;
        resolvedSeat = String(lastSeatNumber + 1);
        transaction.set(attendanceSettingsRef, { lastSeatNumber: lastSeatNumber + 1 }, { merge: true });
      }
    }

    transaction.update(teamRef, {
      attendanceMarked: !!present,
      seatNumber: present ? resolvedSeat : null,
      updatedAt: FieldValue.serverTimestamp()
    });

    return {
      teamId,
      attendanceMarked: !!present,
      seatNumber: present ? resolvedSeat : null
    };
  });

  return result;
}

async function exportTeams(view = 'all') {
  const activeTeams = await listTeams(view);
  // Include Team ID and Participant ID so each row clearly maps participants to teams
  const header = [
    'Team ID',
    'Team Name',
    'Team Source',
    'Team Status',
    'Contact Name',
    'Contact Email',
    'Contact Phone',
    'Contact Profile',
    'Attendance Marked',
    'Seat / Room',
    'Participant Role',
    'Participant ID',
    'Participant Name',
    'Participant Email',
    'Participant Phone',
    'Participant Profile',
    'Participant Origin',
    'Team Notes',
    'Created At',
    'Updated At'
  ];

  const rows = activeTeams.flatMap((team) => {
    const participants = team.participants.length ? team.participants : [null];
    return participants.map((participant) => ([
      team.id,
      team.name,
      team.source,
      team.status,
      team.contact_name || '',
      team.contact_email || '',
      team.contact_phone || '',
      team.contact_profile || '',
      team.attendance_marked ? 'Yes' : 'No',
      team.seat_number || '',
      participant?.role || '',
      participant?.id || '',
      participant?.name || '',
      participant?.email || '',
      participant?.phone || '',
      participant?.profile || '',
      participant?.original_registration_source || '',
      team.notes || '',
      team.created_at || '',
      team.updated_at || ''
    ]));
  });

  return [header, ...rows];
}

module.exports = {
  createIndividualRegistration,
  createTeamRegistration,
  listTeams,
  teamUpIndividuals,
  markAttendance,
  exportTeams
};
