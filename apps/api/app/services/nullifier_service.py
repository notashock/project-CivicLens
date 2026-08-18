import re
import time
from typing import Set, Dict

class NullifierRegistry:
    def __init__(self):
        # Maps "issue_id:nullifier_hash" -> timestamp
        self._registry: Dict[str, float] = {}

    def is_registered(self, issue_id: str, nullifier_hash: str) -> bool:
        key = f"{issue_id}:{nullifier_hash}"
        return key in self._registry

    def register(self, issue_id: str, nullifier_hash: str, timestamp: int, max_skew_sec: int = 120) -> bool:
        # Validate hash format (64-character hex)
        if not re.match(r"^[a-fA-F0-9]{64}$", nullifier_hash):
            raise ValueError("Invalid nullifier format: must be 64-character hex string")

        # Validate replay window
        current_time_ms = int(time.time() * 1000)
        if abs(current_time_ms - timestamp) > (max_skew_sec * 1000):
            raise ValueError("Timestamp expired or outside acceptable replay window")

        key = f"{issue_id}:{nullifier_hash}"
        if key in self._registry:
            return False  # Already registered (duplicate action)

        self._registry[key] = time.time()
        return True

    def clear(self):
        self._registry.clear()

global_nullifier_registry = NullifierRegistry()
