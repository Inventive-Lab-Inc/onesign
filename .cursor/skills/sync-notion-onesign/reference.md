# OneSign Notion reference

## Notion MCP server

`plugin-notion-workspace-notion`

Tools used by this workflow:

| Tool | Use |
|------|-----|
| `notion-search` | Find OneSign tasks/bugs |
| `notion-fetch` | Read page properties and content |
| `notion-update-page` | Update properties, insert/replace content |
| `notion-create-pages` | New tasks and bugs |

Read each tool's JSON schema under the MCP descriptors folder before calling.

Database bulk query (`notion-query-database-view`) may require Notion Business — use search + fetch per page if it fails.

---

## OneSign project

| Item | Value |
|------|-------|
| Project page URL | `https://app.notion.com/p/38eaa196744a8005a9a1cd22ae069915` |
| Project page ID | `38eaa196-744a-8005-a9a1-cd22ae069915` |
| Timeline start | `2026-04-17` (initial commit) |
| Marketing / product URL | `https://onesigntv.com` |

---

## Tasks database

| Item | Value |
|------|-------|
| Database URL | `https://app.notion.com/p/38aaa196744a80049b31e8350cde2302` |
| Data source ID | `38aaa196-744a-80d1-83e7-000baa0291c1` |

### Status values

`Not started` → `Up next` → `In progress` → `Done`

### Properties

| Property | Format |
|----------|--------|
| Name | Title (plain language) |
| Status | One of status values above |
| Project | JSON array of project page URLs |
| Responsible | JSON array of user IDs |
| Parent item | JSON array with one parent page URL |
| Due date | `date:Due date:start` (ISO date), `date:Due date:is_datetime`: `0` |

---

## Bugs database

| Item | Value |
|------|-------|
| Database URL | `https://app.notion.com/p/38eaa196744a80f382f8cd076cc5d735` |
| Data source ID | `dfbaa196-744a-83aa-a282-07dfdfb2ab8b` |

Same Status values as Tasks. No Responsible field on Bugs.

Bug titles: plain language ("Console went blank after an update"). Body: what happened + commit + fix.

---

## People

| Name | User ID | When to use |
|------|---------|-------------|
| Aminul Islam Borhan | `38ad872b-594c-8122-b912-0002620c8515` | Default Responsible for OneSign tasks |

---

## Milestone groups (Done, for sub-task linking)

| Milestone | Page ID |
|-----------|---------|
| Start the project | `392aa196-744a-81f1-ac61-cdc8db142e4e` |
| Launch the TV player app | `392aa196-744a-81418a02dadb2600c052` |
| Build the customer console | `392aa196-744a-81dc9ac2e29e362b642b` |
| Set up the admin back office | `392aa196-744a-8182b747feb58664cdf7` |
| Set up hosting and infrastructure | `392aa196-744a-81488509f962d4d3179a` |
| Figure out the signup journey | `392aa196-744a-81e0bd59f1523fe071e7` |
| Make sign-in easier for customers | `392aa196-744a-81f2816df7a7053a6f40` |
| Open the product to new customers | `392aa196-744a-8152ab87edc13e329108` |
| Support teams and workspaces | `392aa196-744a-81c38758e067d70816dd` |
| Polish brand and product experience | `392aa196-744a-815dbf4fd4ae14621e11` |

---

## Open backlog (typical — verify in Notion)

These often stay open until explicit git evidence:

- Accept online payments (Stripe)
- Add live chat on website and customer account
- Calendar view for content schedules
- Support multiple currencies on plans (partial)
- Back-office for managing the platform (partial)
- Redesign the customer home screen
- Mobile app for platform admins
- Admin UI tasks (client list actions, plan dropdown, etc.)

---

## Git → Notion mapping hints

| Git signal | Notion action |
|------------|---------------|
| `Ship Android TV v0.9.X OTA` | Update TV milestone + OTA sub-task + project page version |
| `Fix ... crash` | Bug (Done) or update existing bug with recurrence note |
| `Revert ...` | Task note documenting decision reversal |
| `Migrate ...` / `Move ... to MinIO` | Infrastructure milestone sub-task |
| Large feature commit | Done task under relevant milestone |

---

## Security

- Never store API keys, Stripe secrets, or `.env` values in Notion pages
- If secrets appear in a task body, replace with "store in `.env.local` only" and warn user to rotate

---

## Archived pages

Some sub-tasks may be archived in Notion — updates will fail with "Can't edit block that is archived". Skip and note in the summary.
