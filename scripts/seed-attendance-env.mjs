import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const url = process.env.SUPABASE_SERVER_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Missing Supabase URL or service-role/secret key');

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const RESET = process.argv.includes('--reset');
const PREFIX = 'attendance-seed-v1';
const PASSWORD = process.env.SEED_USER_PASSWORD || 'CoopSetuDemo!2026';

function uuid(name) {
  const hex = createHash('sha1').update(`${PREFIX}:${name}`).digest('hex').slice(0, 32).split('');
  hex[12] = '5';
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const value = hex.join('');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function hashInt(value) {
  return parseInt(createHash('sha1').update(String(value)).digest('hex').slice(0, 8), 16);
}

function dayKey(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(date);
}

function addDays(day, amount) {
  const date = new Date(`${day}T00:00:00+05:30`);
  date.setUTCDate(date.getUTCDate() + amount);
  return dayKey(date);
}

async function rows(table, query = '*') {
  const { data, error } = await db.from(table).select(query);
  if (error) throw new Error(`${table}: ${error.message}`);
  return data || [];
}

async function upsert(table, values, onConflict = 'id') {
  for (let index = 0; index < values.length; index += 500) {
    const { error } = await db.from(table).upsert(values.slice(index, index + 500), { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

async function removeSeedData() {
  const authUsers = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    authUsers.push(...data.users);
    if (data.users.length < 1000) break;
  }

  const resetTrainees = await rows('trainees', 'id');
  const resetBatches = await rows('batches', 'id');
  const resetMembers = await rows('organization_members', 'id');
  const seedEnrollmentIds = resetTrainees.flatMap(trainee =>
    resetBatches.map(batch => uuid(`enrollment:${trainee.id}:${batch.id}`)));
  const seedCardIds = resetMembers.map(member => uuid(`card:${member.id}`));
  for (let index = 0; index < seedEnrollmentIds.length; index += 50) {
    const { error } = await db.from('enrollments').delete().in('id', seedEnrollmentIds.slice(index, index + 50));
    if (error) throw error;
  }
  for (let index = 0; index < seedCardIds.length; index += 500) {
    const { error } = await db.from('rfid_cards').delete().in('id', seedCardIds.slice(index, index + 500));
    if (error) throw error;
  }

  const operations = [
    db.from('attendance_records').delete().eq('source', 'SEED'),
    db.from('timetable_slots').delete().eq('notes', PREFIX),
    db.from('attendance_sessions').delete().like('qr_token', `${PREFIX}-%`),
    db.from('device_tokens').delete().like('serial_number', 'ATT-SEED-%'),
  ];
  for (const operation of operations) {
    const { error } = await operation;
    if (error) throw error;
  }
  for (const user of authUsers.filter(user => user.email?.startsWith('attendance.seed.'))) {
    const { error } = await db.auth.admin.deleteUser(user.id);
    if (error) throw error;
  }
  console.log('Removed attendance seed rows and attendance.seed.* users only.');
}

if (RESET) {
  await removeSeedData();
  process.exit(0);
}

const organizations = await rows('organizations', 'id,name');
if (!organizations.length) throw new Error('No organization exists. Run the base seed first.');
const organization = organizations[0];
const institutions = (await rows('institutions', 'id,name,code,organization_id'))
  .filter(item => item.organization_id === organization.id)
  .slice(0, 4);
if (institutions.length < 4) throw new Error('At least four institutions are required. Run the base seed first.');

const roles = await rows('roles', 'id,code');
const roleByCode = new Map(roles.map(role => [role.code, role.id]));
if (!roleByCode.get('TRAINEE') || !roleByCode.get('TRAINER')) throw new Error('TRAINEE/TRAINER roles are missing');

const existingAuthUsers = [];
for (let page = 1; ; page += 1) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  existingAuthUsers.push(...data.users);
  if (data.users.length < 1000) break;
}
const authByEmail = new Map(existingAuthUsers.map(user => [user.email, user]));

async function ensurePerson(kind, index, institution) {
  const email = `attendance.seed.${kind}.${String(index + 1).padStart(2, '0')}@coopsetu.test`;
  const firstNames = ['Aarav', 'Aditi', 'Ananya', 'Arjun', 'Deepak', 'Diya', 'Ishaan', 'Kavya', 'Meera', 'Neha', 'Priya', 'Rohan'];
  const lastNames = ['Sharma', 'Verma', 'Singh', 'Patel', 'Gupta', 'Yadav', 'Mishra', 'Kumar'];
  const fullName = `${firstNames[index % firstNames.length]} ${lastNames[(index * 3) % lastNames.length]}`;
  let user = authByEmail.get(email);
  if (!user) {
    const created = await db.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (created.error) throw created.error;
    user = created.data.user;
    authByEmail.set(email, user);
  }

  const memberId = uuid(`member:${email}`);
  await upsert('profiles', [{ id: user.id, full_name: fullName, email, timezone: 'Asia/Kolkata' }]);
  await upsert('organization_members', [{
    id: memberId,
    organization_id: organization.id,
    user_id: user.id,
    institution_id: institution.id,
    employment_status: 'ACTIVE',
    is_active: true,
    job_title: kind === 'trainer' ? 'Faculty Trainer' : 'Trainee',
  }]);
  await upsert('member_roles', [{
    organization_member_id: memberId,
    role_id: roleByCode.get(kind === 'trainer' ? 'TRAINER' : 'TRAINEE'),
  }], 'organization_member_id,role_id');

  const entityId = uuid(`${kind}:${email}`);
  if (kind === 'trainer') {
    await upsert('trainers', [{
      id: entityId,
      user_id: user.id,
      organization_id: organization.id,
      institution_id: institution.id,
      specialization: ['Cooperative Management', 'Accounting', 'Digital Operations'][index % 3],
      qualification: 'Postgraduate',
      experience_years: 4 + (index % 9),
      status: 'ACTIVE',
    }]);
  } else {
    await upsert('trainees', [{
      id: entityId,
      user_id: user.id,
      organization_id: organization.id,
      institution_id: institution.id,
      education: 'Graduate',
      location: institution.name,
      languages: ['Hindi', 'English'],
      digital_literacy_level: index % 3 === 0 ? 'INTERMEDIATE' : 'BASIC',
      employment_status: 'UNEMPLOYED',
      status: 'ACTIVE',
    }]);
  }
  return { userId: user.id, memberId, entityId, institutionId: institution.id, fullName };
}

const currentTrainees = await rows('trainees', 'id');
const currentTrainers = await rows('trainers', 'id');
const newTrainees = [];
for (let index = 0; index < Math.max(0, 50 - currentTrainees.length); index += 1) {
  newTrainees.push(await ensurePerson('trainee', index, institutions[index % institutions.length]));
}
const newTrainers = [];
for (let index = 0; index < Math.max(0, 8 - currentTrainers.length); index += 1) {
  newTrainers.push(await ensurePerson('trainer', index, institutions[index % institutions.length]));
}

const batches = await rows('batches', 'id,name,programme_id,trainer_id,programmes(id,institution_id)');
const courses = await rows('courses', 'id,title,programme_id');
const trainers = await rows('trainers', 'id,user_id,institution_id');
const trainerByInstitution = new Map();
for (const trainer of trainers) {
  if (!trainerByInstitution.has(trainer.institution_id)) trainerByInstitution.set(trainer.institution_id, []);
  trainerByInstitution.get(trainer.institution_id).push(trainer);
}

for (let index = 0; index < batches.length; index += 1) {
  const institutionId = batches[index].programmes?.institution_id;
  const candidates = trainerByInstitution.get(institutionId) || trainers;
  if (candidates.length) {
    await db.from('batches').update({ trainer_id: candidates[index % candidates.length].id }).eq('id', batches[index].id);
  }
}

const allTrainees = await rows('trainees', 'id,user_id,institution_id');
allTrainees.sort((a, b) => a.id.localeCompare(b.id));
const members = await rows('organization_members', 'id,user_id,institution_id,organization_id');
const memberByUser = new Map(members.filter(member => member.organization_id === organization.id).map(member => [member.user_id, member]));
const batchesByInstitution = new Map();
for (const batch of batches) {
  const institutionId = batch.programmes?.institution_id;
  if (!batchesByInstitution.has(institutionId)) batchesByInstitution.set(institutionId, []);
  batchesByInstitution.get(institutionId).push(batch);
}

const existingEnrollments = await rows('enrollments', 'trainee_id,batch_id,programme_id');
const enrollmentKeys = new Set(existingEnrollments.map(item => `${item.trainee_id}:${item.batch_id}`));
const enrollmentProgramKeys = new Set(existingEnrollments.map(item => `${item.trainee_id}:${item.programme_id}`));
const enrollmentCountByTrainee = new Map();
for (const enrollment of existingEnrollments) {
  enrollmentCountByTrainee.set(enrollment.trainee_id, (enrollmentCountByTrainee.get(enrollment.trainee_id) || 0) + 1);
}
const enrollmentRows = [];
for (let index = 0; index < allTrainees.length; index += 1) {
  const trainee = allTrainees[index];
  const choices = batchesByInstitution.get(trainee.institution_id) || batches;
  if (!choices.length) continue;
  const count = index < 4 && choices.length > 1 ? 2 : 1;
  let added = enrollmentCountByTrainee.get(trainee.id) || 0;
  for (let pick = 0; pick < choices.length && added < count; pick += 1) {
    const batch = choices[(index + pick) % choices.length];
    const keyValue = `${trainee.id}:${batch.id}`;
    const programmeKey = `${trainee.id}:${batch.programme_id}`;
    if (enrollmentKeys.has(keyValue) || enrollmentProgramKeys.has(programmeKey)) continue;
    enrollmentRows.push({
      id: uuid(`enrollment:${keyValue}`),
      trainee_id: trainee.id,
      programme_id: batch.programme_id,
      batch_id: batch.id,
      status: 'ENROLLED',
      source: 'SELF',
      enrolled_at: new Date().toISOString(),
    });
    enrollmentKeys.add(keyValue);
    enrollmentProgramKeys.add(programmeKey);
    added += 1;
  }
}
await upsert('enrollments', enrollmentRows);

const deviceRows = [];
const deviceTokens = [];
const existingDevices = await rows('device_tokens', 'id');
const existingDeviceIds = new Set(existingDevices.map(device => device.id));
for (let institutionIndex = 0; institutionIndex < institutions.length; institutionIndex += 1) {
  for (let deviceIndex = 0; deviceIndex < 2; deviceIndex += 1) {
    const plaintext = `cst_seed_${createHash('sha256').update(`${institutionIndex}:${deviceIndex}`).digest('hex').slice(0, 32)}`;
    const id = uuid(`device:${institutionIndex}:${deviceIndex}`);
    deviceRows.push({
      id,
      organization_id: organization.id,
      institution_id: institutions[institutionIndex].id,
      label: `${institutions[institutionIndex].code} Terminal ${deviceIndex + 1}`,
      device_name: `Attendance ${deviceIndex + 1}`,
      location: deviceIndex === 0 ? 'Main entrance' : 'Training block',
      serial_number: `ATT-SEED-${institutionIndex + 1}-${deviceIndex + 1}`,
      token_hash: createHash('sha256').update(plaintext).digest('hex'),
      token_hint: plaintext.slice(-4),
      status: 'ACTIVE',
      last_seen_at: new Date(Date.now() - deviceIndex * 45_000).toISOString(),
    });
    if (!existingDeviceIds.has(id)) deviceTokens.push({ label: deviceRows.at(-1).label, token: plaintext });
  }
}
await upsert('device_tokens', deviceRows);

const courseByProgramme = new Map();
for (const course of courses) {
  if (!courseByProgramme.has(course.programme_id)) courseByProgramme.set(course.programme_id, []);
  courseByProgramme.get(course.programme_id).push(course);
}
const today = dayKey(new Date());
const slots = [];
const sessions = [];
for (let dayOffset = -60; dayOffset <= 14; dayOffset += 1) {
  const date = addDays(today, dayOffset);
  const weekday = new Date(`${date}T12:00:00+05:30`).getUTCDay();
  if (weekday === 0 || weekday === 6) continue;
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
    const batch = batches[batchIndex];
    if ((dayOffset + batchIndex + 77) % 11 === 0) continue;
    const availableCourses = courseByProgramme.get(batch.programme_id) || [];
    for (let slotIndex = 0; slotIndex < 2; slotIndex += 1) {
      const slotId = uuid(`slot:${batch.id}:${date}:${slotIndex}`);
      const sessionId = dayOffset <= 0 ? uuid(`session:${batch.id}:${date}:${slotIndex}`) : null;
      const course = availableCourses[(Math.abs(dayOffset) + slotIndex) % Math.max(availableCourses.length, 1)];
      const type = slotIndex === 0 ? 'LECTURE' : 'LAB';
      slots.push({
        id: slotId,
        organization_id: organization.id,
        batch_id: batch.id,
        course_id: course?.id || null,
        trainer_id: batch.trainer_id,
        title: course?.title || `${batch.name} ${type}`,
        date,
        start_time: slotIndex === 0 ? '09:30:00' : '14:00:00',
        end_time: slotIndex === 0 ? '11:00:00' : '15:30:00',
        session_type: type,
        attendance_session_id: sessionId,
        status: dayOffset <= 0 ? 'PUBLISHED' : 'PLANNED',
        notes: PREFIX,
      });
      if (sessionId) sessions.push({
        id: sessionId,
        batch_id: batch.id,
        date,
        session_type: type,
        session_slot: slotIndex === 0 ? 'MORNING' : 'AFTERNOON',
        trainer_id: batch.trainer_id,
        is_active: dayOffset === 0,
        qr_token: `${PREFIX}-${sessionId}`,
      });
    }
  }
}
await upsert('attendance_sessions', sessions);
await upsert('timetable_slots', slots);

const enrollments = await rows('enrollments', 'trainee_id,batch_id,status');
const traineeById = new Map(allTrainees.map(trainee => [trainee.id, trainee]));
const devicesByInstitution = new Map();
for (const device of deviceRows) {
  if (!devicesByInstitution.has(device.institution_id)) devicesByInstitution.set(device.institution_id, []);
  devicesByInstitution.get(device.institution_id).push(device);
}
const activeByBatch = new Map();
for (const enrollment of enrollments.filter(item => item.status === 'ENROLLED')) {
  if (!activeByBatch.has(enrollment.batch_id)) activeByBatch.set(enrollment.batch_id, []);
  activeByBatch.get(enrollment.batch_id).push(enrollment.trainee_id);
}

const methods = ['RFID', 'QR', 'FACE', 'MANUAL', 'TOTP'];
const records = [];
for (const session of sessions) {
  const traineeIds = activeByBatch.get(session.batch_id) || [];
  const slot = slots.find(item => item.attendance_session_id === session.id);
  for (const traineeId of traineeIds) {
    const roll = hashInt(`${session.id}:${traineeId}`) % 100;
    if (roll >= 92) continue;
    const trainee = traineeById.get(traineeId);
    const member = memberByUser.get(trainee?.user_id);
    if (!member) continue;
    const late = roll >= 82;
    const method = methods[hashInt(`${traineeId}:${session.id}:method`) % methods.length];
    const device = (devicesByInstitution.get(trainee.institution_id) || [])[hashInt(session.id) % 2];
    const baseTime = slot?.start_time || '09:30:00';
    const base = new Date(`${session.date}T${baseTime}+05:30`);
    const jitter = late ? 11 * 60 + hashInt(`${session.id}:late:${traineeId}`) % 1800 : hashInt(`${session.id}:present:${traineeId}`) % 540;
    base.setUTCSeconds(base.getUTCSeconds() + jitter);
    records.push({
      id: uuid(`record:${session.id}:${traineeId}`),
      session_id: session.id,
      trainee_id: traineeId,
      member_id: member.id,
      method,
      status: late ? 'LATE' : 'PRESENT',
      marked_at: base.toISOString(),
      device_id: method === 'MANUAL' ? null : device?.id || null,
      source: 'SEED',
    });
  }
}
await upsert('attendance_records', records);

const existingCards = await rows('rfid_cards', 'member_id,rfid_uid');
const cardMembers = new Set(existingCards.map(card => card.member_id));
const roleRows = await rows('member_roles', 'organization_member_id,roles(code)');
const privilegedMembers = new Set(roleRows
  .filter(row => ['TRAINER', 'INSTITUTE_ADMIN', 'ORG_ADMIN', 'ORG_OWNER', 'SUPER_ADMIN'].includes(row.roles?.code))
  .map(row => row.organization_member_id));
const traineeMemberIds = allTrainees.map(trainee => memberByUser.get(trainee.user_id)?.id).filter(Boolean);
const cardCandidates = new Set([
  ...traineeMemberIds.filter((_, index) => index % 10 < 7),
  ...privilegedMembers,
]);
const cards = [];
for (const memberId of cardCandidates) {
  if (cardMembers.has(memberId)) continue;
  const member = members.find(item => item.id === memberId);
  cards.push({
    id: uuid(`card:${memberId}`),
    organization_id: organization.id,
    institution_id: member?.institution_id || null,
    member_id: memberId,
    rfid_uid: createHash('sha1').update(`${PREFIX}:card:${memberId}`).digest('hex').slice(0, 14).toUpperCase(),
    status: 'ACTIVE',
  });
}
await upsert('rfid_cards', cards);

const staffRecords = [];
const existingStaff = await rows('attendance_records', 'member_id,marked_at,session_id');
const existingStaffDays = new Set(existingStaff.filter(row => !row.session_id).map(row => `${row.member_id}:${dayKey(row.marked_at)}`));
const staffMembers = members.filter(member => privilegedMembers.has(member.id));
for (const member of staffMembers) {
  for (let offset = -58; offset <= 0; offset += 4) {
    const date = addDays(today, offset);
    const keyValue = `${member.id}:${date}`;
    if (existingStaffDays.has(keyValue)) continue;
    const device = (devicesByInstitution.get(member.institution_id) || deviceRows)[0];
    staffRecords.push({
      id: uuid(`staff-record:${keyValue}`),
      session_id: null,
      trainee_id: null,
      member_id: member.id,
      method: 'RFID',
      status: 'PRESENT',
      marked_at: new Date(`${date}T09:${String(hashInt(keyValue) % 60).padStart(2, '0')}:${String(hashInt(`${keyValue}:s`) % 60).padStart(2, '0')}+05:30`).toISOString(),
      device_id: device?.id || null,
      source: 'SEED',
    });
  }
}
await upsert('attendance_records', staffRecords);

console.log(`Attendance seed complete for ${organization.name}:`);
console.log(`  ${allTrainees.length} trainees, ${trainers.length} trainers, ${slots.length} timetable slots`);
console.log(`  ${sessions.length} sessions, ${records.length + staffRecords.length} attendance rows, ${cards.length} new RFID cards`);
if (deviceTokens.length) {
  console.log('New terminal tokens (shown once; place one in firmware config.h):');
  for (const item of deviceTokens) console.log(`  ${item.label}: ${item.token}`);
}
