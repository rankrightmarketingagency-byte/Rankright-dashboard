# Rank Right Owner and Team Dashboard

This standalone dashboard lives separately from the Rank Right website. Owner and team member views use the same secured workspace with role-based access.

## Open the dashboard

1. Open the sign-in page: `file:///C:/Users/Intel/Documents/Codex/2026-11-01/do/outputs/rank-right-dashboard/index.html`.
2. Owner page: `file:///C:/Users/Intel/Documents/Codex/2026-11-01/do/outputs/rank-right-dashboard/owner.html`. Team page: `file:///C:/Users/Intel/Documents/Codex/2026-11-01/do/outputs/rank-right-dashboard/team.html`.
3. If you prefer a local preview server, run `start-dashboard.cmd` from this folder.

Use the local HTTP preview for sign-in so the browser shares the auth session between pages. The static JavaScript bundle also supports direct file previews. After changing `config.js`, `supabase.js`, `auth.js`, or `portal.js`, rebuild the bundle with `node build-file-dashboard.mjs`.

## Current setup

- Supabase project: **digital marketing agency** (`bbcmzzjicuhlmulvcpgu`), region **ap-south-1**.
- Dashboard schema migration `rank_right_dashboard_workspace` is applied (version `20261027202356`). The access-request migration is applied separately.
- Dashboard tables have Row Level Security enabled. Ten service lines match the existing Rank Right website.
- Private team deliverable storage is enabled in the `team-deliverables` bucket (50 MB per file). Only active members assigned to a project can upload/read files under that project; the owner can review and download them from **Review centre**. Storage policies are in migrations `20261028135607_private_team_deliverables` and `20261028135722_allow_member_upload_cleanup`.
- Both Overview pages show **Active team** and **Team members joined** totals in the same horizontal stats row as the other dashboard metrics. The `workspace-team-summary` Edge Function authenticates the current workspace member and returns aggregate counts; the team dashboard also displays active team member names as requested.
- Team members can use `team-login.html` to submit a name and email before creating a login. The optional password field is used only after owner approval to create the team account; it is not sent with or stored in the access request. The owner reviews requests in **Access requests** and approval is required before a member can enter. The owner continues to use `index.html`.
- The requested owner Gmail is a confirmed Auth account and the single active owner. Enter its email and password in the normal sign-in form. Owner access is assigned automatically after sign-in.
- Both dashboards have a labeled Log out button. In Settings, each member can update their display name and change their password with confirmation and Show/Hide controls.
- The original website and its contact-enquiry records were not changed. No fabricated dashboard metrics or sample project records were added.
- Production backups were not created; backup was waived for this setup by the project owner.

## Dashboard areas

### Owner

Overview, access requests, team and service assignments, website enquiries, clients, services, projects and team assignment, review centre, task management, progress updates, calendar, project templates and checklist items, recurring-work rules, client approvals, reports and CSV export, activity log, notifications, and settings.

### Team member

Personal overview, assigned projects, assigned services, tasks and progress updates, work submissions, review feedback, calendar, notifications, available templates, personal activity, and role-scoped reports and CSV export.

## Setup-dependent features

- Email delivery requires project SMTP settings.
- Team members can upload up to 10 files at a time from **Overview**, **Assigned projects**, or **Submit work**. Each upload creates a pending review submission, so it appears in the owner’s **Review centre** with a download action.
- Recurring work rules are stored, but automatic generation needs a tested server-side scheduler.
- Client approval links require a secure token-generation and validation endpoint. The dashboard does not create public or guessable client links.
- The frontend uses only the public publishable key; Row Level Security is the database authorization boundary. Never place a service-role or secret key in this folder.

The existing website's contact forms continue using their own shared form code. Do not copy dashboard files over the website.
