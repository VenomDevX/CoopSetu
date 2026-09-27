import { z } from 'zod';

// Request schemas for the training / LMS / placement routes. Their main job is
// the whitelist: z.object strips unknown keys, so a caller can no longer set
// columns the endpoint never meant to expose (status, organization_id,
// face_embedding, ...) by adding them to the JSON body.
//
// Forms send '' (or null) for untouched inputs and numbers as strings, so both are
// normalised here. Enum-like columns stay free text: their DB CHECK constraints
// are the source of truth, and a violation comes back as a 400.

const blankToUndefined = (v: unknown) => (v === '' || v === null ? undefined : v);
const opt = <T extends z.ZodTypeAny>(s: T) => z.preprocess(blankToUndefined, s.optional());

const text = (max = 200) => z.string().trim().min(1).max(max);
// guid, not uuid: Postgres accepts any 8-4-4-4-12 hex, and seeded IDs such as
// 00000000-0000-0000-0000-0000000000a0 carry no RFC version digit.
const id = z.guid();
const num = z.coerce.number().finite();
const int = z.coerce.number().int();
const date = z.string().max(40);
const flag = z.preprocess((v) => (v === 'true' ? true : v === 'false' ? false : v), z.boolean());

export const batchCreate = z.object({
  programme_id: id,
  name: text(),
  trainer_id: opt(id),
  start_date: opt(date),
  end_date: opt(date),
  capacity: opt(int.min(1)),
  room: opt(text()),
  status: opt(text(32)),
});

export const courseCreate = z.object({
  programme_id: id,
  title: text(),
  description: opt(text(5000)),
  duration_hours: opt(num.min(0)),
  trainer_id: opt(id),
  order_index: opt(int),
});

export const moduleCreate = z.object({
  title: text(),
  type: text(32),
  content_url: opt(z.string().url().max(2000)),
  content_text: opt(z.string().max(100_000)),
  duration_minutes: opt(int.min(0)),
  order_index: opt(int),
  is_mandatory: opt(flag),
});

export const assessmentCreate = z.object({
  course_id: id,
  title: text(),
  description: opt(text(5000)),
  type: opt(text(32)),
  max_score: opt(num.min(0)),
  passing_score: opt(num.min(0)),
  duration_minutes: opt(int.min(0)),
  attempts_allowed: opt(int.min(1)),
  is_published: opt(flag),
});

export const questionCreate = z.object({
  question_text: text(5000),
  question_type: opt(text(32)),
  options: opt(z.array(z.unknown()).max(50)),
  correct_answer: opt(z.string().max(2000)),
  marks: opt(num.min(0)),
  order_index: opt(int),
});

const programmeFields = {
  title: text(),
  description: opt(text(5000)),
  duration_days: int.min(1),
  start_date: opt(date),
  end_date: opt(date),
  capacity: opt(int.min(0)),
  fee: opt(num.min(0)),
  institution_id: opt(id),
  status: opt(text(32)),
};
export const programmeCreate = z.object(programmeFields);
export const programmeUpdate = z.object(programmeFields).partial();

const institutionFields = {
  name: text(),
  code: text(50),
  type: text(50),
  address: opt(text(500)),
  city: opt(text(100)),
  state: opt(text(100)),
  pincode: opt(text(20)),
  contact_email: opt(z.string().email().max(320)),
  contact_phone: opt(text(30)),
  capacity: opt(int.min(0)),
  status: opt(text(32)),
};
export const institutionCreate = z.object(institutionFields);
export const institutionUpdate = z.object(institutionFields).partial();

export const roomCreate = z.object({
  name: text(),
  institution_id: opt(id),
  kind: opt(text(32)),
  capacity: opt(int.min(0)),
  building: opt(text(100)),
  floor: opt(text(20)),
});

export const hostelCreate = z.object({
  name: text(),
  institution_id: opt(id),
  gender: opt(text(20)),
  total_beds: opt(int.min(0)),
  warden_name: opt(text()),
  warden_phone: opt(text(30)),
});

export const allocationCreate = z.object({
  hostel_id: id,
  trainee_id: id,
  batch_id: opt(id),
  room_number: opt(text(20)),
  bed_number: opt(text(20)),
  mess_opted: opt(flag),
  dietary_preference: opt(text(50)),
});

export const allocationCheckOut = z.object({ allocation_id: id });

export const slotCreate = z.object({
  batch_id: id,
  title: text(),
  date,
  start_time: z.string().max(10),
  end_time: z.string().max(10),
  course_id: opt(id),
  trainer_id: opt(id),
  room_id: opt(id),
  session_type: opt(text(32)),
  notes: opt(text(2000)),
});

const traineeProfileFields = {
  education: opt(text(200)),
  location: opt(text(200)),
  languages: opt(z.array(text(50)).max(20)),
  experience: opt(text(2000)),
  profile_photo: opt(z.string().max(2000)),
  digital_literacy_level: opt(text(32)),
  employment_status: opt(text(32)),
  date_of_birth: opt(date),
  gender: opt(text(32)),
};
export const traineeCreate = z.object({ user_id: id, ...traineeProfileFields });
// Staff edits (RLS: trainee:manage). The DB trigger additionally limits what a
// trainee may change on their own row.
export const traineeUpdate = z.object({
  ...traineeProfileFields,
  status: opt(text(32)),
  institution_id: opt(id),
});

const trainerFields = {
  institution_id: opt(id),
  specialization: opt(text()),
  qualification: opt(text()),
  experience_years: opt(int.min(0)),
  bio: opt(text(5000)),
  status: opt(text(32)),
};
export const trainerCreate = z.object({ user_id: id, ...trainerFields });
export const trainerUpdate = z.object(trainerFields);

const employerFields = {
  company_name: text(),
  industry: opt(text(100)),
  company_size: opt(text(50)),
  location: opt(text(200)),
  website: opt(z.string().url().max(500)),
  description: opt(text(5000)),
};
export const employerCreate = z.object({ user_id: id, ...employerFields });
export const employerUpdate = z.object({
  ...employerFields,
  logo_url: opt(z.string().url().max(2000)),
  status: opt(text(32)),
}).partial();

const jobFields = {
  title: text(),
  description: opt(text(10_000)),
  location: opt(text(200)),
  salary_min: opt(num.min(0)),
  salary_max: opt(num.min(0)),
  employment_type: opt(text(32)),
  experience_min: opt(num.min(0)),
  experience_max: opt(num.min(0)),
  education_required: opt(text(200)),
  is_remote: opt(flag),
  vacancies: opt(int.min(1)),
  deadline: opt(date),
};
export const jobCreate = z.object({ employer_id: id, ...jobFields, skill_ids: opt(z.array(id).max(50)) });
export const jobUpdate = z.object({ ...jobFields, status: opt(text(32)) }).partial();

export const certificateIssue = z.object({
  trainee_id: id,
  programme_id: id,
  title: text(),
  issuer_name: opt(text()),
  valid_until: opt(date),
  metadata: opt(z.record(z.string(), z.unknown())),
});

export const skillCreate = z.object({
  name: text(100),
  category: text(50),
  description: opt(text(2000)),
});

export const traineeSkillAdd = z.object({
  trainee_id: id,
  skill_id: id,
  proficiency: opt(int.min(0).max(100)),
  source: opt(text(32)),
});
