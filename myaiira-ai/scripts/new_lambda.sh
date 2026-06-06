#!/bin/bash
set -e
NAME=$1
if [ -z "$NAME" ]; then echo "Usage: ./scripts/new_lambda.sh <name>"; exit 1; fi
DIR="lambdas/$NAME"
if [ -d "$DIR" ]; then echo "Error: '$NAME' already exists"; exit 1; fi
mkdir -p "$DIR/events"

cat > "$DIR/handler.py" << PYTHON
import json, asyncio, logging
from typing import Any
logger = logging.getLogger(__name__)

def lambda_handler(event: dict, context: Any) -> dict:
    try:
        body = json.loads(event.get("body", "{}"))
        return {"statusCode": 200, "body": json.dumps(asyncio.run(_process(body)))}
    except Exception as e:
        logger.error(f"Error in $NAME: {e}", exc_info=True)
        return {"statusCode": 500, "body": json.dumps({"error": str(e)})}

async def _process(payload: dict) -> dict:
    # TODO: implement
    return {"status": "ok", "lambda": "$NAME"}
PYTHON

echo '# lambda-specific deps' > "$DIR/requirements.txt"
echo '{"body": "{}", "httpMethod": "POST"}' > "$DIR/events/sample.json"

echo "✅ Created $DIR"
echo "Next: implement handler.py → add to template.yaml → write tests/unit/test_${NAME//-/_}.py"
