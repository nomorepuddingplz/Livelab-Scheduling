# LiveLab Schedule Workdesk

Internal bilingual scheduling application for LiveLab livestreams, training sessions, shoots, hosts, moderators, projects and rooms.

This repository is an IT handoff package. It includes the complete application source, database migrations, a current scheduling database snapshot, and the source scheduling workbooks used during setup. Keep the repository private because the bundled data contains employee names, company IDs, availability and schedules.

## Start the current schedule locally

Requirements: Node.js 20 or newer and pnpm.

```bash
corepack enable
pnpm install
pnpm dev
```

Open:

- Company workspace: `http://127.0.0.1:4173/admin#schedule`
- Employee availability form: `http://127.0.0.1:4173/availability`

On first start, `data/livelab-schedule.sqlite` is copied to `.work/preview.sqlite`. Local changes are written only to the `.work` copy. To restore the bundled handoff snapshot, stop the server, delete `.work/preview.sqlite`, and start the server again.

See [IT-HANDOFF.md](IT-HANDOFF.md) for architecture, data, security and deployment notes.

Shared scheduling workspace with larger English labels and smaller Chinese translations. Project and room calendars use white time grids; only people have grey unavailable time. Projects open directly in Calendar; Table is a view switch within the schedule. Each project receives a stable automatic pastel color, shared by events, overlays, tables, and images.

## Workflows implemented

- PM/HR maintains members, roles, rooms, project managers, and projects. Member CSV import is previewed and saved atomically.
- One shared `/availability` entry: choose a registered name, fill any Monday–Sunday week, save, copy the previous week, or continue to the following week.
- Los Angeles time, 24-hour days, 15-minute increments, cross-midnight events.
- One Event contains livestream/training/shoot/other details, one project, one room, notes, and multiple independently timed host/moderator assignments. Room setup/wrap-up can be specified separately.
- PM/HR can drag directly on person, project, and room calendars to create an event with its time and current selection filled in. No edit-mode switch is required. Selection snaps to 15-minute boundaries, supports crossing midnight, scrolls near calendar edges, and cancels with Escape.
- Person calendars support multiple faint project overlays; clicking one adds that person to the same event. Dragging an intersecting range offers joining or creating an independent event.
- Person, project, and room Calendar/Table views; PM/project/room filters; real Excel (.xlsx), CSV, and weekly PNG export actions. Excel retains the selected week and filters and includes a separate selection sheet; member/room directories and availability tables also support Excel downloads.
- Room and member overlaps are allowed, recalculated globally, and shown in Alerts and on calendar blocks. Availability warnings also remain visible. Adjacent events stay separate.
- Availability and event edits use revision checks to avoid overwriting another editor's newer change. Refresh reads updated availability and activity data.

- Livestream drafts default room setup/wrap-up to 15 minutes before/after, with hosts following event hours and moderators following room hours. Other types follow event hours. Explicit time edits and existing records stay intact.
- Event participant pickers can create and select a new member without losing the event draft. Only the Members directory filters All / Hosts / Moderators, and its all-members view groups roles. Schedule selectors retain weekly/all-member selection.
- Calendars provide Fit 24 hours, Compact, Standard, and Large zoom while keeping 15-minute selection. Every schedule scope has an in-page table preview, Excel download, and schedule image.
- PM cards use an overflow menu for deletion; PMs with active projects must have their projects reassigned first. Filters and menus close on outside clicks.
- White/neutral grey interface, pale blue accents, and bundled Plus Jakarta Sans (SIL Open Font License in `public/vendor/PlusJakartaSans-LICENSE.txt`). Larger English labels with smaller Chinese translations.

## Access

No fixed-email allowlist or individual personnel login.

Production requires a server-only, high-entropy `ADMIN_ACCESS_KEY` secret. The management URL is `/admin#key=<secret>`. Opening it exchanges the fragment for a Secure, HttpOnly cookie and removes the secret from the address bar. PM/HR share the original management link. The public employee link is `/availability` and contains no management key. Every administrative API checks the session independently of the UI. Public visitors can deliberately select any registered person, as requested; they cannot create members or access projects/events. HR can fill or update an optional Company ID for payroll matching. It appears in the company member directory and grouped weekly export; employee entry still uses names and does not expose company IDs. Stable member IDs preserve existing schedule links.

The Site can become public only after this protected backend is deployed and verified. Keep the management link inside the company. Rotating `ADMIN_ACCESS_KEY` invalidates all existing management sessions.

## Local preview

Run `pnpm dev` from this folder. Default port 4173; set `PORT=4174 pnpm dev` for a second preview. The preview binds to localhost, uses `.work/preview.sqlite`, applies generated migrations, and simulates company access locally. It does not modify a production database. The first run copies the bundled scheduling snapshot from `data/livelab-schedule.sqlite`.

Run `node --test scripts/*.test.mjs` for 31 checks covering permissions, persistence, atomic imports, revision conflicts, split shifts, cross-week events, room/person conflicts, cancellation, daylight saving time, and calendar selection boundaries. Run `node scripts/build.mjs` to build the Worker bundle. Excel packages are created locally in the browser with bundled JSZip 3.10.1 (MIT license in `public/vendor/JSZip-LICENSE.txt`), without an external data service. Exported Excel/CSV/PNG files use short-lived same-origin attachment URLs, with an explicit Save file link for retries. Prepared files expire after five minutes and are cleaned up on the next export. The loopback preview writes exports directly to ~/Downloads/LiveLab Exports and reports success only after the file is written, avoiding embedded-browser download handling. Existing files are preserved with numbered filenames. Hosted sites continue using attachment downloads.

## Publication status

The existing Site ID is retained in `.openai/hosting.json`. Its current live version is the earlier navigation-only version. **The completed workspace has not been published. Do not start production HR entry yet.**

Normal Sites source synchronization was rejected by automatic approval (`sandbox_approval` is disabled), including after filesystem and network permission grants. Build output and source remain local. Do not use the old remote commit SHA to publish this new archive.

To finish in an authorized publishing environment: open/synchronize this same Site with the official Sites workflow, push the reviewed source, package the exact pushed commit, configure `ADMIN_ACCESS_KEY` as a secret, deploy with D1 migrations, verify private administration and the unprivileged employee API, then apply the user-approved public audience and provide the two separate links.

All selection menus use rounded, 85%-opaque surfaces; member/project/room/PM selections support typing to search. Participant options follow the selected role. PM projects can be dragged between owners, preserving existing events and assignments.

Member-directory Excel exports the selected week grouped by Hosts, then Moderators, then each person’s actual participation shifts. Company IDs remain text (including leading zeros). Unscheduled people are marked explicitly; dual-role assignments appear under their respective role.

Cancelled events stay visible as grey records in calendars, tables, schedule Excel and PNG exports. Cancelled records retain original scheduled hours in every export; no pay calculation is performed. PMs explicitly mark Cancel within 24h, separately from Delete event. Deleted records are hidden from calendars, tables and exports. Both release occupancy.
