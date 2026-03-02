from __future__ import annotations

import io
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse, urlunparse

import boto3
from botocore.client import BaseClient
from botocore.exceptions import ClientError

from app.config import settings


def get_s3_client() -> BaseClient:
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url,
        region_name=settings.s3_region_name,
        aws_access_key_id=settings.s3_access_key_id,
        aws_secret_access_key=settings.s3_secret_access_key,
        use_ssl=settings.s3_secure,
    )


def ensure_buckets(client: BaseClient) -> None:
    for bucket in [settings.s3_bucket_previews, settings.s3_bucket_artifacts]:
        try:
            client.head_bucket(Bucket=bucket)
        except ClientError:
            client.create_bucket(Bucket=bucket)


def configure_lifecycle(client: BaseClient) -> None:
    expires_days = max(1, settings.artifact_ttl_seconds // 86400)
    lifecycle_config = {
        "Rules": [
            {
                "ID": "expire-artifacts",
                "Filter": {"Prefix": ""},
                "Status": "Enabled",
                "Expiration": {"Days": expires_days},
            }
        ]
    }
    try:
        client.put_bucket_lifecycle_configuration(
            Bucket=settings.s3_bucket_artifacts,
            LifecycleConfiguration=lifecycle_config,
        )
    except ClientError:
        # Not all S3-compatible providers support lifecycle APIs in dev.
        return


def upload_file(client: BaseClient, bucket: str, key: str, path: Path, content_type: str) -> None:
    client.upload_file(
        str(path),
        bucket,
        key,
        ExtraArgs={
            "ContentType": content_type,
            "Metadata": {
                "uploaded_at": datetime.now(timezone.utc).isoformat(),
            },
        },
    )


def upload_bytes(client: BaseClient, bucket: str, key: str, data: bytes, content_type: str) -> None:
    client.upload_fileobj(
        io.BytesIO(data),
        bucket,
        key,
        ExtraArgs={"ContentType": content_type},
    )


def signed_url(client: BaseClient, bucket: str, key: str, ttl_seconds: int) -> str:
    url = client.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": key},
        ExpiresIn=ttl_seconds,
    )
    return _rewrite_public_s3_url(url)


def _rewrite_public_s3_url(url: str) -> str:
    public_base = settings.s3_public_endpoint_url.strip()
    if not public_base:
        return url

    source = urlparse(url)
    target = urlparse(public_base)
    if not target.scheme or not target.netloc:
        return url

    return urlunparse(
        (
            target.scheme,
            target.netloc,
            source.path,
            source.params,
            source.query,
            source.fragment,
        )
    )


def object_exists(client: BaseClient, bucket: str, key: str) -> bool:
    try:
        client.head_object(Bucket=bucket, Key=key)
        return True
    except ClientError:
        return False
