---
name: sync-notion-onesign
description: >-
  Sync OneSign Notion tasks and bugs with local git history. Finds pending
  Notion items, validates against commits, marks done work, backfills missed
  tasks/bugs, and updates due dates. Use when the user asks to sync/update
  Notion, check pending tasks, reconcile git with Notion, or refresh the
  OneSign project board.
---

# Sync OneSign Notion with Git

Keep the OneSign project board accurate against `git log`. Notion is the source of truth for *intent*; git is the source of truth for *what shipped*.

## Before you start

1. Read [reference.md](reference.md) for Notion IDs, MCP tools, and field formats.
2. Confirm `plugin-notion-workspace-notion` MCP is available.
3. Run git from repo root: `/Users/aminul/All Projects/digital-signage`.

## Workflow overview

```
1. Gather state     → Notion pendings + recent git
2. Reconcile        → Match commits to open tasks
3. Discover gaps    → Commits with no Notion item
4. Preview changes  → List what you will update (required unless user says "apply directly")
5. Apply updates    → Notion create/update
6. Summarize        → Short report of what changed
```

---

## Step 1 — Gather Notion state

Search and fetch OneSign-linked items:

- **Project page**: fetch by ID (see reference.md)
- **Open tasks**: search `OneSign` in Tasks; focus on Status = `Not started`, `Up next`, `In progress`
- **Recently touched Done tasks**: any with stale status notes contradicting Done
- **Bugs**: search Bugs database for OneSign project; check open or recently fixed items

Use `notion-search` with `query: "OneSign"` and fetch individual pages for status, description, due date, and parent links.

Record a working list:

| Title | Status | Due date | Notes |
|-------|--------|----------|-------|

---

## Step 2 — Gather git state

```bash
# Commits since last known sync (default: last 14 days; widen if user asks for full backfill)
git log --format="%ad %h %s" --date=short --since="14 days ago"

# For each candidate commit, get scope when unclear
git show --stat --format="%h %s%n%b" <sha>
```

Project started **April 2026** (`5c9e29b`). Do not assign 2025 dates.

Identify:

- **Completion signals**: `Ship`, `Fix`, `Add`, `Refactor`, `Release`, OTA version bumps
- **Decision reversals**: `Revert`, storage/auth flow changes, renames — document as tasks with decision notes, not just bugs
- **Bug fixes**: map to Bugs database entries (update existing or create new)

---

## Step 3 — Reconcile open tasks

For each **pending** Notion task, ask:

| Question | If yes |
|----------|--------|
| Does git show this shipped? | → **Done**, update status note + commits + due date from commit date |
| Partially shipped? | → Keep **In progress**, update note with what shipped vs what remains |
| No git evidence? | → Leave unchanged |
| Status is Done but note says "Not started"? | → Fix the note (data inconsistency) |

### Title and description rules

- **Titles**: plain product language — no jargon, no commit hashes, no file paths
- **Descriptions**: technical detail — commits, key files, APIs, edge cases
- **Responsible**: always assign the project lead (see reference.md)
- **Due dates**: use the **commit date** for Done work; realistic future dates for open items

### Status note template (prepend to page)

```markdown
## Status note (Mon YYYY)
**Shipped.** [One sentence, non-technical]

**Technical detail:** [What changed, where]

**Key commits:** `abc1234`, `def5678`

---
```

For partial work, use **In progress.** instead of **Shipped.**

---

## Step 4 — Discover missed work

Scan git commits that have **no matching Notion task or bug**:

| Commit type | Where to put it |
|-------------|-----------------|
| User-facing feature | New **Done** task; sub-item under relevant milestone if one exists |
| Bug fix | New **Done** bug in Bugs DB, or append fix note to existing bug if recurrence |
| Infrastructure / decision | Milestone sub-task or new milestone group |
| OTA release | Update **Update TVs without reinstalling** + **Launch the TV player app** milestone; bump project page TV version |

Group related commits into one task when they ship one logical outcome (e.g. a UI refactor + its build fix).

Do **not** create tasks for: typo-only commits, doc-only deploy verification, co-author metadata, `.env` churn.

---

## Step 5 — Preview before updating (default)

**Always show the user a change plan before writing to Notion**, unless they explicitly say "apply directly", "go ahead", or "skip preview".

Use this format:

```markdown
## Planned Notion updates

### Tasks to update (existing)
| Task | Change |
|------|--------|

### Tasks to create
| Title | Status | Parent |

### Bugs to update/create
| Title | Change |

### Not changing
[Brief list of open items with no git evidence]

### Notes
[Ambiguities, partial completions, items needing user decision]
```

Wait for approval, then apply.

---

## Step 6 — Apply Notion updates

Read MCP tool schemas before calling (`notion-update-page`, `notion-create-pages`, `notion-fetch`, `notion-search`).

### Update properties

```json
{
  "command": "update_properties",
  "page_id": "<uuid>",
  "properties": {
    "Name": "Plain language title",
    "Status": "Done",
    "Responsible": "[\"<user-id>\"]",
    "date:Due date:start": "2026-07-05",
    "date:Due date:is_datetime": 0
  }
}
```

### Update content

- Prefer `insert_content` at start for status notes (preserves mockups below)
- Use `update_content` for replacing stale status notes
- Use `replace_content` only when replacing entire body (e.g. removing secrets from Stripe task)

### Create tasks

```json
{
  "parent": { "type": "data_source_id", "data_source_id": "<tasks-data-source-id>" },
  "pages": [{
    "properties": { "Name": "...", "Status": "Done", "Project": "[\"<onesign-project-url>\"]", ... },
    "content": "**Technical detail:** ..."
  }]
}
```

Link sub-items via `"Parent item": "[\"<parent-page-url>\"]"`.

After applying, fetch 1–2 pages to verify properties landed.

---

## Step 7 — Project page maintenance

When TV OTA or major milestones ship, update the **OneSign project page**:

- Bump Android TV version in "Where we are today"
- Add timeline bullet for the sprint/date
- Keep timeline anchored to **Apr 2026** project start

---

## Step 8 — Summarize

Report to the user:

- Count of tasks/bugs updated vs created
- Key items marked Done
- Open backlog unchanged
- Anything flagged for their decision

---

## Checklist

```
Notion sync

- [ ] Fetched OneSign open tasks and bugs
- [ ] Pulled recent git log (+ show --stat for ambiguous commits)
- [ ] Reconciled pendings against git
- [ ] Identified missed commits
- [ ] Shared preview plan with user (unless apply-directly)
- [ ] Applied approved updates
- [ ] Updated project page if TV version or major milestone changed
- [ ] Summarized results
```

## Related skills

- Full deploy + release context: **deploy-onesign**
- Web-only deploy: **deploy-web-onesign**
