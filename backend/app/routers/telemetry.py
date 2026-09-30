"""
GreenRoute - Real-Time WebSocket Telemetry Hub
Manages live streaming of IoT sensor fill rates, battery voltage, truck GPS updates,
and critical overflow broadcast alerts.
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from typing import List, Dict, Any
import json
import asyncio
import random
from datetime import datetime

router = APIRouter(
    tags=["Real-Time IoT Telemetry"]
)

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, data: Dict[str, Any]):
        message = json.dumps(data)
        dead_connections = []
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                dead_connections.append(connection)
        for dead in dead_connections:
            self.disconnect(dead)

manager = ConnectionManager()

@router.websocket("/ws/telemetry")
async def websocket_telemetry_endpoint(websocket: WebSocket):
    """
    Bidirectional WebSocket connection for live smart bin IoT sensor readings,
    battery voltages, collection vehicle GPS coordinates, and real-time overflow alerts.
    """
    await manager.connect(websocket)
    try:
        # Send initial handshake packet
        await websocket.send_text(json.dumps({
            "type": "CONNECTION_ESTABLISHED",
            "timestamp": datetime.now().isoformat(),
            "status": "online",
            "active_clients": len(manager.active_connections),
            "message": "Connected to GreenRoute Real-Time IoT Telemetry Hub"
        }))

        # Keep listening for pings or client triggers
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                # Handle client ping
                if msg.get("action") == "ping":
                    await websocket.send_text(json.dumps({
                        "type": "PONG",
                        "timestamp": datetime.now().isoformat()
                    }))
            except Exception:
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)

from pydantic import BaseModel

class TelemetryBroadcastRequest(BaseModel):
    event_type: Optional[str] = "SENSOR_UPDATE"
    payload: Optional[Dict[str, Any]] = None

@router.post("/telemetry/broadcast")
async def trigger_telemetry_broadcast(req: Optional[TelemetryBroadcastRequest] = None):
    """
    REST endpoint to broadcast simulated or real IoT telemetry events to all
    connected WebSocket clients (Admins, Drivers, and Dispatchers).
    """
    event_type = req.event_type if req and req.event_type else "SENSOR_UPDATE"
    payload = req.payload if req and req.payload else {
        "bin_id": 1,
        "tenant_id": "sou",
        "fill_level": 94,
        "battery_voltage": 3.92,
        "signal_rssi": -68,
        "status": "CRITICAL_OVERFLOW"
    }

    packet = {
        "type": event_type,
        "timestamp": datetime.now().isoformat(),
        "payload": payload
    }
    await manager.broadcast(packet)
    return {"status": "broadcast_sent", "active_clients": len(manager.active_connections), "packet": packet}

