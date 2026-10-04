# Library backups

Choose ZIP for a complete library including local videos. One export produces one file, and one
import restores it. The former video-count, individual-video, combined-media, archive-size, and
ZIP-entry ceilings have been removed together. Settings remain optional. JSON remains available for
data-only backups that fit its whole-document parsing budget.

Progress covers preparation, media processing, and final saving. Cancel is available until atomic
commit starts. Failure or cancellation preserves the previous library and an existing destination.
Space estimates are advisory: a drive or browser can still refuse a write, and that failure must
follow the same rollback path. Backups above approximately 4 GiB require a destination filesystem
that supports them, such as NTFS or exFAT; FAT32 cannot hold such a file.

## Compatibility and format

The current ZIP writer produces format v4 and ZIP64, using sequential STORE entries without
recompressing images or videos. `backup.json` contains the version, export date, collection counts,
and optional settings. Four UTF-8 newline-delimited JSON entries contain games, characters, combos,
and video descriptors. Embedded images and video bytes have separate binary entries. External
image URLs stay as URLs. Public record IDs appear in the backup; private database payload IDs do not.

Import continues to read v1-v3 backups, including base64 videos. Older app versions cannot read v4;
use the current app to restore new ZIP backups. The data-only JSON writer still emits v1.

The reader validates paths, duplicate files and record IDs, CRCs, declared and actual lengths,
collection counts, schemas, and parent relationships. Only referenced assets are extracted. Skipping
videos validates their descriptors without decompressing their bytes, and clears unavailable local
video references as before. ZIP64 sizes and offsets must be nonnegative safe JavaScript integers.

## Storage, coordination, and recovery

Videos use immutable IndexedDB Blob payloads with small public metadata references. Attachment and
playback retain Blob/File objects without reading the entire video into an ArrayBuffer. Existing
ArrayBuffer videos migrate atomically one at a time when accessed; schema upgrades do not copy the
whole library. Replacement or deletion cannot collect a payload pinned by an export snapshot.

Export captures session-owned records and media pins in one transaction. It then streams the
snapshot outside the transaction. A subset keeps the existing selection closure; its working set
contains IDs and relationships rather than full documents or images.
The export chooser and the library's statistics likewise retain small projected records instead
of loading all notes, covers, or derived tokens just to display names and counts.

Import stages records and session-owned payloads without exposing them to library queries. Once
validation completes, one database transaction publishes records, media references, chosen settings,
notation updates, and committed session state. No ZIP decoding or filesystem I/O runs inside this
transaction. Concurrent library writes serialize through IndexedDB; imports preserve merge behavior.

Web Locks serialize transfers across windows and workers and prevent recovery from cleaning a live
session. Startup and the next transfer clean abandoned sessions, including a worker or window crash.
Without Web Locks, recovery retains sessions with a heartbeat in the previous 24 hours. Cleanup is
idempotent and protects committed references and active export pins. Cleanup failures are diagnostic
errors and cannot turn a successful publication into a reported failed import.

The desktop writer journals its chosen temporary path in the app profile before creating output.
On the next launch it removes only validated, session-named partial files and leaves the destination
intact. A crash after replacement cannot remove the completed backup. Locked partial files retain
their journal for a later cleanup attempt.

## Working-memory safeguards

These are allocation budgets, not aggregate media allowances. The same capabilities constrain the
writer and reader:

| Allocation | Budget / policy |
| --- | --- |
| Stream chunks and acknowledged worker queue | 256 KiB; one outstanding destination write |
| Database batches | 128 records or 8 MiB; one larger valid record can form its own batch |
| Individual UTF-8 record and legacy JSON document | 100 MiB |
| Manifest | 100 MiB, including optional settings inherited from JSON |
| ZIP central-directory allocation | 64 MiB |
| Estimated ZIP entry objects or subset relationship map | 256 MiB |
| Lookup IDs and media filenames | 4,096 characters; MIME type 255 characters |
| Embedded images | Existing 2 MiB per-image validation; no combined image allowance |

The ZIP library reads the central directory before yielding entries. Directory checks therefore
protect both that allocation and estimated per-entry objects; long names and extra fields consume
more budget. The exporter uses fixed short paths. Record guards reject an unusually large record
explicitly instead of dropping it; notes and image data are not truncated. JSON over its budget
directs the user to ZIP. Browser quota and filesystem errors remain authoritative even after a
successful estimate. Native Blob storage can spill to disk but does not imply zero copying or zero
temporary storage.

## Validation

Routine tests cover old formats, current-format validation, settings and selection, streamed UTF-8,
images beyond the old combined metadata allowance, more than 1,000 distinct videos, cancellation,
publication rollback, shared-reference deletion, and snapshot pins.

Build and package the desktop app, then run:

```sh
node scripts/validate-large-backups.mjs "release/win-unpacked/Notation Labs.exe"
```

This separate stress check creates a fresh profile and disk-backed fixture under `.tmp`, then uses
the packaged transfer worker to round-trip a file above 4 GiB and more than 65,535 video entries.
It verifies restored hashes and record counts, tracks interface responsiveness and process memory,
and retains `results.json` and the ZIP for independent archive-tool checks. It deliberately does
not run in routine CI. Allow substantial disk space for the fixture, backup, old library, staged
library, browser temporary data, and restored verification copy. Fixture sizes can be adjusted with
`BACKUP_FIXTURE_VIDEOS` and `BACKUP_FIXTURE_BYTES`; these are test parameters, not product limits.
`BACKUP_EXISTING_ARCHIVE` can point to a prior fixture ZIP for an import-only comparison with the
same fixture parameters, leaving the original archive intact.

Windows validation round-tripped 65,537 distinct videos and combos in a 4,394,025,672-byte ZIP,
including one 4,362,076,160-byte disk-backed payload. Restored SHA-256 hashes matched, staging tables
were empty, and both 7-Zip integrity testing and Windows `tar` read its 65,542 entries. The revised
restore completed in approximately 282 seconds; final publication and cleanup took about 65 seconds.
Peak aggregate private process memory was 1,937,272,832 bytes in this extreme file-count fixture,
down from 3,792,379,904 in the initial implementation. Main-page JavaScript heap stayed below 15 MB
and its 50 ms responsiveness timer continued throughout. This is a measured case, not a promise
that every file count or machine has the same memory needs; archive objects and IndexedDB requests
still have metadata costs independent of streamed media bytes.

Chromium's normal persistent browser profile also exported a single 4.36 GB video through the
actual Blob-download fallback in about 18 seconds with responsive UI. A private-browser profile
refused the same fixture during library storage with `QuotaExceededError`; use regular browser
storage or desktop for such libraries. The successful download demonstrates support on that
Chromium build, not a universal native-memory or quota guarantee for every browser engine.

The supported desktop validation platform here is Windows on NTFS. Physical exFAT/FAT32 devices and
other browser engines require separate device tests; unit tests of write errors cannot establish
their actual storage capacity. Browser builds without a picker use native Blob downloads and share
origin quota with their library. Their capacity must be measured separately from desktop saving.
