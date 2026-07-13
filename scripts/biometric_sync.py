#!/usr/bin/env python3
"""
biometric_sync.py — EF Architects & Engineers Consulting
=========================================================
Local background daemon that polls a ZKTeco fingerprint device on the
office LAN, groups attendance punches by date, and forwards them to the
remote Supabase gateway via an authorised HTTPS POST request.

Requirements
------------
    pip install zk requests python-dotenv

Run once manually:
    python scripts/biometric_sync.py

Run as a scheduled background daemon (Linux/macOS cron, every 5 min):
    */5 * * * * /usr/bin/python3 /opt/efae/scripts/biometric_sync.py >> /var/log/biometric_sync.log 2>&1

Run as a Windows Scheduled Task:
    Action: python.exe  "C:\efae\scripts\biometric_sync.py"
    Trigger: every 5 minutes, indefinitely

Environment Variables (place in scripts/.env or export in shell)
----------------------------------------------------------------
BIOMETRIC_MACHINE_IP      IP address of the ZKTeco device on the LAN
BIOMETRIC_MACHINE_PORT    TCP port (default: 4370)
BIOMETRIC_MACHINE_PASSWORD Device password (default: empty string)
SYNC_GATEWAY_URL          Full HTTPS URL of the Next.js attendance-sync route
                          e.g. https://efae.vercel.app/api/registrar/attendance-sync
INTERNAL_SYNC_TOKEN       Shared secret that the gateway validates via X-Biometric-Sync-Token
SYNC_TIMEZONE             IANA timezone for date bucketing (default: Africa/Addis_Ababa)
SYNC_LOOKBACK_DAYS        How many past days to pull from device memory (default: 2)
"""

from __future__ import annotations

import json
import logging
import os
import sys
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

# ── Optional .env loader (gracefully skipped if python-dotenv not installed) ──
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env")
except ImportError:
    pass

# ── Third-party: ZKTeco SDK ───────────────────────────────────────────────────
try:
    from zk import ZK, const as ZK_CONST
except ImportError:
    print(
        "[biometric_sync] ERROR: 'zk' package not installed.\n"
        "  Run: pip install zk\n"
        "  Documentation: https://pypi.org/project/zk/",
        file=sys.stderr,
    )
    sys.exit(1)

# ── Third-party: HTTP client ──────────────────────────────────────────────────
try:
    import requests
except ImportError:
    print(
        "[biometric_sync] ERROR: 'requests' package not installed.\n"
        "  Run: pip install requests",
        file=sys.stderr,
    )
    sys.exit(1)

# ── Optional: zoneinfo (stdlib ≥ 3.9) or pytz fallback ──────────────────────
try:
    from zoneinfo import ZoneInfo
except ImportError:
    try:
        from pytz import timezone as ZoneInfo  # type: ignore[assignment]
    except ImportError:
        ZoneInfo = None  # type: ignore[assignment,misc]

# ─────────────────────────────────────────────────────────────────────────────
# Logging setup
# ─────────────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  [%(levelname)s]  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("biometric_sync")

# ─────────────────────────────────────────────────────────────────────────────
# Configuration — read from environment with safe fallbacks
# ─────────────────────────────────────────────────────────────────────────────
MACHINE_IP       = os.environ.get("BIOMETRIC_MACHINE_IP", "").strip()
MACHINE_PORT     = int(os.environ.get("BIOMETRIC_MACHINE_PORT", "4370"))
MACHINE_PASSWORD = int(os.environ.get("BIOMETRIC_MACHINE_PASSWORD", "0") or "0")
GATEWAY_URL      = os.environ.get("SYNC_GATEWAY_URL", "").strip()
SYNC_TOKEN       = os.environ.get("INTERNAL_SYNC_TOKEN", "").strip()
TZ_NAME          = os.environ.get("SYNC_TIMEZONE", "Africa/Addis_Ababa")
LOOKBACK_DAYS    = int(os.environ.get("SYNC_LOOKBACK_DAYS", "2"))

# ZKTeco punch-type constants
PUNCH_ENTRANCE = 0   # check-in  (office_entrance)
PUNCH_LEAVE    = 1   # check-out (office_leave)

# HTTP request timeout (seconds)
HTTP_TIMEOUT = 30

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _validate_config() -> None:
    """Abort early with a clear message if required env vars are missing."""
    missing = []
    if not MACHINE_IP:
        missing.append("BIOMETRIC_MACHINE_IP")
    if not GATEWAY_URL:
        missing.append("SYNC_GATEWAY_URL")
    if not SYNC_TOKEN:
        missing.append("INTERNAL_SYNC_TOKEN")
    if missing:
        log.error(
            "Missing required environment variables: %s\n"
            "Set them in scripts/.env or export them in the shell.",
            ", ".join(missing),
        )
        sys.exit(1)


def _localise_dt(dt: datetime) -> datetime:
    """
    Convert a naive datetime (as returned by the ZK SDK) to a timezone-aware
    datetime in the configured office timezone, then re-express it as UTC.
    Falls back to treating the naive datetime as UTC if ZoneInfo is unavailable.
    """
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc)

    if ZoneInfo is not None:
        try:
            local_tz = ZoneInfo(TZ_NAME)
            aware = dt.replace(tzinfo=local_tz)  # type: ignore[call-arg]
            return aware.astimezone(timezone.utc)
        except Exception:
            pass

    # Safe fallback — assume device clock is already in UTC
    return dt.replace(tzinfo=timezone.utc)


def _date_key(dt_utc: datetime) -> str:
    """Return 'YYYY-MM-DD' bucketed in the office timezone."""
    if ZoneInfo is not None:
        try:
            local_tz = ZoneInfo(TZ_NAME)
            local_dt = dt_utc.astimezone(local_tz)  # type: ignore[arg-type]
            return local_dt.strftime("%Y-%m-%d")
        except Exception:
            pass
    return dt_utc.strftime("%Y-%m-%d")


def _is_within_lookback(dt_utc: datetime) -> bool:
    """Only sync punches within the configured lookback window."""
    cutoff = datetime.now(tz=timezone.utc) - timedelta(days=LOOKBACK_DAYS)
    return dt_utc >= cutoff


# ─────────────────────────────────────────────────────────────────────────────
# Step 1 — Pull raw attendance log from the ZKTeco device
# ─────────────────────────────────────────────────────────────────────────────

def fetch_device_logs() -> list[dict[str, Any]]:
    """
    Connect to the fingerprint machine over TCP and download the full
    attendance log array.  Each entry contains:
        user_id    — the UserBiometricID enrolled on the device (string)
        timestamp  — punch datetime (naive, in device-local time)
        punch      — int  0 = check-in, 1 = check-out (other values ignored)
    Returns a flat list of normalised dicts.
    """
    log.info("Connecting to ZKTeco device at %s:%d …", MACHINE_IP, MACHINE_PORT)

    zk = ZK(
        MACHINE_IP,
        port=MACHINE_PORT,
        timeout=10,
        password=MACHINE_PASSWORD,
        force_udp=False,
        ommit_ping=False,
    )
    conn = None
    raw_records: list[dict[str, Any]] = []

    try:
        conn = zk.connect()
        conn.disable_device()          # pause live punches during download
        attendances = conn.get_attendance()
        log.info("Retrieved %d raw attendance records from device.", len(attendances))

        for att in attendances:
            # ZK SDK AttendanceRecord: att.user_id, att.timestamp, att.punch, att.status
            dt_utc = _localise_dt(att.timestamp)
            if not _is_within_lookback(dt_utc):
                continue

            punch_type = int(att.punch)
            if punch_type not in (PUNCH_ENTRANCE, PUNCH_LEAVE):
                # Ignore overtime / break punch codes
                continue

            raw_records.append({
                "device_id":  str(att.user_id).strip(),
                "timestamp":  dt_utc.isoformat(),
                "punch_type": punch_type,
                "date_key":   _date_key(dt_utc),
            })

    except Exception as exc:
        log.error("Failed to communicate with ZKTeco device: %s", exc)
        raise
    finally:
        if conn:
            try:
                conn.enable_device()
                conn.disconnect()
            except Exception:
                pass

    log.info(
        "Filtered to %d punches within the last %d day(s).",
        len(raw_records),
        LOOKBACK_DAYS,
    )
    return raw_records


# ─────────────────────────────────────────────────────────────────────────────
# Step 2 — Group and consolidate punches by (device_id, date)
# ─────────────────────────────────────────────────────────────────────────────

def group_punches(
    raw: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """
    For each (device_id, date) pair, keep only the earliest entrance punch
    and the latest leave punch.  Multiple check-ins or check-outs on the same
    day are collapsed to min/max — this matches how the daily_work_logs table
    stores a single row per employee per day.

    Output shape per entry:
        {
            "biometric_device_id": "42",
            "log_date":            "2026-07-11",
            "office_entrance":     "2026-07-11T06:02:00+00:00",  # or null
            "office_leave":        "2026-07-11T15:47:00+00:00",  # or null
        }
    """
    # Bucket structure: { (device_id, date_key) -> {"in": min_ts, "out": max_ts} }
    buckets: dict[tuple[str, str], dict[str, str | None]] = defaultdict(
        lambda: {"in": None, "out": None}
    )

    for rec in raw:
        key = (rec["device_id"], rec["date_key"])
        ts  = rec["timestamp"]

        if rec["punch_type"] == PUNCH_ENTRANCE:
            prev = buckets[key]["in"]
            buckets[key]["in"] = ts if prev is None else min(prev, ts)
        else:
            prev = buckets[key]["out"]
            buckets[key]["out"] = ts if prev is None else max(prev, ts)

    grouped = []
    for (device_id, log_date), times in buckets.items():
        grouped.append({
            "biometric_device_id": device_id,
            "log_date":            log_date,
            "office_entrance":     times["in"],
            "office_leave":        times["out"],
        })

    log.info(
        "Grouped into %d unique (device_id, date) attendance records.",
        len(grouped),
    )
    return grouped


# ─────────────────────────────────────────────────────────────────────────────
# Step 3 — POST payload to the Next.js gateway
# ─────────────────────────────────────────────────────────────────────────────

def post_to_gateway(payload: list[dict[str, Any]]) -> None:
    """
    Send the grouped attendance array to the Next.js attendance-sync route.
    The gateway validates the X-Biometric-Sync-Token header and then performs
    upsert operations against the Supabase daily_work_logs table.
    """
    if not payload:
        log.info("No records to sync — nothing to POST.")
        return

    headers = {
        "Content-Type":          "application/json",
        "X-Biometric-Sync-Token": SYNC_TOKEN,
    }

    log.info("POSTing %d attendance records to gateway: %s", len(payload), GATEWAY_URL)

    try:
        response = requests.post(
            GATEWAY_URL,
            headers=headers,
            data=json.dumps(payload),
            timeout=HTTP_TIMEOUT,
            verify=True,           # always verify TLS certificates in production
        )
        response.raise_for_status()
        result = response.json()

        synced    = result.get("synced",    0)
        unmapped  = result.get("unmapped",  0)
        errors    = result.get("errors",    0)
        log.info(
            "Gateway response — synced: %d | unmapped device IDs: %d | row errors: %d",
            synced, unmapped, errors,
        )

        if unmapped > 0:
            log.warning(
                "%d punch(es) could not be mapped to an employee. "
                "Review the 'unmapped_device_logs' table in Supabase.",
                unmapped,
            )
        if errors > 0:
            log.error(
                "%d row(s) failed during upsert. Check the gateway logs for details.",
                errors,
            )

    except requests.exceptions.SSLError as exc:
        log.error("TLS/SSL error connecting to gateway: %s", exc)
        raise
    except requests.exceptions.ConnectionError as exc:
        log.error("Network error connecting to gateway: %s", exc)
        raise
    except requests.exceptions.Timeout:
        log.error("Gateway request timed out after %ds.", HTTP_TIMEOUT)
        raise
    except requests.exceptions.HTTPError as exc:
        status = exc.response.status_code if exc.response is not None else "?"
        body   = exc.response.text[:400] if exc.response is not None else ""
        log.error("Gateway returned HTTP %s: %s", status, body)
        raise


# ─────────────────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────────────────

def main() -> None:
    log.info("══════════════════════════════════════════════")
    log.info("  EF Biometric Sync — starting run")
    log.info("  Timezone  : %s", TZ_NAME)
    log.info("  Lookback  : %d day(s)", LOOKBACK_DAYS)
    log.info("  Machine   : %s:%d", MACHINE_IP, MACHINE_PORT)
    log.info("══════════════════════════════════════════════")

    _validate_config()

    # 1. Pull raw logs from the device
    raw_logs = fetch_device_logs()

    if not raw_logs:
        log.info("No attendance punches found in the lookback window. Exiting.")
        return

    # 2. Group punches into one record per (device_id, date)
    grouped = group_punches(raw_logs)

    # 3. Push to the Next.js gateway
    post_to_gateway(grouped)

    log.info("Sync run complete.")


if __name__ == "__main__":
    main()
