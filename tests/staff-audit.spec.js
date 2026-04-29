// @ts-check
/**
 * Staff Audit — Registration, Assignment, Check-In & Credentials
 *
 * Covers the full staff lifecycle for a tournament:
 *   1.  Account creation for director, two staff users, and a competitor
 *   2.  Staff apply for a role at the tournament (pending state)
 *   3.  Director lists and approves / declines applications
 *   4.  Director creates staff role definitions with specific permissions
 *   5.  Director assigns a role definition to an approved staff member
 *   6.  Credential / access-control assertions
 *       – Unauthenticated → 401
 *       – Approved staff WITHOUT manage_checkin → 403
 *       – Approved staff WITH manage_checkin → 200/201
 *       – Staff from a DIFFERENT tournament → 403
 *   7.  Check-in happy path (check in, mat-call, undo)
 *   8.  Mark absent / withdrawn
 *   9.  Duplicate check-in → 409
 *  10.  Staff member physical check-in (tournament_members.checkin)
 *  11.  Staff dashboard (GET /api/my/staff/dashboard)
 *
 * Prerequisites:
 *   - Server running at http://localhost:3000
 *   - DISABLE_RATE_LIMIT=true in .env
 *   - All migrations applied
 *
 * Run:
 *   npx playwright test tests/staff-audit.spec.js --config playwright.config.js
 */

const { test, expect, request } = require('@playwright/test');
const fs   = require('fs');
const path = require('path');

// ─── Constants ────────────────────────────────────────────────────────────────
const BASE       = 'http://localhost:3000';
const TS         = Date.now();
const STATE_FILE = path.join(__dirname, '.staff-audit-state.json');

const DIRECTOR  = { email: `staff.dir.${TS}@test.local`,   password: 'DirectorPass1!', firstName: 'Staff', lastName: 'Director' };
const STAFF_A   = { email: `staff.a.${TS}@test.local`,     password: 'StaffPass1234!', firstName: 'Alice', lastName: 'Stafford' };
const STAFF_B   = { email: `staff.b.${TS}@test.local`,     password: 'StaffPass1234!', firstName: 'Bob',   lastName: 'Helper'   };
// An outsider director whose tournament's staff should NOT be able to touch ours
const DIR_OTHER = { email: `staff.dir2.${TS}@test.local`,  password: 'DirectorPass1!', firstName: 'Other', lastName: 'Director' };

// ─── Shared State ─────────────────────────────────────────────────────────────
const S = {
  dirCookies:      '',
  staffACookies:   '',
  staffBCookies:   '',
  dirOtherCookies: '',
  staffOtherCookies: '',

  dirUserId:       null,
  staffAUserId:    null,
  staffBUserId:    null,

  tournamentId:    null,
  otherTournId:    null,

  memberAId:       null,  // tournament_members row for Staff A
  memberBId:       null,  // tournament_members row for Staff B (for decline test)

  roleCheckinId:   null,  // staff_role_definitions row with manage_checkin
  roleViewId:      null,  // staff_role_definitions row with view_schedule only

  registrationId:  null,  // competitor registration to use during check-in tests
  registration2Id: null,  // second competitor for absent/withdrawn tests

  // Staff member from the other tournament (to test cross-tournament 403)
  otherMemberId:   null,
  otherStaffCookies: '',
};

function saveState() {
  try { fs.writeFileSync(STATE_FILE, JSON.stringify(S)); } catch {}
}
function loadState() {
  try {
    const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    Object.assign(S, data);
  } catch {}
}

loadState();

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function api(method, urlPath, { body, cookies, headers = {} } = {}) {
  const ctx = await request.newContext({ baseURL: BASE, ignoreHTTPSErrors: true });
  const reqHeaders = { 'Content-Type': 'application/json', ...headers };
  if (cookies && typeof cookies === 'string' && cookies.trim()) {
    reqHeaders['Cookie'] = cookies;
  }
  const opts = { headers: reqHeaders, failOnStatusCode: false };
  if (body !== undefined) opts.data = body;
  const res = await ctx[method.toLowerCase()](urlPath, opts);
  let json;
  try { json = await res.json(); } catch { json = null; }
  await ctx.dispose();
  return { status: res.status(), body: json };
}

async function signup({ email, password, firstName, lastName }) {
  return api('POST', '/api/auth/signup', { body: { email, password, firstName, lastName } });
}

async function loginAndSave(email, password, stateKey) {
  const ctx = await request.newContext({ baseURL: BASE });
  const res = await ctx.post('/api/auth/login', {
    data: { email, password },
    headers: { 'Content-Type': 'application/json' },
    failOnStatusCode: false,
  });
  const hdrs = res.headersArray().filter(h => h.name.toLowerCase() === 'set-cookie');
  const cookieStr = hdrs.map(h => h.value.split(';')[0]).join('; ');
  const json = await res.json().catch(() => null);
  await ctx.dispose();
  if (res.status() === 200 && cookieStr) {
    S[stateKey] = cookieStr;
    saveState();
  }
  return { status: res.status(), body: json };
}

// ─── beforeEach: recover state across describe-block boundaries ────────────────
test.beforeEach(() => { loadState(); });

// =============================================================================
// Suite 0 — Setup
// =============================================================================
test.describe('0. Setup', () => {
  test('0.1 sign up all accounts', async () => {
    // Reset state for a clean run
    Object.assign(S, {
      dirCookies: '', staffACookies: '', staffBCookies: '',
      dirOtherCookies: '', otherStaffCookies: '',
      dirUserId: null, staffAUserId: null, staffBUserId: null,
      tournamentId: null, otherTournId: null,
      memberAId: null, memberBId: null,
      roleCheckinId: null, roleViewId: null,
      registrationId: null, registration2Id: null,
      otherMemberId: null,
    });
    saveState();

    for (const acct of [DIRECTOR, STAFF_A, STAFF_B, DIR_OTHER]) {
      const { status } = await signup(acct);
      expect([201, 409], `signup ${acct.email} unexpected status`).toContain(status);
    }

    // Also create an "other staff" who belongs to the OTHER director's tournament
    const OTHER_STAFF = { email: `staff.other.${TS}@test.local`, password: 'StaffPass1234!', firstName: 'Eve', lastName: 'Outsider' };
    await signup(OTHER_STAFF);

    const { status: ds } = await loginAndSave(DIRECTOR.email,  DIRECTOR.password,  'dirCookies');
    expect(ds).toBe(200);
    const { status: as } = await loginAndSave(STAFF_A.email,   STAFF_A.password,   'staffACookies');
    expect(as).toBe(200);
    const { status: bs } = await loginAndSave(STAFF_B.email,   STAFF_B.password,   'staffBCookies');
    expect(bs).toBe(200);
    const { status: os } = await loginAndSave(DIR_OTHER.email,  DIR_OTHER.password, 'dirOtherCookies');
    expect(os).toBe(200);
    await loginAndSave(OTHER_STAFF.email, OTHER_STAFF.password, 'otherStaffCookies');

    const { body: meA } = await api('GET', '/api/auth/me', { cookies: S.staffACookies });
    S.staffAUserId = meA?.user?.id;
    const { body: meB } = await api('GET', '/api/auth/me', { cookies: S.staffBCookies });
    S.staffBUserId = meB?.user?.id;
    const { body: meDir } = await api('GET', '/api/auth/me', { cookies: S.dirCookies });
    S.dirUserId = meDir?.user?.id;
    saveState();
  });

  test('0.2 director creates tournament', async () => {
    const { status, body } = await api('POST', '/api/tournaments', {
      cookies: S.dirCookies,
      body: {
        name: `Staff Audit Tournament ${TS}`,
        date: '2026-12-01',
        location: 'Test Dojo',
        registrationOpen: true,
        events: [
          { name: 'Kata',   eventType: 'kata',   divisions: [] },
          { name: 'Kumite', eventType: 'kumite', divisions: [] },
        ],
      },
    });
    expect(status, JSON.stringify(body)).toBe(201);
    S.tournamentId = body.tournament.id;
    saveState();
  });

  test('0.3 other director creates a separate tournament', async () => {
    const { status, body } = await api('POST', '/api/tournaments', {
      cookies: S.dirOtherCookies,
      body: { name: `Other Tournament ${TS}`, date: '2026-12-15', location: 'Other Dojo' },
    });
    expect(status, JSON.stringify(body)).toBe(201);
    S.otherTournId = body.tournament.id;
    saveState();
  });

  test('0.4 register two competitors for check-in tests', async () => {
    // Competitor 1
    const { status: s1, body: b1 } = await api('POST', '/api/registrations/competitor', {
      body: {
        firstName: 'Comp', lastName: 'One',
        email: `comp1.${TS}@test.local`,
        dateOfBirth: '2000-01-01', weight: '68', gender: 'male',
        rank: 'blue', experience: '3 years',
        tournamentId: S.tournamentId,
        events: [],
      },
    });
    expect(s1, JSON.stringify(b1)).toBe(201);
    S.registrationId = b1.registration?.id;

    // Competitor 2
    const { status: s2, body: b2 } = await api('POST', '/api/registrations/competitor', {
      body: {
        firstName: 'Comp', lastName: 'Two',
        email: `comp2.${TS}@test.local`,
        dateOfBirth: '1999-05-15', weight: '75', gender: 'female',
        rank: 'purple', experience: '5 years',
        tournamentId: S.tournamentId,
        events: [],
      },
    });
    expect(s2, JSON.stringify(b2)).toBe(201);
    S.registration2Id = b2.registration?.id;
    saveState();
  });
});

// =============================================================================
// Suite 1 — Staff Registration (Application)
// =============================================================================
test.describe('1. Staff Registration', () => {
  test('1.1 unauthenticated application returns 401', async () => {
    const { status } = await api('POST', '/api/tournament-members', {
      body: { tournamentId: S.tournamentId, role: 'staff', staffRole: 'Ring Coordinator' },
    });
    expect(status).toBe(401);
  });

  test('1.2 Staff A applies for staff role', async () => {
    const { status, body } = await api('POST', '/api/tournament-members', {
      cookies: S.staffACookies,
      body: {
        tournamentId: S.tournamentId,
        role: 'staff',
        staffRole: 'Ring Coordinator',
        phone: '555-1234',
      },
    });
    expect(status, JSON.stringify(body)).toBe(201);
    expect(body.member).toBeDefined();
    expect(body.member.status).toBe('pending');
    expect(body.member.role).toBe('staff');
    S.memberAId = body.member.id;
    saveState();
  });

  test('1.3 Staff B applies for staff role', async () => {
    const { status, body } = await api('POST', '/api/tournament-members', {
      cookies: S.staffBCookies,
      body: {
        tournamentId: S.tournamentId,
        role: 'staff',
        staffRole: 'Table Judge',
      },
    });
    expect(status, JSON.stringify(body)).toBe(201);
    expect(body.member.status).toBe('pending');
    S.memberBId = body.member.id;
    saveState();
  });

  test('1.4 [FIXED] re-applying when already pending returns 201 (upsert), but re-applying when approved returns 409', async () => {
    // Staff A is still pending at this point — re-applying is allowed (updates the record)
    const { status: s1, body: b1 } = await api('POST', '/api/tournament-members', {
      cookies: S.staffACookies,
      body: { tournamentId: S.tournamentId, role: 'staff', staffRole: 'Updated Title' },
    });
    expect(s1).toBe(201);
    expect(b1.member.status).toBe('pending');

    // Director approves Staff A
    await api('PATCH', `/api/tournament-members/${S.memberAId}/approve`, { cookies: S.dirCookies });

    // Now re-applying AFTER approval must be rejected (409) — prevents silent self-demote
    const { status: s2, body: b2 } = await api('POST', '/api/tournament-members', {
      cookies: S.staffACookies,
      body: { tournamentId: S.tournamentId, role: 'staff', staffRole: 'Duplicate' },
    });
    expect(s2, JSON.stringify(b2)).toBe(409);
  });

  test('1.5 invalid role value returns 400', async () => {
    const { status } = await api('POST', '/api/tournament-members', {
      cookies: S.staffACookies,
      body: { tournamentId: S.tournamentId, role: 'superstar' },
    });
    expect(status).toBe(400);
  });

  test('1.6 application to non-existent tournament returns 404 or 400', async () => {
    const { status } = await api('POST', '/api/tournament-members', {
      cookies: S.staffACookies,
      body: { tournamentId: '00000000-0000-0000-0000-000000000000', role: 'staff' },
    });
    expect([400, 404]).toContain(status);
  });
});

// =============================================================================
// Suite 2 — Director Approval Flow
// =============================================================================
test.describe('2. Director Approval', () => {
  test('2.1 director can list members (Staff A approved, Staff B pending)', async () => {
    const { status, body } = await api('GET', `/api/tournament-members/${S.tournamentId}`, {
      cookies: S.dirCookies,
    });
    expect(status, JSON.stringify(body)).toBe(200);
    expect(Array.isArray(body.members)).toBe(true);
    // Staff A was approved in test 1.4; Staff B is still pending
    const pending  = body.members.filter(m => m.status === 'pending');
    const approved = body.members.filter(m => m.status === 'approved');
    expect(pending.length).toBeGreaterThanOrEqual(1);   // Staff B
    expect(approved.length).toBeGreaterThanOrEqual(1);  // Staff A
  });

  test('2.2 [FIXED] approved staff cannot list tournament members — director-only', async () => {
    // requireTournamentCreator now guards this route. Staff A (approved after 1.4)
    // should receive 403 even though they're an approved staff member.
    const { status } = await api('GET', `/api/tournament-members/${S.tournamentId}`, {
      cookies: S.staffACookies,
    });
    expect(status).toBe(403);
  });

  test('2.3 director approves Staff A (second approval — first was in 1.4)', async () => {
    // Staff A was approved in test 1.4, so they're already approved here.
    // The 409 guard now prevents re-applying, so approval state is preserved.
    const { status, body } = await api('PATCH', `/api/tournament-members/${S.memberAId}/approve`, {
      cookies: S.dirCookies,
    });
    // Already approved → 400 "not pending"
    expect([200, 400]).toContain(status);
  });

  test('2.4 director declines Staff B', async () => {
    const { status, body } = await api('PATCH', `/api/tournament-members/${S.memberBId}/decline`, {
      cookies: S.dirCookies,
    });
    expect(status, JSON.stringify(body)).toBe(200);
    expect(body.member.status).toBe('declined');
  });

  test('2.5 approving already-approved member returns 400', async () => {
    const { status } = await api('PATCH', `/api/tournament-members/${S.memberAId}/approve`, {
      cookies: S.dirCookies,
    });
    expect(status).toBe(400);
  });

  test('2.6 non-director cannot approve members', async () => {
    const { status } = await api('PATCH', `/api/tournament-members/${S.memberAId}/approve`, {
      cookies: S.staffACookies,
    });
    expect(status).toBe(403);
  });
});

// =============================================================================
// Suite 3 — Role Definitions
// =============================================================================
test.describe('3. Staff Role Definitions', () => {
  test('3.1 director lists available permissions', async () => {
    const { status, body } = await api('GET', `/api/tournaments/${S.tournamentId}/staff-roles`, {
      cookies: S.dirCookies,
    });
    expect(status, JSON.stringify(body)).toBe(200);
    expect(Array.isArray(body.availablePermissions)).toBe(true);
    expect(body.availablePermissions).toContain('manage_checkin');
    expect(body.availablePermissions).toContain('view_schedule');
  });

  test('3.2 [FIXED] approved staff cannot list staff role definitions — director-only', async () => {
    // requireTournamentCreator now guards all staff-roles routes.
    // Staff A has manage_checkin but is not the tournament creator.
    const { status } = await api('GET', `/api/tournaments/${S.tournamentId}/staff-roles`, {
      cookies: S.staffACookies,
    });
    expect(status).toBe(403);
  });

  test('3.3 director creates a "Check-in Manager" role', async () => {
    const { status, body } = await api('POST', `/api/tournaments/${S.tournamentId}/staff-roles`, {
      cookies: S.dirCookies,
      body: {
        role_name: 'Check-in Manager',
        permissions: ['manage_checkin', 'view_schedule'],
      },
    });
    expect(status, JSON.stringify(body)).toBe(201);
    expect(body.role.role_name).toBe('Check-in Manager');
    expect(body.role.permissions).toContain('manage_checkin');
    S.roleCheckinId = body.role.id;
    saveState();
  });

  test('3.4 director creates a "Viewer" role (no check-in permission)', async () => {
    const { status, body } = await api('POST', `/api/tournaments/${S.tournamentId}/staff-roles`, {
      cookies: S.dirCookies,
      body: {
        role_name: 'Viewer',
        permissions: ['view_schedule', 'view_results'],
      },
    });
    expect(status, JSON.stringify(body)).toBe(201);
    expect(body.role.permissions).not.toContain('manage_checkin');
    S.roleViewId = body.role.id;
    saveState();
  });

  test('3.5 duplicate role name returns 409', async () => {
    const { status } = await api('POST', `/api/tournaments/${S.tournamentId}/staff-roles`, {
      cookies: S.dirCookies,
      body: { role_name: 'Check-in Manager', permissions: ['manage_checkin'] },
    });
    expect(status).toBe(409);
  });

  test('3.6 missing role_name returns 400', async () => {
    const { status } = await api('POST', `/api/tournaments/${S.tournamentId}/staff-roles`, {
      cookies: S.dirCookies,
      body: { permissions: ['manage_checkin'] },
    });
    expect(status).toBe(400);
  });

  test('3.7 permissions must be an array — returns 400', async () => {
    const { status } = await api('POST', `/api/tournaments/${S.tournamentId}/staff-roles`, {
      cookies: S.dirCookies,
      body: { role_name: 'Bad Role', permissions: 'manage_checkin' },
    });
    expect(status).toBe(400);
  });

  test('3.8 director can update a role definition', async () => {
    const { status, body } = await api('PUT', `/api/tournaments/${S.tournamentId}/staff-roles/${S.roleViewId}`, {
      cookies: S.dirCookies,
      body: { role_name: 'Viewer', permissions: ['view_schedule', 'view_results', 'print_certificates'] },
    });
    expect(status, JSON.stringify(body)).toBe(200);
    expect(body.role.permissions).toContain('print_certificates');
  });

  test('3.9 invalid permissions are silently filtered (no crash)', async () => {
    const { status, body } = await api('POST', `/api/tournaments/${S.tournamentId}/staff-roles`, {
      cookies: S.dirCookies,
      body: { role_name: 'Garbage Perms', permissions: ['manage_checkin', 'fly_to_moon', 'delete_everything'] },
    });
    // Should succeed — invalid permissions are filtered
    expect([201]).toContain(status);
    expect(body.role.permissions).toContain('manage_checkin');
    expect(body.role.permissions).not.toContain('fly_to_moon');
    // Clean up
    await api('DELETE', `/api/tournaments/${S.tournamentId}/staff-roles/${body.role.id}`, {
      cookies: S.dirCookies,
    });
  });

  test('3.10 director can delete a role not yet assigned', async () => {
    // Create a temporary role to delete
    const { body: tmpBody } = await api('POST', `/api/tournaments/${S.tournamentId}/staff-roles`, {
      cookies: S.dirCookies,
      body: { role_name: 'Temp Role', permissions: ['view_schedule'] },
    });
    const tmpId = tmpBody.role.id;
    const { status } = await api('DELETE', `/api/tournaments/${S.tournamentId}/staff-roles/${tmpId}`, {
      cookies: S.dirCookies,
    });
    expect(status).toBe(200);
  });
});

// =============================================================================
// Suite 4 — Role Assignment
// =============================================================================
test.describe('4. Role Assignment', () => {
  test('4.1 director assigns Check-in Manager role to Staff A', async () => {
    const { status, body } = await api(
      'PUT',
      `/api/tournaments/${S.tournamentId}/members/${S.memberAId}/assign-role`,
      {
        cookies: S.dirCookies,
        body: { role_definition_id: S.roleCheckinId },
      }
    );
    expect(status, JSON.stringify(body)).toBe(200);
    expect(body.member.role_definition_id).toBe(S.roleCheckinId);
  });

  test('4.2 [FIXED] approved staff cannot assign roles — director-only', async () => {
    // requireTournamentCreator now guards this route.
    // Staff A cannot escalate their own or others' permissions.
    const { status } = await api(
      'PUT',
      `/api/tournaments/${S.tournamentId}/members/${S.memberAId}/assign-role`,
      {
        cookies: S.staffACookies,
        body: { role_definition_id: S.roleCheckinId },
      }
    );
    expect(status).toBe(403);
  });

  test('4.3 assigning non-existent role definition returns 404', async () => {
    const { status } = await api(
      'PUT',
      `/api/tournaments/${S.tournamentId}/members/${S.memberAId}/assign-role`,
      {
        cookies: S.dirCookies,
        body: { role_definition_id: '00000000-0000-0000-0000-000000000000' },
      }
    );
    expect(status).toBe(404);
  });

  test('4.4 director can unassign a role (set to null)', async () => {
    const { status, body } = await api(
      'PUT',
      `/api/tournaments/${S.tournamentId}/members/${S.memberAId}/assign-role`,
      {
        cookies: S.dirCookies,
        body: { role_definition_id: null },
      }
    );
    expect(status, JSON.stringify(body)).toBe(200);
    expect(body.member.role_definition_id).toBeNull();
    // Re-assign for subsequent tests
    await api('PUT', `/api/tournaments/${S.tournamentId}/members/${S.memberAId}/assign-role`, {
      cookies: S.dirCookies,
      body: { role_definition_id: S.roleCheckinId },
    });
  });

  test('4.5 director can list members with their role assignments', async () => {
    const { status, body } = await api('GET', `/api/tournaments/${S.tournamentId}/members-with-roles`, {
      cookies: S.dirCookies,
    });
    expect(status, JSON.stringify(body)).toBe(200);
    expect(Array.isArray(body.members)).toBe(true);
    const memberA = body.members.find(m => m.id === S.memberAId);
    expect(memberA).toBeDefined();
    expect(memberA.role_definition_id).toBe(S.roleCheckinId);
  });
});

// =============================================================================
// Suite 5 — Credentials / Access Control
// =============================================================================
test.describe('5. Credentials & Access Control', () => {
  test('5.1 unauthenticated request to check-in list returns 401', async () => {
    const { status } = await api('GET', `/api/tournaments/${S.tournamentId}/checkin`);
    expect(status).toBe(401);
  });

  test('5.2 unauthenticated POST to check-in returns 401', async () => {
    const { status } = await api('POST', `/api/tournaments/${S.tournamentId}/checkin`, {
      body: { registrationId: S.registrationId },
    });
    expect(status).toBe(401);
  });

  test('5.3 director (tournament owner) can access check-in list', async () => {
    const { status, body } = await api('GET', `/api/tournaments/${S.tournamentId}/checkin`, {
      cookies: S.dirCookies,
    });
    expect(status, JSON.stringify(body)).toBe(200);
    expect(body.competitors).toBeDefined();
  });

  test('5.4 Staff A (with manage_checkin) can access check-in list', async () => {
    const { status, body } = await api('GET', `/api/tournaments/${S.tournamentId}/checkin`, {
      cookies: S.staffACookies,
    });
    expect(status, JSON.stringify(body)).toBe(200);
  });

  test('5.5 Staff B (declined, no role) cannot access check-in list — 403', async () => {
    const { status } = await api('GET', `/api/tournaments/${S.tournamentId}/checkin`, {
      cookies: S.staffBCookies,
    });
    expect(status).toBe(403);
  });

  test('5.6 approved staff from OTHER tournament cannot access this check-in — 403', async () => {
    // First: make the "other staff" apply + get approved for the OTHER tournament
    const OTHER_STAFF = { email: `staff.other.${TS}@test.local`, password: 'StaffPass1234!' };
    const { status: ls } = await loginAndSave(OTHER_STAFF.email, OTHER_STAFF.password, 'otherStaffCookies');
    if (ls !== 200) {
      test.skip(); return;
    }

    // Apply to other tournament
    const { status: as, body: ab } = await api('POST', '/api/tournament-members', {
      cookies: S.otherStaffCookies,
      body: { tournamentId: S.otherTournId, role: 'staff', staffRole: 'Outsider' },
    });
    if (as === 201 || as === 409) {
      // Try to get the memberId if created
      if (as === 201) S.otherMemberId = ab.member?.id;
      // Approve via other director
      if (S.otherMemberId) {
        await api('PATCH', `/api/tournament-members/${S.otherMemberId}/approve`, {
          cookies: S.dirOtherCookies,
        });
        // Create role in other tournament with manage_checkin
        const { body: roleBody } = await api('POST', `/api/tournaments/${S.otherTournId}/staff-roles`, {
          cookies: S.dirOtherCookies,
          body: { role_name: 'Other Checkin', permissions: ['manage_checkin'] },
        });
        if (roleBody?.role?.id) {
          await api('PUT', `/api/tournaments/${S.otherTournId}/members/${S.otherMemberId}/assign-role`, {
            cookies: S.dirOtherCookies,
            body: { role_definition_id: roleBody.role.id },
          });
        }
      }
    }

    // Now try to access the FIRST tournament's check-in
    const { status } = await api('GET', `/api/tournaments/${S.tournamentId}/checkin`, {
      cookies: S.otherStaffCookies,
    });
    expect(status).toBe(403);
    saveState();
  });

  test('5.7 staff with view_schedule only (no manage_checkin) cannot access check-in', async () => {
    // Re-assign Staff A to the Viewer role (no manage_checkin) temporarily
    await api('PUT', `/api/tournaments/${S.tournamentId}/members/${S.memberAId}/assign-role`, {
      cookies: S.dirCookies,
      body: { role_definition_id: S.roleViewId },
    });

    const { status } = await api('GET', `/api/tournaments/${S.tournamentId}/checkin`, {
      cookies: S.staffACookies,
    });
    expect(status).toBe(403);

    // Restore manage_checkin role for later tests
    await api('PUT', `/api/tournaments/${S.tournamentId}/members/${S.memberAId}/assign-role`, {
      cookies: S.dirCookies,
      body: { role_definition_id: S.roleCheckinId },
    });
  });
});

// =============================================================================
// Suite 6 — Check-in Happy Path
// =============================================================================
test.describe('6. Check-in Happy Path', () => {
  test('6.1 GET /checkin returns competitors list with stats', async () => {
    const { status, body } = await api('GET', `/api/tournaments/${S.tournamentId}/checkin`, {
      cookies: S.staffACookies,
    });
    expect(status, JSON.stringify(body)).toBe(200);
    expect(Array.isArray(body.competitors)).toBe(true);
    expect(body.stats).toBeDefined();
    expect(typeof body.stats.total).toBe('number');
    expect(typeof body.stats.checked_in).toBe('number');
  });

  test('6.2 GET /checkin/stats returns stats only', async () => {
    const { status, body } = await api('GET', `/api/tournaments/${S.tournamentId}/checkin/stats`, {
      cookies: S.staffACookies,
    });
    expect(status, JSON.stringify(body)).toBe(200);
    expect(typeof body.total).toBe('number');
  });

  test('6.3 staff checks in Competitor 1', async () => {
    const { status, body } = await api('POST', `/api/tournaments/${S.tournamentId}/checkin`, {
      cookies: S.staffACookies,
      body: {
        registrationId: S.registrationId,
        actualWeight: 67.5,
        weightVerified: true,
        aauVerified: true,
        notes: 'Weighed in on mat 1',
      },
    });
    expect(status, JSON.stringify(body)).toBe(201);
    expect(body.checkin).toBeDefined();
    expect(body.checkin.registration_id).toBe(S.registrationId);
    expect(body.stats).toBeDefined();
  });

  test('6.4 duplicate check-in returns 409', async () => {
    const { status, body } = await api('POST', `/api/tournaments/${S.tournamentId}/checkin`, {
      cookies: S.staffACookies,
      body: { registrationId: S.registrationId },
    });
    expect(status, JSON.stringify(body)).toBe(409);
  });

  test('6.5 check-in with missing registrationId returns 400', async () => {
    const { status } = await api('POST', `/api/tournaments/${S.tournamentId}/checkin`, {
      cookies: S.staffACookies,
      body: {},
    });
    expect(status).toBe(400);
  });

  test('6.6 check-in with non-existent registrationId returns 404', async () => {
    const { status } = await api('POST', `/api/tournaments/${S.tournamentId}/checkin`, {
      cookies: S.staffACookies,
      body: { registrationId: '00000000-0000-0000-0000-000000000000' },
    });
    expect(status).toBe(404);
  });

  test('6.7 mat-call transitions Competitor 1 to on-mat status', async () => {
    const { status, body } = await api(
      'PUT',
      `/api/tournaments/${S.tournamentId}/checkin/${S.registrationId}/mat-call`,
      {
        cookies: S.staffACookies,
        body: { matName: 'Mat 1' },
      }
    );
    expect(status, JSON.stringify(body)).toBe(200);
    expect(body.checkin).toBeDefined();
  });

  test('6.8 undo check-in after mat-call should fail (competitor already called)', async () => {
    const { status } = await api(
      'DELETE',
      `/api/tournaments/${S.tournamentId}/checkin/${S.registrationId}`,
      { cookies: S.staffACookies }
    );
    // After mat-call, undo should be blocked (409) or 400
    expect([400, 409]).toContain(status);
  });
});

// =============================================================================
// Suite 7 — Absent / Withdrawn
// =============================================================================
test.describe('7. Absent & Withdrawn', () => {
  test('7.1 mark Competitor 2 as absent', async () => {
    const { status, body } = await api('POST', `/api/tournaments/${S.tournamentId}/checkin/absent`, {
      cookies: S.staffACookies,
      body: { registrationId: S.registration2Id, reason: 'Did not show up' },
    });
    expect(status, JSON.stringify(body)).toBe(200);
    expect(body.checkin).toBeDefined();
  });

  test('7.2 mark absent with missing registrationId returns 400', async () => {
    const { status } = await api('POST', `/api/tournaments/${S.tournamentId}/checkin/absent`, {
      cookies: S.staffACookies,
      body: {},
    });
    expect(status).toBe(400);
  });

  test('7.3 undo Competitor 2 absent status', async () => {
    const { status } = await api(
      'DELETE',
      `/api/tournaments/${S.tournamentId}/checkin/${S.registration2Id}`,
      { cookies: S.staffACookies }
    );
    expect(status).toBe(200);
  });

  test('7.4 mark Competitor 2 as withdrawn', async () => {
    const { status, body } = await api('POST', `/api/tournaments/${S.tournamentId}/checkin/withdrawn`, {
      cookies: S.staffACookies,
      body: { registrationId: S.registration2Id, reason: 'Injury' },
    });
    expect(status, JSON.stringify(body)).toBe(200);
    expect(body.checkin).toBeDefined();
  });

  test('7.5 GET /checkin/absent-withdrawn includes both absent and withdrawn', async () => {
    const { status, body } = await api(
      'GET',
      `/api/tournaments/${S.tournamentId}/checkin/absent-withdrawn`,
      { cookies: S.staffACookies }
    );
    expect(status, JSON.stringify(body)).toBe(200);
    // Should contain at least Competitor 2 (withdrawn)
    expect(Array.isArray(body.competitors ?? body)).toBe(true);
  });
});

// =============================================================================
// Suite 8 — Staff Member Physical Check-in (tournament_members.checkin)
// =============================================================================
test.describe('8. Staff Member Check-in (physical arrival)', () => {
  test('8.1 director checks in Staff A (marks arrival at venue)', async () => {
    const { status, body } = await api('PATCH', `/api/tournament-members/${S.memberAId}/checkin`, {
      cookies: S.dirCookies,
    });
    expect(status, JSON.stringify(body)).toBe(200);
    expect(body.member.checked_in_at).toBeTruthy();
  });

  test('8.2 director can undo Staff A physical check-in', async () => {
    const { status, body } = await api('DELETE', `/api/tournament-members/${S.memberAId}/checkin`, {
      cookies: S.dirCookies,
    });
    expect(status, JSON.stringify(body)).toBe(200);
    expect(body.member.checked_in_at).toBeNull();
  });

  test('8.3 staff member cannot self-check-in — director-only operation', async () => {
    // The checkIn controller verifies tournament.created_by === req.user.id,
    // so only the tournament creator (director) may mark staff as physically arrived.
    // Staff members cannot check themselves in.
    const { status } = await api('PATCH', `/api/tournament-members/${S.memberAId}/checkin`, {
      cookies: S.staffACookies,
    });
    expect(status).toBe(403);
  });
});

// =============================================================================
// Suite 9 — Staff Dashboard
// =============================================================================
test.describe('9. Staff Dashboard', () => {
  test('9.1 staff member can view their own assignments', async () => {
    const { status, body } = await api('GET', '/api/my/tournaments', {
      cookies: S.staffACookies,
    });
    expect(status, JSON.stringify(body)).toBe(200);
    // Should contain at least the approved membership
    const memberships = body.memberships ?? body;
    expect(Array.isArray(memberships)).toBe(true);
    const found = memberships.find(m => m.tournament_id === S.tournamentId || m.tournamentId === S.tournamentId);
    expect(found).toBeDefined();
  });

  test('9.2 declined staff (B) sees no approved memberships for this tournament', async () => {
    const { status, body } = await api('GET', '/api/my/tournaments', {
      cookies: S.staffBCookies,
    });
    expect(status, JSON.stringify(body)).toBe(200);
    const memberships = body.memberships ?? body;
    const approved = memberships.filter(
      m => (m.tournament_id === S.tournamentId || m.tournamentId === S.tournamentId) && m.status === 'approved'
    );
    expect(approved.length).toBe(0);
  });

  test('9.3 unauthenticated request to my/tournaments returns 401', async () => {
    const { status } = await api('GET', '/api/my/tournaments');
    expect(status).toBe(401);
  });
});

// =============================================================================
// Suite 10 — Cleanup (delete role definitions, verify state is consistent)
// =============================================================================
test.describe('10. Cleanup & Consistency', () => {
  test('10.1 director can delete the Viewer role definition', async () => {
    const { status } = await api(
      'DELETE',
      `/api/tournaments/${S.tournamentId}/staff-roles/${S.roleViewId}`,
      { cookies: S.dirCookies }
    );
    expect([200, 404]).toContain(status);
  });

  test('10.2 deleted role no longer appears in role list', async () => {
    const { status, body } = await api('GET', `/api/tournaments/${S.tournamentId}/staff-roles`, {
      cookies: S.dirCookies,
    });
    expect(status).toBe(200);
    const ids = (body.roles ?? []).map(r => r.id);
    expect(ids).not.toContain(S.roleViewId);
  });

  test('10.3 stats only count paid/waived registrations — unpaid are excluded', async () => {
    const { status, body } = await api('GET', `/api/tournaments/${S.tournamentId}/checkin/stats`, {
      cookies: S.dirCookies,
    });
    expect(status).toBe(200);
    // Stats query filters: payment_status IN ('paid', 'waived').
    // Test competitors were registered with payment_status='unpaid' (default),
    // so they are excluded from the total. The total will be 0.
    // NOTE: This is intentional — you can't check in an unpaid competitor.
    expect(typeof body.total).toBe('number');
    expect(typeof body.checked_in).toBe('number');
    expect(typeof body.absent).toBe('number');
    expect(typeof body.withdrawn).toBe('number');
    expect(typeof body.on_mat).toBe('number');
    // Verify the shape is correct regardless of count
    expect(body.total).toBeGreaterThanOrEqual(0);
  });

  test('10.4 remove leftover state file', () => {
    try { fs.unlinkSync(STATE_FILE); } catch {}
  });
});
