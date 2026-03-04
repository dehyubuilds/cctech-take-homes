# THE ACTUAL BUG - Found It!

## The Problem

The Lambda code has **TWO SEPARATE CHECKS** for `isPrivateUsername`:

1. **First check (lines 1053-1074)**: Detects if existing item has `isPrivateUsername` and sets `hasExistingIsPrivate`
2. **Second check (lines 1112-1127)**: Uses `hasExistingIsPrivate` to decide whether to preserve it in UpdateExpression

## The Bug

**Line 1112 uses `hasExistingIsPrivate` which was set in the FIRST check (line 1054-1074).**

But there's a critical issue: **If the format detection in the first check FAILS** (can't parse the DynamoDB format), then:
- `hasExistingIsPrivate` stays `false`
- The code at line 1112 thinks the field doesn't exist
- It tries to add it from streamKey mapping (line 1118)
- **BUT** - if `item.isPrivateUsername` is already set from the first check (line 864), it will OVERWRITE the existing value!

Wait, actually looking more carefully:

Line 864: `item.isPrivateUsername = { BOOL: existingIsPrivate };` - This sets it in the `item` object
Line 1112: Checks `hasExistingIsPrivate` - if true, preserves it (doesn't add to updateExpressions)
Line 1118: If `hasExistingIsPrivate` is false, adds it to updateExpressions

So the logic SHOULD work... unless...

## THE REAL BUG

**DocumentClient saves booleans as plain booleans, but when Lambda reads with low-level client, it might return them in a DIFFERENT format than expected.**

The check at line 1059 looks for `rawValue.BOOL`, but DocumentClient might save it as a plain boolean, and when read with low-level client, it might be in a different format.

Actually wait - DocumentClient uses the DocumentClient API which automatically converts. But when we READ with low-level client (GetItemCommand), it returns DynamoDB format `{ BOOL: true }`.

So the check SHOULD work... unless the field is MISSING entirely from the existing item.

## THE ACTUAL ISSUE

**`createVideoEntryImmediately` might not be setting `isPrivateUsername` at all if it can't read it from the streamKey mapping!**

If `createVideoEntryImmediately` fails to read `isPrivateUsername` (because `setStreamUsernameType` hasn't completed yet), then:
- The video entry is created WITHOUT `isPrivateUsername`
- Lambda checks for it - doesn't find it
- Lambda tries to read from streamKey mapping - but if that also fails, defaults to PUBLIC

## The Root Cause

**RACE CONDITION**: `setStreamUsernameType` is called, but `createVideoEntryImmediately` might run BEFORE it completes writing to DynamoDB, even with ConsistentRead and retries.
