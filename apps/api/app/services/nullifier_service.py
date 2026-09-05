import re
import time
from typing import Set, Dict, Optional, Tuple, List

class NullifierRecord:
    def __init__(self, stance: str, registered_at: float):
        self.stance = stance
        self.last_stance_time = registered_at
        self.last_note_time = registered_at
        self.note_count = 1

class NullifierRegistry:
    def __init__(self):
        # Maps "issue_id:nullifier_hash" -> NullifierRecord
        self._records: Dict[str, NullifierRecord] = {}
        # IP sliding window: ip -> list of timestamps
        self._ip_history: Dict[str, List[float]] = {}
        # Issue sliding window: issue_id -> list of timestamps
        self._issue_history: Dict[str, List[float]] = {}

    def is_registered(self, issue_id: str, nullifier_hash: str) -> bool:
        key = f"{issue_id}:{nullifier_hash}"
        return key in self._records

    def register(self, issue_id: str, nullifier_hash: str, timestamp: int, max_skew_sec: int = 120) -> bool:
        if not re.match(r"^[a-fA-F0-9]{64}$", nullifier_hash):
            raise ValueError("Invalid nullifier format: must be 64-character hex string")

        current_time_ms = int(time.time() * 1000)
        if abs(current_time_ms - timestamp) > (max_skew_sec * 1000):
            raise ValueError("Timestamp expired or outside acceptable replay window")

        key = f"{issue_id}:{nullifier_hash}"
        if key in self._records:
            return False

        self._records[key] = NullifierRecord("CONFIRM", time.time())
        return True

    def check_action_rate_limit(self, ip: str, action: str, max_per_minute: int) -> bool:
        """
        Tiered sliding-window rate limit per IP per action type.
        """
        now = time.time()
        key = f"{action}:{ip}"
        history = self._ip_history.get(key, [])
        history = [t for t in history if now - t < 60]
        if len(history) >= max_per_minute:
            return False
        history.append(now)
        self._ip_history[key] = history
        return True

    def check_ip_rate_limit(self, ip: str, max_per_minute: int = 30) -> bool:
        return self.check_action_rate_limit(ip, "NOTE", max_per_minute)

    def get_stance(self, issue_id: str, nullifier_hash: str) -> Optional[str]:
        key = f"{issue_id}:{nullifier_hash}"
        rec = self._records.get(key)
        return rec.stance if rec else None

    def can_update_stance(self, issue_id: str, nullifier_hash: str, new_stance: str, cooldown_seconds: int = 900) -> Tuple[bool, int]:
        """
        Checks if a participant can change their stance under the 15-minute cooldown (ADR 0014).
        Returns: (allowed: bool, remaining_cooldown_seconds: int)
        """
        key = f"{issue_id}:{nullifier_hash}"
        rec = self._records.get(key)
        if not rec:
            return True, 0
        if rec.stance == new_stance:
            return True, 0  # Stance unchanged
        now = time.time()
        elapsed = now - rec.last_stance_time
        if elapsed < cooldown_seconds:
            return False, int(cooldown_seconds - elapsed)
        return True, 0

    def record_action(self, issue_id: str, nullifier_hash: str, stance: str) -> Optional[str]:
        """
        Records or updates a stance.
        Returns the previous stance if a stance flip occurred, or None if first time / unchanged.
        """
        key = f"{issue_id}:{nullifier_hash}"
        now = time.time()
        rec = self._records.get(key)
        if not rec:
            self._records[key] = NullifierRecord(stance, now)
            return None

        old_stance = rec.stance
        rec.note_count += 1
        rec.last_note_time = now
        if stance and stance != "NEUTRAL" and stance != rec.stance:
            rec.stance = stance
            rec.last_stance_time = now
            return old_stance
        return None

    def clear(self):
        self._records.clear()
        self._ip_history.clear()
        self._issue_history.clear()

global_nullifier_registry = NullifierRegistry()
