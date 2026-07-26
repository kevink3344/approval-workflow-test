# Workflow Type Options — Beyond Approvals & Reminders

**Date:** 2026-07-25  
**Status:** Ideas — for future consideration

---

## Overview

The current system supports **Approval Workflows** (sequential/slot-based approval by groups) and is planning **Reminder Workflows** (one-to-many manager broadcasts). This document explores additional workflow types that could be added.

---

## 1. Voting / Poll Workflow

Multiple people vote on a proposal (yes/no/abstain). The outcome is determined by vote count or percentage (e.g., "simple majority," "2/3 majority," "unanimous"). Different from approval because there's no sequential blocking — everyone votes in parallel and the aggregate result matters, not the order.

**Example:** Team votes on conference attendance budget.

**Key differences from approval:**
- Parallel voting (no slot ordering)
- Aggregate result based on threshold (majority, unanimous, etc.)
- No single blocker — outcome depends on group totals

---

## 2. Feedback / Review Workflow

Parallel feedback collection where multiple reviewers provide comments simultaneously. No one blocks anyone else, and there's no pass/fail outcome — the goal is gathering input. Different from approval because it's non-blocking and informational.

**Example:** Design review — 5 stakeholders leave comments on a mockup, and the requester decides how to proceed.

**Key differences from approval:**
- Non-blocking (no approve/reject)
- No resolution/finality — comments keep flowing
- Requester retains control over how feedback is used

---

## 3. Fill-out / Contribution Workflow

A form or document gets routed to multiple people in sequence, but each person **fills in their section** rather than approving/rejecting. The workflow tracks who has completed their part and who hasn't.

**Example:** Onboarding checklist — HR fills payroll info → IT fills equipment needs → Manager fills team assignment. The form is complete when all sections are done.

**Key differences from approval:**
- Each step has assigned fields (not just approve/reject)
- Completion replaces approval as the milestone
- No concept of "rejection" — steps are either filled or pending

---

## 4. Sign-off / Certification Workflow

Like approval but with stronger attestation. Each signer must explicitly confirm they've reviewed something (with a timestamped digital signature equivalent). Often used for compliance, legal, or safety-critical processes. Could include a "declaration" checkbox (e.g., "I confirm I have reviewed the security assessment").

**Example:** Code deployment sign-off — developer certifies testing complete → QA lead certifies tests passed → security lead certifies no vulnerabilities.

**Key differences from approval:**
- Attestation text/declaration per step
- Stronger audit trail (certification record)
- May include document version tracking

---

## 5. Escalation Workflow

A time-bound approval where if no action is taken within a deadline, the request automatically escalates to the next person or group. Adds SLA tracking and urgency.

**Example:** Expense approval — if manager doesn't approve within 48 hours, it auto-escalates to the finance director.

**Key differences from approval:**
- Deadline timers per step
- Auto-advance on timeout (escalation path)
- SLA tracking and reporting
- Expiration notifications/reminders

---

## 6. On-Call / Rotation Workflow

Tasks or requests get auto-assigned to whoever is currently on duty from a rotating pool of people. The system tracks the schedule and routes to the right person.

**Example:** After-hours support request → auto-assigned to whoever is on call this week from the SRE team.

**Key differences from approval:**
- Schedule/rotation management
- Auto-assignment based on time/schedule
- Pool of people (similar to approval groups but time-based)
- Override/swap capability for schedule changes

---

## Compatibility With Existing System

| Workflow Type | Can Share With Existing... | Unique Requirement |
|---|---|---|
| Voting/Poll | Notification system, approval groups | Vote tallying + threshold logic |
| Feedback/Review | Notification system, comments | No blocking/slots, parallel-only |
| Fill-out | Workflow columns/fields, slots | Per-step field ownership (who fills what) |
| Sign-off | Approval slots | Attestation text + stronger audit trail |
| Escalation | Approval slots (extends them) | Deadline timers + auto-advance logic |
| On-Call Rotation | Approval groups | Schedule management + auto-assignment |

---

## Recommendation

The existing **approval workflow** system is the most complex and foundational type. **Reminders** (just planned) are the simplest broadcast type. Between those two poles, the most practical next workflow type would be **Voting/Poll** — it reuses most of the existing infrastructure (approval groups, notifications, UI patterns) while being meaningfully different in its resolution logic (aggregate votes vs. sequential gating).