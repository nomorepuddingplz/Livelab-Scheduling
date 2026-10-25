# LiveLab Schedule Workdesk IT handoff

## Package contents

- `public/`: bilingual browser interface and exports.
- `src/`: API, authentication, event validation, time handling and downloads.
- `db/` and `drizzle/`: SQLite/D1 schema and migrations.
- `scripts/`: local server, build, imports and automated checks.
- `data/livelab-schedule.sqlite`: current schedule snapshot for local review.
- `data/source/`: the latest scheduling and availability source workbooks.
- `.openai/hosting.json`: existing Sites project metadata. It contains no access key.

## Local review

```bash
corepack enable
pnpm install
pnpm test
pnpm dev
```

The local server defaults to `127.0.0.1:4173`. It simulates company-editor access for `/admin` and exposes the public availability flow at `/availability`.

The application copies `data/livelab-schedule.sqlite` to `.work/preview.sqlite` only when the local database does not exist. This keeps the committed snapshot unchanged during review.

To reset local review data:

```bash
rm -f .work/preview.sqlite
pnpm dev
```

To run on another port:

```bash
PORT=4178 pnpm dev
```

## Production access model

Production requires a strong server-side `ADMIN_ACCESS_KEY`. Company editors enter through `/admin#key=<secret>`; the application exchanges the fragment for a Secure, HttpOnly cookie. Employees use `/availability` without administrative access.

Do not commit a real `.env` file or an access key. `.env.example` documents the required variable.

## Data and privacy

The bundled SQLite database and source workbooks contain employee names, optional company IDs, availability, project assignments and work times. Keep the repository private, grant access only to the internal IT team, and replace or remove the data snapshot before making any public fork.

The application uses Los Angeles time, 15-minute calendar increments and Monday-to-Sunday weeks. Cancelled events remain visible and grey; deleted events are hidden.

## Deployment notes

The production bundle is built with:

```bash
pnpm build
```

The generated worker entry is `dist/server/index.js`. Database migrations must be applied to the deployment database before traffic is enabled. Configure `ADMIN_ACCESS_KEY` in the hosting platform secret store, verify administrative and employee permissions separately, and test Excel/image downloads after deployment.

The existing `.openai/hosting.json` identifies the earlier Sites project, but this handoff does not publish or modify that remote project.

## Verification

Before deployment, run:

```bash
pnpm test
pnpm build
```

Then verify these flows in a browser:

1. Company workspace loads the bundled schedule.
2. Member, project and room Calendar/Table views agree.
3. Event create/edit/cancel/delete permissions behave correctly.
4. Employee availability entry cannot access administrative data.
5. Excel, CSV and schedule-image exports download successfully.
6. Conflicts and unavailable-time warnings remain visible without blocking authorized edits.
