"""
Retrieve allowed phone numbers for March Madness product from Statics.
Only read rows where product = "March Madness". No modifications.
"""
import os
import requests
from typing import List

def get_march_madness_allowed_numbers() -> List[str]:
    """
    Returns list of E.164 phone numbers allowed to receive March Madness picks.
    Source: Statics product table / API (product = "March Madness").
    """
    base = os.environ.get("STATICS_BASE_URL", "").rstrip("/")
    api_key = os.environ.get("STATICS_API_KEY", "")
    table_name = os.environ.get("STATICS_TABLE_NAME", "Statics")

    if base and api_key:
        try:
            r = requests.get(
                f"{base}/api/products/march-madness/allowed-numbers",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                timeout=15,
            )
            r.raise_for_status()
            data = r.json()
            numbers = data.get("numbers", data.get("phone_numbers", []))
            return [n.strip() for n in numbers if n and isinstance(n, str)]
        except requests.RequestException:
            pass

    # Fallback: read from DynamoDB if table name and AWS credentials available
    try:
        import boto3
        dynamo = boto3.client("dynamodb", region_name=os.environ.get("AWS_REGION", "us-east-1"))
        # Assume table has partition key and GSI or attribute product
        resp = dynamo.scan(
            TableName=table_name,
            FilterExpression="product = :p",
            ExpressionAttributeValues={":p": {"S": "March Madness"}},
        )
        numbers = []
        for item in resp.get("Items", []):
            phone = item.get("phone_number", item.get("phoneNumber", {}).get("S", ""))
            if phone:
                numbers.append(phone)
        return numbers
    except Exception:
        pass

    return []
