# NYCHCom - NYC Housing Compliance

CS546 Group 24 final project. Real-time violation tracking, compliance
alerts, and legal resource navigator for NYC tenants, landlords, and admins.

## Getting started

```bash
npm install
npm run seed
npm start
```

Server runs on http://localhost:3000. Mongo URL + db name live in
`config/settings.js`.

Run `npm run format` before committing.

## Structure

```text
app.js              express entry, session, guard wiring
middleware.js       auth + role guards
helpers.js          shared input validators
config/             mongo connection + settings
data/               DB access, one file per collection
routes/             express routers, one file per feature
views/              handlebars templates
public/             static assets (css, client js)
tasks/seed.js       drops + reseeds the DB
docs/               project + database proposals (PDFs)
```

## Where things go

- **New feature**: add `routes/<name>_routes.js` + `data/<name>.js` +
  `views/<name>.handlebars`, mount the router in `routes/index.js`
  (above the 404), and add a guard in `app.js`.
- **New validator**: add to `helpers.js` (e.g. `checkAddress`). Throw
  strings, return cleaned values.
- **New guard**: add to `middleware.js` using `requireRole(...)` and
  export a named wrapper if you'll reuse it.
- **Admin users**: seeded by `tasks/seed.js`, or created in code with
  `createUser(..., { allowAdmin: true })`. Public `/register` only
  accepts `tenant` / `landlord`.
