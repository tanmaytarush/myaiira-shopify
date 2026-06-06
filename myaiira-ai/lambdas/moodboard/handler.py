import json
import asyncio
import logging
from typing import Any

logger = logging.getLogger(__name__)

def lambda_handler(event: dict, context: Any) -> dict:
    try:
        body = json.loads(event.get("body") or "{}")
        result = asyncio.run(_process(body))
        return {"statusCode": 200, "body": json.dumps(result)}
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"statusCode": 500, "body": json.dumps({"error": str(e)})}

async def _process(payload: dict) -> dict:
    return {"status": "ok", "payload": payload}
