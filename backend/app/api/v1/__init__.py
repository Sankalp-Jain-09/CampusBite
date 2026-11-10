from fastapi import APIRouter

from app.api.v1 import ai, auth, delivery, health, orders, owner, restaurants

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(restaurants.router)
api_router.include_router(orders.router)
api_router.include_router(owner.router)
api_router.include_router(delivery.router)
api_router.include_router(ai.router)
