import json, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../lambdas/ingest"))
from handler import lambda_handler

def test_ingest_valid():
    r = lambda_handler({"body": '{"user_id": "u1"}'}, {})
    assert r["statusCode"] == 200

def test_ingest_empty():
    r = lambda_handler({"body": ""}, {})
    assert r["statusCode"] == 200
