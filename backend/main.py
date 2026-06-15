from contextlib import asynccontextmanager
from fastapi import FastAPI
import asyncio

# Middleware
from fastapi.middleware.cors import CORSMiddleware

# Routes
from routes.telemetry import router as telemetry_router
from routes.auth import router as auth_router
from routes.user import router as user_router
from routes.devices import router as devices_router

# mqtt handlers
from mqtt.handlers import fast_mqtt, register_mqtt_handlers, start_staleness_sweep

# Database
from db.session import create_db_and_tables


@asynccontextmanager
async def _lifespan(_app: FastAPI):
    """
    Lifecycle manager for the FastAPI application.
    """
    create_db_and_tables()
    register_mqtt_handlers()
    asyncio.create_task(start_staleness_sweep())
    await fast_mqtt.mqtt_startup()
    yield
    await fast_mqtt.mqtt_shutdown()


app = FastAPI(
    title="SmartPlug API",
    description="API for managing smart plugs and retrieving telemetry data",
    version="1.0.0",
    lifespan=_lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

URL_PREFIX = "/api/v1"
app.include_router(telemetry_router, prefix=URL_PREFIX)
app.include_router(auth_router, prefix=URL_PREFIX)
app.include_router(user_router, prefix=URL_PREFIX)
app.include_router(devices_router, prefix=URL_PREFIX)

@app.get(URL_PREFIX + "/ping")
def ping():
    """Endpoint to check if the server is running"""
    return {"message": "pong"}
