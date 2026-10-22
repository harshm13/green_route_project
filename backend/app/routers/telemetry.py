"""
GreenRoute - Real-Time WebSocket Telemetry Hub
Manages live streaming of IoT sensor fill rates, battery voltage, truck GPS updates,
and critical overflow broadcast alerts.
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Depends, Query, status
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import json
from datetime import datetime
from ..auth_utils import decode_access_token, require_role
from .. import models

router = APIRouter(
    tags=["Real-Time IoT Telemetry"]
)

class ConnectionManager:
    def __init__(self):
        # Map tenant_id -> list of active WebSockets
        self.tenant_connections: Dict[str, List[WebSocket]] = {}
        self.global_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket, tenant_id: str, is_head_admin: bool = False):
        await websocket.accept()
        if is_head_admin:
            self.global_connections.append(websocket)
        else:
            if tenant_id not in self.tenant_connections:
                self.tenant_connections[tenant_id] = []
            self.tenant_connections[tenant_id].append(websocket)

    def disconnect(self, websocket: WebSocket, tenant_id: str):
        if websocket in self.global_connections:
            self.global_connections.remove(websocket)
        if tenant_id in self.tenant_connections and websocket in self.tenant_connections[tenant_id]:
            self.tenant_connections[tenant_id].remove(websocket)

    async def broadcast_to_tenant(self, tenant_id: str, data: Dict[str, Any]) -> int:
        """Broadcasts event strictly to subscribers within tenant boundary and authorized head admins."""
        message = json.dumps(data)
        recipients = list(self.tenant_connections.get(tenant_id, [])) + list(self.global_connections)
        dead_connections = []
        sent_count = 0
        for connection in recipients:
            try:
                await connection.send_text(message)
                sent_count += 1
            except Exception:
                dead_connections.append(connection)

        for dead in dead_connections:
            self.disconnect(dead, tenant_id)
        return sent_count

    def get_tenant_active_count(self, tenant_id: str) -> int:
        return len(self.tenant_connections.get(tenant_id, [])) + len(self.global_connections)

manager = ConnectionManager()

@router.websocket("/ws/telemetry")
async def websocket_telemetry_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None, description="Bearer JWT token for subscriber authentication")
):
    """
    Authenticated WebSocket connection for live smart bin IoT sensor readings,
    battery voltages, and real-time overflow alerts. Isolated strictly by tenant.
    """
    # Authenticate subscriber
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Authentication token required")
        return

    payload = decode_access_token(token)
    if not payload:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid or expired token")
        return

    user_tenant = payload.get("tenant_id", "sou")
    user_role = payload.get("role", "citizen")
    is_head_admin = (user_role == "head_admin")

    await manager.connect(websocket, tenant_id=user_tenant, is_head_admin=is_head_admin)
    try:
        # Send initial handshake packet
        await websocket.send_text(json.dumps({
            "type": "CONNECTION_ESTABLISHED",
            "timestamp": datetime.now().isoformat(),
            "status": "online",
            "tenant_id": user_tenant,
            "active_clients": manager.get_tenant_active_count(user_tenant),
            "message": f"Connected to GreenRoute IoT Telemetry Hub (Tenant: {user_tenant})"
        }))

        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("action") == "ping":
                    await websocket.send_text(json.dumps({
                        "type": "PONG",
                        "timestamp": datetime.now().isoformat()
                    }))
            except Exception:
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_tenant)
    except Exception:
        manager.disconnect(websocket, user_tenant)

# --- PYDANTIC VALIDATION SCHEMAS ---
ALLOWED_EVENT_TYPES = {"SENSOR_UPDATE", "TRUCK_LOCATION", "BIN_ALERT", "CRITICAL_OVERFLOW", "COLLECTION_COMPLETED"}

class TelemetryPayload(BaseModel):
    bin_id: int
    tenant_id: str
    fill_level: int = Field(..., ge=0, le=100)
    battery_voltage: Optional[float] = 3.9
    signal_rssi: Optional[int] = -65
    status: Optional[str] = "NORMAL"

class TelemetryBroadcastRequest(BaseModel):
    event_type: str = "SENSOR_UPDATE"
    payload: TelemetryPayload

@router.post("/telemetry/broadcast")
async def trigger_telemetry_broadcast(
    req: TelemetryBroadcastRequest,
    current_user: models.User = Depends(require_role(["admin", "head_admin", "driver"]))
):
    """
    REST endpoint to broadcast verified IoT telemetry events.
    Enforces publisher authentication, schema validation, and tenant isolation.
    """
    if req.event_type not in ALLOWED_EVENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid event_type '{req.event_type}'. Allowed types: {list(ALLOWED_EVENT_TYPES)}"
        )

    # Enforce tenant isolation for publishers: only head_admin can broadcast across tenants
    if current_user.role != "head_admin" and current_user.tenant_id != req.payload.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Tenant boundary violation: Cannot broadcast telemetry for tenant '{req.payload.tenant_id}'."
        )

    packet = {
        "type": req.event_type,
        "timestamp": datetime.now().isoformat(),
        "payload": req.payload.model_dump(),
        "publisher": {
            "id": current_user.id,
            "role": current_user.role
        }
    }

    active_recipients = await manager.broadcast_to_tenant(req.payload.tenant_id, packet)

    return {
        "status": "broadcast_sent",
        "tenant_id": req.payload.tenant_id,
        "active_clients": active_recipients,
        "packet": packet
    }

