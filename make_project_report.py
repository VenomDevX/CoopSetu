from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from pathlib import Path

OUT = Path('CoopSetu_Full_Project_Report.docx')

def shade(cell, fill):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = tcPr.find(qn('w:shd')) or OxmlElement('w:shd')
    if shd.getparent() is None: tcPr.append(shd)
    shd.set(qn('w:fill'), fill)

def set_cell(cell, text, bold=False, color=None, size=8.5):
    cell.text = ''
    p = cell.paragraphs[0]; p.paragraph_format.space_after = Pt(0)
    r = p.add_run(str(text)); r.bold = bold; r.font.size = Pt(size)
    if color: r.font.color.rgb = RGBColor.from_string(color)
    cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
    tcPr = cell._tc.get_or_add_tcPr(); mar = OxmlElement('w:tcMar')
    for side in ('top','start','bottom','end'):
        x=OxmlElement('w:'+side); x.set(qn('w:w'),'120'); x.set(qn('w:type'),'dxa'); mar.append(x)
    tcPr.append(mar)

def make_table(doc, headers, rows):
    t=doc.add_table(rows=1, cols=len(headers)); t.alignment=WD_TABLE_ALIGNMENT.CENTER; t.style='Table Grid'
    for i,h in enumerate(headers): set_cell(t.rows[0].cells[i], h, True, 'FFFFFF', 8.5); shade(t.rows[0].cells[i],'17365D')
    for ri,row in enumerate(rows):
        cells=t.add_row().cells
        for i,val in enumerate(row): set_cell(cells[i],val); shade(cells[i], 'F3F6FA' if ri%2 else 'FFFFFF')
    doc.add_paragraph().paragraph_format.space_after=Pt(1)

def bullets(doc, items):
    for x in items: doc.add_paragraph(x, style='List Bullet')

def numbered(doc, items):
    for x in items: doc.add_paragraph(x, style='List Number')

def placeholder(doc, title, note, height=1.7):
    t=doc.add_table(rows=1, cols=1); t.alignment=WD_TABLE_ALIGNMENT.CENTER; t.style='Table Grid'
    c=t.cell(0,0); shade(c,'F8FAFC'); c.width=Inches(6.3)
    p=c.paragraphs[0]; p.alignment=WD_ALIGN_PARAGRAPH.CENTER; p.paragraph_format.space_after=Pt(5)
    r=p.add_run(title); r.bold=True; r.font.size=Pt(11); r.font.color.rgb=RGBColor(23,54,93)
    p=c.add_paragraph(); p.alignment=WD_ALIGN_PARAGRAPH.CENTER; p.paragraph_format.space_after=Pt(0)
    r=p.add_run(note); r.italic=True; r.font.size=Pt(8.5); r.font.color.rgb=RGBColor(90,90,90)
    doc.add_paragraph().paragraph_format.space_after=Pt(1)

doc=Document(); s=doc.sections[0]
s.top_margin=Inches(.72); s.bottom_margin=Inches(.65); s.left_margin=Inches(.8); s.right_margin=Inches(.8)
sty=doc.styles; sty['Normal'].font.name='Aptos'; sty['Normal'].font.size=Pt(10); sty['Normal'].paragraph_format.space_after=Pt(6)
for n,z,c in [('Title',28,'17365D'),('Heading 1',18,'17365D'),('Heading 2',13,'2F5597'),('Heading 3',11,'404040')]:
    sty[n].font.name='Aptos Display'; sty[n].font.size=Pt(z); sty[n].font.bold=True; sty[n].font.color.rgb=RGBColor.from_string(c)
for secpart,txt in [('header','COOPSETU  |  PROJECT REPORT'),('footer','SIH Problem Statement 26087  |  Project documentation')]:
    p=(s.header if secpart=='header' else s.footer).paragraphs[0]; p.alignment=WD_ALIGN_PARAGRAPH.CENTER
    r=p.add_run(txt); r.font.size=Pt(8); r.font.color.rgb=RGBColor(110,110,110)

# Cover
p=doc.add_paragraph(); p.alignment=WD_ALIGN_PARAGRAPH.CENTER; p.paragraph_format.space_before=Pt(70)
r=p.add_run('CoopSetu'); r.bold=True; r.font.size=Pt(34); r.font.color.rgb=RGBColor(23,54,93)
p=doc.add_paragraph(); p.alignment=WD_ALIGN_PARAGRAPH.CENTER; r=p.add_run('Full Project Report'); r.bold=True; r.font.size=Pt(20); r.font.color.rgb=RGBColor(47,85,151)
p=doc.add_paragraph(); p.alignment=WD_ALIGN_PARAGRAPH.CENTER; p.paragraph_format.space_before=Pt(12); r=p.add_run('Unified Cooperative Training, Attendance, Skills and Employment Platform'); r.font.size=Pt(13)
p=doc.add_paragraph(); p.alignment=WD_ALIGN_PARAGRAPH.CENTER; p.paragraph_format.space_before=Pt(35); r=p.add_run('Smart India Hackathon | Problem Statement 26087'); r.bold=True; r.font.size=Pt(12)
p=doc.add_paragraph(); p.alignment=WD_ALIGN_PARAGRAPH.CENTER; p.paragraph_format.space_before=Pt(45); r=p.add_run('Prepared for evaluation, demonstration, handover and future development'); r.italic=True; r.font.size=Pt(10)
placeholder(doc,'TEAM AND INSTITUTION LOGO PLACEHOLDER','Replace with official team and institute marks before submission.',1.0)
doc.add_page_break()

doc.add_heading('Executive Summary',1)
doc.add_paragraph('CoopSetu is a multi-tenant digital backbone for cooperative training institutions. It connects institution administration, programmes, batches, trainees, trainers, attendance, e-learning, assessments, certificates, skill passports, employment and AI-assisted career guidance in one platform. The project addresses a fragmented training ecosystem in which learner and employment information can remain separated across registers and applications.')
doc.add_paragraph('The repository contains a working Next.js application, Supabase/Postgres data layer, role-aware dashboards, versioned APIs, security controls, automated tests, realtime capabilities, and an NFC/TFT hardware proof of concept. A Capacitor Android target is also configured for a mobile application path. The complete demonstration journey is: enrol a trainee, capture attendance, deliver learning, assess performance, issue a verifiable certificate, build a skill passport and connect the trainee to relevant jobs.')
doc.add_paragraph('This report records what has been implemented, how the project was created, the current architecture and evidence, the hardware and mobile-app integration plan, limitations, and a staged roadmap for production scale-up.')
doc.add_heading('Project Snapshot',2)
make_table(doc,['Area','Current position'],[['Project','CoopSetu Cooperative Training Hub'],['Target','SIH Problem Statement 26087'],['Users','Super Admin / NCCT, Institute Admin, Trainer, Trainee, Employer'],['Web stack','Next.js 15, React 19, TypeScript 5.9, Tailwind CSS 4'],['Data and auth','Supabase Postgres, Auth, Storage, Realtime, Row Level Security'],['AI','Google Gemini provider behind a swappable interface'],['Attendance','Dynamic QR/TOTP, face recognition, NFC hardware endpoint and manual fallback'],['Deployment','Vercel or Docker; local Supabase development stack'],['Quality evidence','Unit, integration, end-to-end and load-test suites']])

doc.add_heading('Contents',1)
numbered(doc,['Problem Context and Objectives','Solution Overview','Stakeholders and User Roles','How the Project Was Created','System Architecture','Implemented Features','Attendance and Hardware Integration','Mobile Application Plan','Data Security and Governance','Testing and Validation','Deployment and Operations','Current Limitations and Risks','Future Goals and Roadmap','Demonstration Script','Appendices and Evidence Placeholders'])

doc.add_heading('1 Problem Context and Objectives',1)
doc.add_paragraph('Cooperative training is delivered through multiple institutions and programmes, but registration, attendance, learning progress, certification, skills and employment outcomes can remain disconnected. This makes it difficult for administrators to monitor performance, for trainers to act on learner needs, for employers to find verified talent, and for trainees to carry trusted evidence of their abilities.')
doc.add_heading('Objectives',2)
bullets(doc,['Create one longitudinal identity for each trainee from enrolment to employment.','Provide secure, practical attendance capture for classroom and field environments.','Digitise courses, modules, assessments and completion evidence.','Issue certificates that can be verified publicly without requiring a login.','Create a verified skill passport and employment-readiness view.','Give institutions dashboards, analytics, approvals, audit trails and scheduled reports.','Provide AI-assisted career guidance with security, privacy and human oversight.'])
placeholder(doc,'PROBLEM STATEMENT / FIELD STUDY EVIDENCE','Insert official SIH problem statement, survey results, stakeholder interviews or photographs.',1.4)

doc.add_heading('2 Solution Overview',1)
doc.add_paragraph('CoopSetu is organised as a central cooperative hub with connected modules rather than isolated tools. Shared identity, organisation membership, permissions and audit history allow the same record to move through the complete training lifecycle.')
make_table(doc,['Layer','Purpose','Key outputs'],[['Training ERP','Institutions, programmes, batches, enrolment, trainer assignment','Operational training workspace'],['E-learning','Courses, modules, progress and assessments','Learning records and results'],['Attendance','QR/TOTP, face, NFC hardware and manual capture','Session-wise presence ledger'],['Certification','Completion rules and public verification','Trusted certificate number'],['Skills and jobs','Skill passport, job posts, applications and matching','Employment-readiness pathway'],['AI and analytics','Career assistant, dashboards and scheduled reports','Recommendations and management insight'],['Governance','Approvals, releases, incidents, QA, security and audit','Controlled delivery and traceability']])

doc.add_heading('3 Stakeholders and User Roles',1)
make_table(doc,['Role','Responsibilities and value'],[['Super Admin / NCCT','Manage institutions and programmes, monitor national metrics, verify certifications and generate reports.'],['Institute Admin','Create batches, schedule sessions, manage trainees and trainers, upload material and conduct administration.'],['Trainer','Manage assigned batches, deliver learning, author assessments, verify attendance and track progress.'],['Trainee','Enrol, learn, submit assessments, view attendance, download certificates, maintain a skill passport, apply for jobs and use career AI.'],['Employer','Create a company profile, publish jobs with skill requirements, search candidates and manage applications.']])

doc.add_heading('4 How the Project Was Created',1)
doc.add_paragraph('Development followed a modular, security-first product approach. The system was built as a single repository so that the web experience, APIs, database migrations, hardware integration and test evidence remain versioned together.')
numbered(doc,['Translate the SIH problem into a domain model covering institutions, programmes, batches, trainees, trainers, courses, attendance, certificates, skills, employers and jobs.','Create the Next.js application shell with role-aware navigation, public pages, onboarding and dashboard routes.','Implement the Supabase schema through numbered migrations and seed data, then enforce organisation isolation with Row Level Security.','Build domain services and versioned REST route handlers with strict Zod validation and consistent API responses.','Add learning, assessment, certificate, skill passport, employment and AI workflows around the same trainee identity.','Add multiple attendance capture modes so the platform remains usable when a method is unavailable.','Add security hardening, audit logging, rate limiting, session controls and encrypted integration secrets.','Create unit, integration, end-to-end and load test suites; use demo mode and seeded local data for repeatable evaluation.','Prepare deployment paths for Vercel and Docker, with an Android/Capacitor path for mobile packaging.'])
doc.add_heading('Repository implementation footprint',2)
make_table(doc,['Repository area','What it contains'],[['app/','Public pages, dashboard experience, onboarding, authentication and versioned API route handlers.'],['components/ and hooks/','Reusable interface components, realtime subscriptions, presence and interaction logic.'],['lib/','Supabase clients, auth, AI, validation, security, audit, cache, email, offline and realtime helpers.'],['services/','Domain services for trainees, trainers, teams, skills, tasks, projects, attendance, training analytics and governance.'],['supabase/','Schema migrations, Row Level Security policies and seed data.'],['tests/','Unit, integration, E2E and k6 load profiles.'],['rfidpns532_tft.ino','ESP32 + PN532 + ILI9341 hardware proof-of-concept for NFC card detection and display feedback.']])

doc.add_heading('5 System Architecture',1)
doc.add_paragraph('The application uses a web-first architecture with shared APIs and database policies. The browser and future mobile client call the same backend contracts. The hardware scanner is treated as a constrained client that submits a verified attendance payload rather than receiving broad database access.')
placeholder(doc,'SYSTEM ARCHITECTURE DIAGRAM','Insert final architecture diagram showing Web App, Android App, Hardware Scanner, Next.js API, Supabase Auth/Postgres/Storage/Realtime, AI Provider and Email/Reports.',2.1)
make_table(doc,['Component','Responsibility'],[['Next.js App Router','Server-rendered pages, dashboard routes, server actions and API handlers.'],['Supabase Auth and SSR','Session handling, OAuth options, server/browser clients and middleware integration.'],['Postgres + RLS','Tenant-aware data storage and policy enforcement for every business table.'],['Supabase Storage','Controlled storage for documents, attachments, avatars and evidence.'],['Supabase Realtime','Board updates, notifications, presence and live changes subject to RLS.'],['AI provider interface','Gemini-backed career assistant with a swappable provider boundary and prompt-safety controls.'],['Background worker','Scheduled report generation and email delivery.'],['Hardware endpoint','Receives NFC/TOTP scan data through a versioned API path after device authentication.']])
doc.add_heading('Core data flow',2)
numbered(doc,['A user authenticates and receives an organisation-scoped session.','Role and membership checks determine the permitted experience, while database RLS remains the final access boundary.','A trainee record links to enrolments, attendance sessions, course progress, assessments, certificates, skills and job applications.','Attendance devices or web methods submit a capture event; the server validates the session, trainee identity, time window and credential before recording it.','Completion and assessment evidence contribute to certificate and skill records.','The employment module exposes verified skills and matching context to employers according to policy.'])

doc.add_heading('6 Implemented Features',1)
doc.add_heading('6.1 Training ERP',2); bullets(doc,['Institutions, programmes, branches, batches, enrolment and trainer assignment.','Role-aware trainee and trainer directories with progress views.','Projects, sprints, boards, epics, milestones and risks for delivery governance.','Approvals, releases, deployment logs, incidents, post-mortems, QA, security reviews and collaborative documents.'])
doc.add_heading('6.2 Learning and assessment',2); bullets(doc,['Course and module structure with per-trainee progress tracking.','Assessment question banks, submissions and results linked to enrolments.','Certificate issuance and public verification through a certificate number.','Skill passport records with proficiency, source and employment-readiness aggregation.'])
doc.add_heading('6.3 Employment and AI',2); bullets(doc,['Employer profiles, job posts, required skills, applications, shortlist flows and matching services.','Career AI for skill-gap analysis, course recommendations and cooperative-sector guidance.','Analytics dashboards and scheduled report exports for management use.'])
doc.add_heading('6.4 Platform capabilities',2); bullets(doc,['Realtime channels for boards, notifications and presence.','Offline support helpers for cache and synchronisation scenarios.','Guest demo mode with seeded realistic data and cleanup automation.','Internationalisation foundations with English and Hindi message files.'])

doc.add_heading('7 Attendance and Hardware Integration',1)
doc.add_paragraph('Attendance is intentionally multi-modal. A single method can fail because of device availability, lighting, connectivity, card loss or operating conditions; CoopSetu therefore provides secure alternatives while keeping a common attendance record.')
make_table(doc,['Method','Current implementation','Use case'],[['Dynamic QR + TOTP','Rotating 30-second digital ID card; server validation prevents simple screenshot reuse.','Trainee presents an ID card at a trainer or scanner station.'],['Face recognition','Browser-side face-api.js embeddings and matching flow.','Hands-free or controlled entry where biometric consent and policy permit.'],['NFC hardware','ESP32 + PN532 reads ISO14443A card UID; ILI9341 displays status; backend endpoint is prepared for verified scan payloads.','Physical attendance kiosk or portable classroom scanner.'],['Manual marking','Trainer-verified session attendance with audit trail.','Fallback for exceptional cases and controlled corrections.']])
doc.add_heading('Hardware prototype status',2)
doc.add_paragraph('The supplied Arduino sketch demonstrates the electronics path: it starts the SPI bus, tests the ILI9341 TFT, detects PN532 firmware, configures the NFC module, displays a ready screen, reads an ISO14443A UID and shows a success state. The next engineering step is to connect the read event to the secure hardware scan API, add device identity and network transport, and map the card credential to a trainee without treating the raw UID as sufficient proof on its own.')
placeholder(doc,'HARDWARE PROTOTYPE PHOTOGRAPH','Insert assembled ESP32, PN532 reader, TFT display, power and enclosure photographs.',2.1)
placeholder(doc,'CIRCUIT DIAGRAM PLACEHOLDER','Insert final schematic/wiring diagram with ESP32, PN532 SPI lines, ILI9341 SPI/control lines, power rails, level shifting and enclosure notes.',2.25)
make_table(doc,['Signal / component','Prototype detail to document'],[['ESP32 SPI','SCK 18, MISO 19, MOSI 23 as used by the sketch.'],['ILI9341 TFT','CS 5, DC 27, RST 4.'],['PN532','SPI chip select 13; reader configured through Adafruit PN532 library.'],['Power','Document the selected regulated supply, current budget, common ground and safe voltage levels.'],['Connectivity','Document Wi-Fi provisioning, API base URL, retry policy and offline queue behaviour.'],['Security','Use a device credential, signed request or short-lived token; do not rely on a card UID alone.']])
doc.add_heading('Proposed hardware attendance flow',2)
numbered(doc,['Device boots and performs self-test for display, reader, network and secure clock.','Trainee taps the card or credential.','Device reads the credential and creates a signed scan request containing device ID, session context, timestamp and nonce.','Backend authenticates the device, validates the session and credential, checks replay and time-window rules, then records attendance.','Device displays accepted, rejected or retry status and queues an encrypted event if connectivity is temporarily unavailable.','A later reconciliation job resolves queued events and records the final audit result.'])

doc.add_heading('8 Mobile Application Plan',1)
doc.add_paragraph('The repository includes Capacitor Android configuration and scripts for synchronising and building an Android package. The mobile direction is to reuse the same backend contracts and design language while adding device-native capabilities where they improve field operation.')
make_table(doc,['Mobile surface','Planned or supported responsibility'],[['Trainee app','Digital ID card, QR/TOTP, attendance history, course progress, assessments, certificates, skill passport, jobs and career AI.'],['Trainer app','Assigned batches, session start, attendance capture, offline marking, content and assessment actions.'],['Institute admin','Batch and session management, analytics, alerts, reports and approvals.'],['Employer view','Job management, candidate search, shortlist and application review.'],['Device services','Camera for face/QR, NFC where supported, notifications, secure local storage and offline queue.']])
placeholder(doc,'MOBILE APP SCREENSHOTS PLACEHOLDER','Insert Android/iOS screens: login, trainee home, ID card, attendance, course, skill passport and employer job view.',2.35)
doc.add_heading('Mobile implementation phases',2); numbered(doc,['Wrap the responsive web experience in Capacitor and confirm authentication/session behaviour.','Add mobile navigation and touch-first layouts for the highest-frequency workflows.','Add secure local persistence for offline attendance and learning progress.','Integrate native camera, push notifications and device-level secure storage.','Add NFC support on compatible Android devices and align it with the same hardware scan contract.','Build signed release packages, crash reporting, accessibility checks and store-readiness documentation.'])

doc.add_heading('9 Data Security and Governance',1)
doc.add_paragraph('Security is implemented in layers. Presentation personas are not treated as the security boundary; access is checked at the API and database levels so that a manipulated client cannot grant itself permissions.')
make_table(doc,['Control','Implementation / intent'],[['Tenant isolation','Organisation-scoped records and Row Level Security policies on every business table.'],['Authentication','Supabase Auth with SSR middleware and optional OAuth providers.'],['Authorisation','Early API guards plus permission and membership checks, with RLS as the final source of truth.'],['Input validation','Strict Zod schemas at API trust boundaries.'],['Secrets','Server-only environment variables and AES-256-GCM encryption for stored integration secrets.'],['Abuse prevention','Rate limits by IP and route category, bot filtering and session controls.'],['Audit','State changes logged; IP and user-agent values are HMAC-hashed rather than stored raw.'],['Content security','Per-request Content Security Policy nonce handling in middleware.'],['Privacy','Face embeddings and documents require explicit operational policy, retention rules and consent before production rollout.']])
doc.add_heading('Governance requirements for production',2); bullets(doc,['Define institutional data ownership, retention and deletion rules.','Document biometric consent, lawful basis, access controls and retention windows before enabling face recognition in live deployments.','Define certificate revocation, correction and dispute processes.','Maintain device inventory, key rotation, firmware versions and physical tamper controls.','Use incident response, backup, disaster recovery and breach notification procedures.'])

doc.add_heading('10 Testing and Validation',1)
doc.add_paragraph('The project includes multiple test layers so that domain behaviour, database isolation, route guards, user journeys and performance risks can be assessed independently.')
make_table(doc,['Test layer','Coverage in repository'],[['Unit tests','Attendance, auth, validation, AI intents, encryption, caching, services, dashboard logic and domain rules.'],['Integration tests','RLS, ownership isolation, audit logging, teams, training, jobs, assessments, incidents, releases and database-backed flows.'],['End-to-end tests','Onboarding, role workflows, attendance, analytics, offline flows, public pages, security and responsive behaviour.'],['Native/mobile tests','Native shell, touch targets, landing, verification, training analytics, logistics, lesson player and ID card paths.'],['Load tests','k6 smoke, authenticated and student workflow profiles.'],['Build gates','Lint, TypeScript build, unit/integration suites and CI security checks.']])
placeholder(doc,'TEST RESULTS / CI SCREENSHOT PLACEHOLDER','Insert latest CI run, test summary, coverage report and load-test chart. Update numbers at submission time.',1.7)
doc.add_heading('Recommended validation matrix',2)
make_table(doc,['Scenario','Expected result','Evidence'],[['Unauthorised user opens protected route','401/redirect; no protected data returned','E2E screenshot + API test'],['User from organisation B requests organisation A record','RLS returns no row or safe denial','Integration test'],['Expired or replayed TOTP','Attendance rejected and audited','Unit/integration test'],['NFC device scans valid credential','Device receives accepted response and trainee session is updated','Hardware video + API log'],['Offline attendance event','Encrypted local queue retains event and later reconciles','Mobile test + sync log'],['Public certificate verification','Valid certificate displays; invalid number fails safely','Public page screenshot'],['Employer sees candidate','Only policy-allowed verified data is visible','E2E role test']])

doc.add_heading('11 Deployment and Operations',1)
doc.add_paragraph('Local development uses Node.js, Dockerized Supabase and seeded data. The production path can use Vercel for the Next.js application, Supabase for managed data and storage, and a scheduled worker or platform job for reports and cleanup.')
make_table(doc,['Environment','Required actions'],[['Local','Install dependencies, start local Supabase, apply migrations and seed, configure .env.local, run the dev server.'],['Staging','Use isolated Supabase project, apply migrations, configure secrets, run CI and seed non-sensitive demo data.'],['Production','Set environment variables, configure auth redirects, apply migrations through controlled release, enable monitoring, backups and cron authentication.'],['Hardware lab','Provision device credentials, configure API endpoint and Wi-Fi, run reader/display/network checks, then test accepted/rejected/offline flows.']])
doc.add_heading('Operational checklist',2); bullets(doc,['Rotate any secret that may have appeared in source control history.','Keep service-role and AI keys server-side only.','Back up database and storage according to institutional policy.','Monitor error rates, attendance reconciliation, report jobs and certificate verification.','Record deployed app version, schema migration version, hardware firmware and device inventory.'])

doc.add_heading('12 Current Limitations and Risks',1)
make_table(doc,['Risk / limitation','Impact','Mitigation'],[['Hardware sketch is a reader/display proof of concept','No production network, device authentication or enclosure yet','Implement signed scan API, provisioning, retries, watchdog and field tests.'],['Mobile app packaging is ahead of full native UX','Some workflows may still be web-first','Prioritise trainee and trainer flows, then add native capabilities incrementally.'],['Biometric privacy and operating policy','Face recognition may not be deployable without consent and governance','Use explicit consent, retention, opt-out and fallback procedures.'],['Connectivity in rural or campus environments','Attendance and learning may be interrupted','Offline-first queues, reconciliation and clear operator feedback.'],['AI reliability','Recommendations can be incomplete or wrong','Ground responses in verified platform context, show uncertainty and keep human review.'],['Scale and observability','Large national rollout needs stronger SLOs and capacity evidence','Run realistic load tests, add tracing, alerting, backups and regional capacity planning.']])

doc.add_heading('13 Future Goals and Roadmap',1)
doc.add_paragraph('The future roadmap is organised around readiness rather than feature volume. Each phase should end with measurable evidence and a pilot decision.')
make_table(doc,['Phase','Goals','Exit evidence'],[['Phase 1: Prototype completion','Finish hardware enclosure, device auth, API integration, mobile trainee shell and final architecture/circuit diagrams.','Live kiosk demo; Android build; signed scan requests; offline replay test.'],['Phase 2: Pilot readiness','Pilot with one institute, defined consent and data policy, certificate workflow, trainer onboarding and support process.','Pilot report; attendance accuracy; usability feedback; incident and recovery procedures.'],['Phase 3: Multi-institute rollout','Institution onboarding, configurable programmes, multilingual content, stronger analytics and scheduled reporting.','Three or more institutes isolated correctly; dashboards and export evidence.'],['Phase 4: Employment network','Employer onboarding, verified skill search, matching improvements, placement outcomes and alumni tracking.','Employer workflow; placement funnel metrics; candidate data policy.'],['Phase 5: National scale','High availability, disaster recovery, observability, regional operations, interoperability and governance.','Load and failover evidence; security review; operating runbook; support SLAs.']])
doc.add_heading('Long-term product goals',2); bullets(doc,['A portable, verifiable skill passport that trainees can use across institutions and employers.','Interoperability with government and institutional systems through carefully governed APIs.','Advanced learning analytics for dropout risk, skill gaps and programme effectiveness.','Offline-capable mobile delivery for low-connectivity training centres.','Hardware fleet management, OTA firmware updates and tamper-aware attendance devices.','Accessible multilingual learning and administrative interfaces.','Transparent AI assistance with explanation, feedback and human escalation.'])

doc.add_heading('14 Demonstration Script',1)
doc.add_paragraph('A ten-minute demonstration should show one coherent trainee journey and one administrator control loop.')
numbered(doc,['Open the public landing page and explain the cooperative training problem.','Enter demo mode and switch to Institute Admin; show institution, programme, batch and session.','Switch to Trainer; start a session and capture attendance using QR/TOTP or the NFC prototype.','Switch to Trainee; show attendance history, course progress, assessment and certificate.','Open the public certificate verification page in a separate browser context.','Show the skill passport and employment-readiness score.','Open Career AI for a skill-gap or course recommendation.','Switch to Employer; publish a job and review a candidate using verified skills.','Show analytics, audit history, approvals or report export.','Close with the hardware roadmap, mobile app screens and future scale plan.'])
placeholder(doc,'LIVE DEMO SCREENSHOT STRIP','Insert 3 to 5 labelled screenshots from the final demonstration.',1.6)

doc.add_heading('15 Appendices and Evidence Placeholders',1)
doc.add_heading('Appendix A Hardware Bill of Materials',2)
make_table(doc,['Item','Qty','Status / specification','Reference'],[['ESP32 development board','1','Record exact board and firmware version',''],['PN532 NFC module','1','SPI mode; record antenna and card types tested',''],['ILI9341 TFT display','1','Record size and resolution',''],['Power supply / regulator','','Record voltage, current and connector',''],['Enclosure and mounting','','Add mechanical design and dimensions',''],['Network accessories','','Document Wi-Fi or alternative connectivity','']])
doc.add_heading('Appendix B Circuit Diagram',2); placeholder(doc,'FULL CIRCUIT DIAGRAM','Include pin map, power rails, ground, level shifting, decoupling, protection and connector labels.',3.0)
doc.add_heading('Appendix C Mobile Application',2); placeholder(doc,'MOBILE USER FLOW / SCREEN MAP','Insert navigation map and annotated screens for trainee, trainer and admin roles.',2.4)
doc.add_heading('Appendix D API and Database Evidence',2); placeholder(doc,'API CONTRACT / DATABASE ER DIAGRAM','Insert endpoint inventory, ER diagram, RLS policy summary and example request/response traces.',2.5)
doc.add_heading('Appendix E Team and Contribution Record',2)
make_table(doc,['Member','Role / contribution','Evidence link or note'],[['','Product / requirements',''],['','Frontend / UX',''],['','Backend / database / security',''],['','AI / analytics',''],['','Hardware / embedded',''],['','Testing / deployment / documentation','']])
doc.add_heading('Appendix F Submission Checklist',2); bullets(doc,['Final problem statement and abstract attached.','Architecture, data flow and circuit diagrams attached.','Hardware prototype photographs and live test evidence attached.','Mobile app screenshots or build attached.','Latest test and CI results attached.','Deployment instructions and demo credentials documented securely.','Privacy, consent, certificate verification and future roadmap reviewed.','Team contributions and references completed.'])
doc.add_heading('Closing Statement',1)
doc.add_paragraph('CoopSetu provides a credible foundation for a unified cooperative training ecosystem. The current implementation already covers the central digital workflow and its supporting security, testing and governance layers. Completing the hardware API integration, mobile experience, pilot governance and operational evidence will move the project from a strong prototype toward institution-ready deployment.')
doc.core_properties.title='CoopSetu Full Project Report'; doc.core_properties.subject='Cooperative Training, Attendance, Skills and Employment Platform'; doc.core_properties.author='CoopSetu Project Team'
doc.save(OUT); print(OUT.resolve())
