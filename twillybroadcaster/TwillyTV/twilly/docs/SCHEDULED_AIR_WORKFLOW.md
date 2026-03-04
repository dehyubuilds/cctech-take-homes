# Scheduled / Air Workflow – End-to-End Guide

This doc describes how the **scheduled drop (premiere)** flow works in your AWS backend and how to complete it.

---

## 1. Two Flows in Your Backend

You have two different “scheduled air” mechanisms:

| Flow | Data model | Trigger | “Go live” mechanism |
|------|------------|--------|----------------------|
| **Episodes (series)** | `PK=USER#userId`, `SK=episodeId` (no `FILE#`) | `schedule-airdate.post.js` | Step Function **AirdateScheduler** + Lambda **update-episode-visibility** |
| **Twilly TV stream drops (FILE)** | `PK=USER#email`, `SK=FILE#fileId` | App → **convert-to-post** with `scheduledDropDate` | **release-scheduled-drops** Lambda (new) + EventBridge schedule |

The rest of this doc focuses on **Twilly TV stream drops** (Schedule Drop with a future date).

---

## 2. Twilly TV Scheduled Drop – Current State

### Already in place

1. **App**  
   - User chooses “Schedule Drop” and a future date.  
   - On stream stop, app calls **convert-to-post** with `scheduledDropDate` (ISO8601) and `postImmediately: false`.

2. **convert-to-post** (`server/api/streams/convert-to-post.post.js`)  
   - Accepts `scheduledDropDate`, `postImmediately`.  
   - When `scheduledDropDate` is in the future: sets FILE item to `status: 'HELD'`, `scheduledDropDate`, `releaseStatus: 'HELD'`, `isVisible: false` (and keeps or creates placeholder as needed).  
   - `releaseStatus` is used as the GSI partition key so the release Lambda can **Query** (no table Scan).

3. **get-content** (`server/api/channels/get-content.post.js`)  
   - Returns FILE items that are **visible** (`isVisible === true`) **or** **scheduled** (`status === 'HELD'`).  
   - HELD items are allowed without `streamKey` / `hlsUrl` / thumbnail so the “Airs [date]” premiere card can show.

4. **update-details** (`server/api/files/update-details.put.js`)  
   - Supports `status` (and already had `isVisible`, `airdate`).  
   - Used so a Lambda or other service can set `status = 'PUBLISHED'` and `isVisible = true` when releasing.

### Still required to “complete” the workflow

- **At air time**: something must find HELD items whose `scheduledDropDate` has passed and set them to **visible** and **published** so they become playable.  
- That “something” is the **release-scheduled-drops** Lambda, run on a **schedule** (e.g. EventBridge every 15 minutes).

---

## 3. How to Complete the Scheduled/Air Workflow

### Step 1: Add GSI **ReleaseSchedule** on table `Twilly`

Create a **sparse** GSI so the Lambda can Query instead of Scan:

- **Index name**: `ReleaseSchedule`
- **Partition key**: `releaseStatus` (String) — only FILE items with `releaseStatus = 'HELD'` have this attribute.
- **Sort key**: `scheduledDropDate` (String, ISO8601).
- **Projection**: All (so Query returns PK/SK for UpdateItem).

**Script (recommended):** From repo root, run:
```bash
cd TwillyTV/twilly/infrastructure && chmod +x add-release-schedule-gsi.sh && ./add-release-schedule-gsi.sh us-east-1
```
Or in AWS Console: DynamoDB → Tables → Twilly → Indexes → Create index.

### Step 2: Deploy the **release-scheduled-drops** Lambda

- **Code**: `TwillyTV/twilly/lambda/release-scheduled-drops.js`.
- **Runtime**: Node 18.x (or match your other Lambdas).
- **Behavior**:
  - **Queries** GSI `ReleaseSchedule` with `releaseStatus = 'HELD'` and `scheduledDropDate <= now` (no table Scan).
  - For each item, updates:
    - `isVisible = true`, `status = 'PUBLISHED'`, `airdate = scheduledDropDate`, `updatedAt = now`
    - **Removes** `scheduledDropDate` and `releaseStatus` (so the item leaves the GSI).
- **IAM**: Allow `dynamodb:Query` on table `Twilly` (index `ReleaseSchedule`) and `dynamodb:UpdateItem` on table `Twilly`.
- **Name**: `release-scheduled-drops`.

**Script (recommended):** From repo root, run (after Step 1):
```bash
cd TwillyTV/twilly/infrastructure && chmod +x deploy-release-scheduled-drops.sh && ./deploy-release-scheduled-drops.sh us-east-1 dev
```
This creates the Lambda, IAM role with Query (GSI) + UpdateItem, and an EventBridge rule to run it every 15 minutes.

### Step 3: Schedule it with EventBridge

- **Rule type**: Schedule (recurring).
- **Schedule**: e.g. **rate(15 minutes)** or **cron(0/15 * * * ? *)** (every 15 minutes).
- **Target**: Lambda `release-scheduled-drops`, no payload needed.

Result: every 15 minutes the Lambda runs, **queries** the GSI for due HELD items, and flips them to visible/published so they show as playable on the timeline.

### Step 4: (Optional) Fan-out to timelines when releasing

If you use a **timeline** table (e.g. `TIMELINE#...` entries per viewer) and you only add items when they’re published:

- In **release-scheduled-drops**, after updating a FILE to `isVisible=true` and `status=PUBLISHED`, call your existing **timeline-utils** (or equivalent) to add that FILE to the right viewers’ timelines.  
- If timeline entries are created when the FILE is first created (HELD) and you just filter by visibility when reading, you can skip this.

---

## 4. End-to-End Flow (Twilly TV Scheduled Drop)

```
1. User streams, then taps "Schedule Drop" and picks a future date.
2. User stops stream.
3. App calls POST /streams/convert-to-post with:
   - scheduledDropDate (ISO8601)
   - postImmediately: false
4. convert-to-post sets FILE:
   - status = 'HELD', scheduledDropDate = <chosen date>, releaseStatus = 'HELD', isVisible = false
5. get-content returns HELD items → app shows “Airs [date]” / premiere card (not playable).
6. Every 15 min, EventBridge runs release-scheduled-drops Lambda.
7. Lambda queries GSI ReleaseSchedule (releaseStatus=HELD, scheduledDropDate <= now) — no Scan.
8. Lambda updates each FILE:
   - isVisible = true, status = 'PUBLISHED', airdate = scheduledDropDate
   - REMOVE scheduledDropDate, releaseStatus
9. Next get-content (or timeline read) returns these as normal playable items.
```

---

## 5. Episodes Flow (Reference Only)

For **episodes** (series model, not FILE):

- **schedule-airdate.post.js**:  
  - If airdate is in the past/now → invokes **update-episode-visibility** Lambda (synchronous).  
  - If airdate is in the future → starts Step Function **AirdateScheduler** with `episodeId`, `userId`, `seriesName`, `airdate`.
- **AirdateScheduler**: wait until airdate, then invoke **update-episode-visibility**.
- **update-episode-visibility**: updates item `USER#userId` + `episodeId` with `isVisible = true`, `airdate = airdate`.

No change needed there for the Twilly TV FILE (stream drop) flow.

---

## 6. Checklist to Complete Scheduled/Air

- [ ] Add GSI **ReleaseSchedule** on table **Twilly** (PK=releaseStatus, SK=scheduledDropDate).
- [ ] Deploy Lambda **release-scheduled-drops** from `TwillyTV/twilly/lambda/release-scheduled-drops.js`.
- [ ] Grant it DynamoDB **Query** on index **ReleaseSchedule** + **UpdateItem** on table **Twilly** (no Scan).
- [ ] Create EventBridge rule: schedule every 15 minutes, target **release-scheduled-drops**.
- [ ] (Optional) In the Lambda, after updating a FILE, add that FILE to viewer timelines if your design requires it.
- [ ] Verify: create a scheduled drop with a time 1–2 minutes in the future; after the next Lambda run, the drop should be playable and visible.

After that, the scheduled/air workflow for Twilly TV stream drops is complete end-to-end.
