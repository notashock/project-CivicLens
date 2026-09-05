import abc
import asyncio
from typing import List, Optional, Dict, Any, AsyncIterator
from apps.api.app.models import Issue, VerificationRequest

class EventBroadcaster:
    """
    In-memory async broadcast hub for real-time pub/sub across connected WebSockets and SSE streams.
    """
    def __init__(self):
        self._subscribers: List[asyncio.Queue] = []

    def subscribe(self) -> asyncio.Queue:
        queue = asyncio.Queue(maxsize=100)
        self._subscribers.append(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue):
        if queue in self._subscribers:
            self._subscribers.remove(queue)

    async def broadcast(self, event_type: str, data: Dict[str, Any]):
        message = {"event_type": event_type, "data": data}
        dead_queues = []
        for q in self._subscribers:
            try:
                q.put_nowait(message)
            except asyncio.QueueFull:
                dead_queues.append(q)
            except Exception:
                dead_queues.append(q)
        for dq in dead_queues:
            self.unsubscribe(dq)

global_event_broadcaster = EventBroadcaster()

class DatabaseAdapter(abc.ABC):
    """
    SEAM: Deep Database Adapter Interface.
    Presents a clean, compact surface to callers while encapsulating storage,
    spatial indexing, and real-time replication behind the implementation.
    """

    @abc.abstractmethod
    async def get_by_id(self, issue_id: str) -> Optional[Issue]:
        """Fetch an issue by its primary ID."""
        pass

    @abc.abstractmethod
    async def get_all(
        self,
        category: Optional[Any] = None,
        status: Optional[Any] = None,
        min_lat: Optional[float] = None,
        max_lat: Optional[float] = None,
        min_lon: Optional[float] = None,
        max_lon: Optional[float] = None,
    ) -> List[Issue]:
        """List active issues with optional category and status filtering."""
        pass

    @abc.abstractmethod
    async def save(self, issue: Issue) -> Issue:
        """Persist a newly reported or updated civic issue."""
        pass

    @abc.abstractmethod
    async def seed_initial_data(self):
        """Seed initial demo issues."""
        pass

    @abc.abstractmethod
    async def get_community_notes(self, issue_id: str) -> List[Dict[str, Any]]:
        """Fetch all community notes for an issue."""
        pass

    @abc.abstractmethod
    async def save_community_note(self, note: Dict[str, Any]) -> Dict[str, Any]:
        """Persist a new community note."""
        pass
