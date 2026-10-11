# VOYAGE · Access Control & Admin Dashboards

Patch prepared against the supplied `voyage-audit.zip` and Postgres schema dump dated 2026-10-10. It contains complete replacement files, new pages/actions and one additive SQL migration.

## 1. Exact file changes

### Middleware filename

- Keep the project-root `middleware.ts` beside `app/` and `package.json`; the patch replaces that file.
- If `app/middleware.ts` still exists as a duplicate legacy file, delete only that nested copy. Do not delete the root `middleware.ts`.

### Add

- `middleware.ts`
- `app/actions/access-control.ts`
- `app/banned/page.tsx`
- `app/(dashboard)/admin/roles/page.tsx`
- `app/(dashboard)/admin/database/page.tsx`
- `app/(dashboard)/dashboard/ResidentProfileDashboard.tsx` — preserved resident profile screen, moved out of the route file so `/dashboard` can be a server-side role switch.
- `supabase/migrations/20261011_001_access_control_bans.sql`

### Replace

- `app/(dashboard)/dashboard/page.tsx` — server-side routing by role; staff goes to `/admin`, resident keeps the previous profile UI.
- `app/(dashboard)/admin/page.tsx` — owner Command Center, admin operations panel, and limited manager workspace.
- `app/components/Sidebar.tsx` — staff Overview points to `/admin`; Full Database is visible to owner/admin; Role Management remains owner-only.
- `lib/rbac.ts` — `/admin/database` is accessible to owner/admin, `/admin/roles` remains owner-only.

## 2. SQL migration

Run the migration on a staging Supabase project first, after taking a backup. The migration:

- Adds `banned_until`, `ban_reason`, `ban_permanent`, `ban_set_at`, and `ban_set_by` to `profiles`.
- Uses PostgreSQL `infinity` for permanent bans and `ban_permanent` as an explicit flag for robust UI checks. Ban fields are changed only inside the two role-checked SECURITY DEFINER RPCs; direct profile UPDATEs cannot set or clear them.
- Adds `profile_ban_audit` for append-only ban/unban history.
- Adds owner-controlled role change RPC and role-checked ban/clear-ban RPCs.
- Drops the legacy `Profiles are viewable by everyone` SELECT policy and narrows `admin_full_access` on `game_attendance` to owner/admin so ordinary authenticated users cannot modify other residents’ stamps.

Existing roles, `profiles` records, tour scores, KYC tables, and game/passport tables are not dropped or recreated.

## 3. Permissions

- `owner` can change staff roles (`admin`, `manager`, or demote to `resident`), ban/unban a staff member, and ban/unban residents.
- `admin` can ban/unban resident profiles from `/admin/database`, but cannot change roles or ban/unban staff.
- `manager` cannot open `/admin/database` or `/admin/roles`.
- An owner account cannot be banned or demoted through these RPCs; this avoids locking out the final owner.
- Every Server Action checks the caller session/role; the corresponding RPC validates authorization again inside PostgreSQL.

## 4. Migration and deploy order

1. Back up the Supabase database and create a staging branch/project.
2. Apply `supabase/migrations/20261011_001_access_control_bans.sql`.
3. Copy the added files into the project and replace the listed files. Delete `app/middleware.ts`; do not keep duplicate middleware entry points.
4. Run `npx tsc --noEmit` and `npm run lint` locally.
5. Test with one user per role (`owner`, `admin`, `manager`, `resident`), a timed ban, a permanent ban, and an expired ban.
6. Deploy only after staging checks pass.

## 5. Verification status and limitations

- `npx tsc --noEmit` passed against the supplied project and the patch.
- ESLint passed on the new/rewritten pages, server actions, middleware, and RBAC module. The preserved resident dashboard and existing Sidebar contain pre-existing lint findings outside this patch's changes.
- Production build could not complete in this environment because Next.js attempted to download its native SWC binary and the network could not resolve `registry.npmjs.org`. This is an environment blocker, not a successful production-build result.
- The migration was statically reviewed against the schema dump but was not executed against your live Supabase database. Apply to staging and verify the functions/policies before production.

## 6. Next.js naming note

The supplied `package.json` pins Next.js `16.2.9`. Next.js 16 deprecates the `middleware.ts` convention in favor of root `proxy.ts`. This patch follows the requested root `middleware.ts` path; if your installed Next build no longer recognizes it, rename the root file to `proxy.ts` and change the exported function name from `middleware` to `proxy`.
