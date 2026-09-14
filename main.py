import os
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
import httpx
import uvicorn

app = FastAPI(title="UAV Radar")

NEPTUN_API_URL = "https://neptun.in.ua/api/v1/threats"

@app.get("/")
async def read_index():
    if not os.path.exists("index.html"):
        raise HTTPException(
            status_code=404,
            detail="Файл index.html не найден в рабочей папке!",
        )
    return FileResponse("index.html")

@app.get("/api/uavs")
async def get_uavs():
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(NEPTUN_API_URL, timeout=10.0)
            response.raise_for_status()
            data = response.json()

            print("ОТВЕТ ОТ API:", data)

            raw_items = []
            if isinstance(data, dict):
                raw_items = (
                    data.get("threats")
                    or data.get("data")
                    or data.get("items")
                    or []
                )
            elif isinstance(data, list):
                raw_items = data

            parsed_uavs = []
            for item in raw_items:
                if not isinstance(item, dict):
                    continue

                lat = (
                    item.get("latitude")
                    or item.get("lat")
                    or item.get("y")
                    or (
                        item.get("location", {}).get("lat")
                        if isinstance(item.get("location"), dict)
                        else None
                    )
                )

                lon = (
                    item.get("longitude")
                    or item.get("lon")
                    or item.get("lng")
                    or item.get("x")
                    or (
                        item.get("location", {}).get("lon")
                        if isinstance(item.get("location"), dict)
                        else None
                    )
                )

                if lat is not None and lon is not None:
                    parsed_uavs.append(
                        {
                            "id": item.get("id")
                            or item.get("uuid")
                            or f"id_{len(parsed_uavs)}",
                            "latitude": float(lat),
                            "longitude": float(lon),
                            "heading": float(
                                item.get("heading")
                                or item.get("direction")
                                or item.get("course")
                                or 0
                            ),
                            "type": item.get("type")
                            or item.get("name")
                            or "Цель",
                        }
                    )

            return {
                "status": "success",
                "count": len(parsed_uavs),
                "data": parsed_uavs,
            }

        except Exception as exc:
            print("Ошибка запроса к API:", exc)
            return {"status": "error", "count": 0, "data": []}

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)