"""Storage adapters for reading hooks logs from different sources (Local, S3, Azure)."""
import os
import json
import tempfile
import shutil
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Optional, List, Dict, Any, Generator
from datetime import datetime

# Optional cloud SDK imports - will be checked at runtime
try:
    import boto3
    from botocore.exceptions import ClientError, NoCredentialsError
    HAS_BOTO3 = True
except ImportError:
    HAS_BOTO3 = False

try:
    from azure.storage.blob import BlobServiceClient, ContainerClient
    from azure.core.exceptions import AzureError
    HAS_AZURE = True
except ImportError:
    HAS_AZURE = False


class StorageAdapter(ABC):
    """Abstract base class for storage adapters."""
    
    @abstractmethod
    def list_files(self, extension_filter: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        """List available log files."""
        pass
    
    @abstractmethod
    def read_file(self, filepath: str) -> str:
        """Read contents of a file."""
        pass
    
    @abstractmethod
    def file_exists(self, filepath: str) -> bool:
        """Check if a file exists."""
        pass
    
    @abstractmethod
    def get_file_info(self, filepath: str) -> Optional[Dict[str, Any]]:
        """Get metadata about a file."""
        pass
    
    @abstractmethod
    def test_connection(self) -> Dict[str, Any]:
        """Test the storage connection."""
        pass


class LocalStorageAdapter(StorageAdapter):
    """Adapter for local filesystem storage."""
    
    def __init__(self, base_path: str):
        self.base_path = Path(base_path)
    
    def list_files(self, extension_filter: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        if extension_filter is None:
            extension_filter = ['.jsonl', '.log']
        
        files = []
        if not self.base_path.exists():
            return files
        
        for f in self.base_path.iterdir():
            if f.is_file() and any(f.suffix == ext for ext in extension_filter):
                stat = f.stat()
                files.append({
                    "name": f.name,
                    "path": str(f),
                    "size": stat.st_size,
                    "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    "type": f.suffix[1:]  # Remove leading dot
                })
        
        return sorted(files, key=lambda x: x['modified'], reverse=True)
    
    def read_file(self, filepath: str) -> str:
        with open(filepath, 'r', encoding='utf-8') as f:
            return f.read()
    
    def file_exists(self, filepath: str) -> bool:
        return Path(filepath).exists()
    
    def get_file_info(self, filepath: str) -> Optional[Dict[str, Any]]:
        path = Path(filepath)
        if not path.exists():
            return None
        
        stat = path.stat()
        return {
            "name": path.name,
            "path": str(path),
            "size": stat.st_size,
            "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
            "type": path.suffix[1:] if path.suffix else "unknown"
        }
    
    def test_connection(self) -> Dict[str, Any]:
        if self.base_path.exists() and self.base_path.is_dir():
            return {"success": True, "message": "Local directory accessible"}
        return {"success": False, "message": f"Directory not found: {self.base_path}"}


class S3StorageAdapter(StorageAdapter):
    """Adapter for AWS S3 storage."""
    
    def __init__(
        self,
        bucket: str,
        prefix: str = "",
        region: str = "us-east-1",
        access_key_id: Optional[str] = None,
        secret_access_key: Optional[str] = None
    ):
        if not HAS_BOTO3:
            raise ImportError("boto3 is required for S3 storage. Install with: pip install boto3")
        
        self.bucket = bucket
        self.prefix = prefix.strip('/')
        self.region = region
        
        # Use provided credentials or fall back to environment/IAM
        session_kwargs = {}
        if access_key_id and secret_access_key:
            session_kwargs['aws_access_key_id'] = access_key_id
            session_kwargs['aws_secret_access_key'] = secret_access_key
        
        self.session = boto3.Session(region_name=region, **session_kwargs)
        self.s3_client = self.session.client('s3')
        self._temp_dir = None
    
    def _get_temp_dir(self) -> Path:
        """Get or create temporary directory for downloaded files."""
        if self._temp_dir is None:
            self._temp_dir = Path(tempfile.mkdtemp(prefix='windsurf_s3_'))
        return self._temp_dir
    
    def _download_file(self, s3_key: str) -> str:
        """Download a file from S3 to temp directory and return local path."""
        local_path = self._get_temp_dir() / Path(s3_key).name
        self.s3_client.download_file(self.bucket, s3_key, str(local_path))
        return str(local_path)
    
    def list_files(self, extension_filter: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        if extension_filter is None:
            extension_filter = ['.jsonl', '.log']
        
        files = []
        prefix = f"{self.prefix}/" if self.prefix else ""
        
        try:
            paginator = self.s3_client.get_paginator('list_objects_v2')
            for page in paginator.paginate(Bucket=self.bucket, Prefix=prefix):
                for obj in page.get('Contents', []):
                    key = obj['Key']
                    name = Path(key).name
                    
                    # Check extension filter
                    if not any(name.endswith(ext) for ext in extension_filter):
                        continue
                    
                    files.append({
                        "name": name,
                        "path": f"s3://{self.bucket}/{key}",
                        "s3_key": key,
                        "size": obj['Size'],
                        "modified": obj['LastModified'].isoformat(),
                        "type": Path(name).suffix[1:] if Path(name).suffix else "unknown"
                    })
        except ClientError as e:
            raise Exception(f"S3 error: {e}")
        
        return sorted(files, key=lambda x: x['modified'], reverse=True)
    
    def read_file(self, filepath: str) -> str:
        """Read file from S3. filepath can be s3:// URI or just the key."""
        if filepath.startswith('s3://'):
            # Parse s3://bucket/key format
            parts = filepath[5:].split('/', 1)
            key = parts[1] if len(parts) > 1 else ''
        else:
            key = filepath
        
        try:
            response = self.s3_client.get_object(Bucket=self.bucket, Key=key)
            return response['Body'].read().decode('utf-8')
        except ClientError as e:
            raise Exception(f"Failed to read S3 file: {e}")
    
    def file_exists(self, filepath: str) -> bool:
        if filepath.startswith('s3://'):
            parts = filepath[5:].split('/', 1)
            key = parts[1] if len(parts) > 1 else ''
        else:
            key = filepath
        
        try:
            self.s3_client.head_object(Bucket=self.bucket, Key=key)
            return True
        except ClientError:
            return False
    
    def get_file_info(self, filepath: str) -> Optional[Dict[str, Any]]:
        if filepath.startswith('s3://'):
            parts = filepath[5:].split('/', 1)
            key = parts[1] if len(parts) > 1 else ''
        else:
            key = filepath
        
        try:
            response = self.s3_client.head_object(Bucket=self.bucket, Key=key)
            return {
                "name": Path(key).name,
                "path": f"s3://{self.bucket}/{key}",
                "s3_key": key,
                "size": response['ContentLength'],
                "modified": response['LastModified'].isoformat(),
                "type": Path(key).suffix[1:] if Path(key).suffix else "unknown"
            }
        except ClientError:
            return None
    
    def test_connection(self) -> Dict[str, Any]:
        try:
            # Try to list objects (limited to 1) to verify access
            self.s3_client.list_objects_v2(Bucket=self.bucket, MaxKeys=1)
            return {"success": True, "message": f"Successfully connected to S3 bucket: {self.bucket}"}
        except NoCredentialsError:
            return {"success": False, "message": "AWS credentials not found. Configure via .env or IAM role."}
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code', 'Unknown')
            if error_code == 'NoSuchBucket':
                return {"success": False, "message": f"Bucket not found: {self.bucket}"}
            elif error_code == 'AccessDenied':
                return {"success": False, "message": "Access denied. Check IAM permissions."}
            return {"success": False, "message": f"S3 error: {str(e)}"}
        except Exception as e:
            return {"success": False, "message": f"Connection failed: {str(e)}"}
    
    def cleanup(self):
        """Clean up temporary files."""
        if self._temp_dir and self._temp_dir.exists():
            shutil.rmtree(self._temp_dir)
            self._temp_dir = None


class AzureStorageAdapter(StorageAdapter):
    """Adapter for Azure Blob Storage."""
    
    def __init__(
        self,
        account_name: str,
        container: str,
        path: str = "",
        account_key: Optional[str] = None,
        connection_string: Optional[str] = None
    ):
        if not HAS_AZURE:
            raise ImportError("azure-storage-blob is required for Azure storage. Install with: pip install azure-storage-blob")
        
        self.account_name = account_name
        self.container_name = container
        self.prefix = path.strip('/')
        
        # Build connection
        if connection_string:
            self.blob_service = BlobServiceClient.from_connection_string(connection_string)
        elif account_key:
            connection_str = f"DefaultEndpointsProtocol=https;AccountName={account_name};AccountKey={account_key};EndpointSuffix=core.windows.net"
            self.blob_service = BlobServiceClient.from_connection_string(connection_str)
        else:
            # Try environment variable
            env_conn_str = os.environ.get('AZURE_STORAGE_CONNECTION_STRING')
            env_key = os.environ.get('AZURE_STORAGE_ACCOUNT_KEY')
            
            if env_conn_str:
                self.blob_service = BlobServiceClient.from_connection_string(env_conn_str)
            elif env_key:
                connection_str = f"DefaultEndpointsProtocol=https;AccountName={account_name};AccountKey={env_key};EndpointSuffix=core.windows.net"
                self.blob_service = BlobServiceClient.from_connection_string(connection_str)
            else:
                # Fall back to DefaultAzureCredential (for managed identity)
                from azure.identity import DefaultAzureCredential
                credential = DefaultAzureCredential()
                account_url = f"https://{account_name}.blob.core.windows.net"
                self.blob_service = BlobServiceClient(account_url=account_url, credential=credential)
        
        self.container_client = self.blob_service.get_container_client(container)
        self._temp_dir = None
    
    def _get_temp_dir(self) -> Path:
        """Get or create temporary directory for downloaded files."""
        if self._temp_dir is None:
            self._temp_dir = Path(tempfile.mkdtemp(prefix='windsurf_azure_'))
        return self._temp_dir
    
    def list_files(self, extension_filter: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        if extension_filter is None:
            extension_filter = ['.jsonl', '.log']
        
        files = []
        prefix = f"{self.prefix}/" if self.prefix else ""
        
        try:
            blobs = self.container_client.list_blobs(name_starts_with=prefix if prefix else None)
            for blob in blobs:
                name = Path(blob.name).name
                
                # Check extension filter
                if not any(name.endswith(ext) for ext in extension_filter):
                    continue
                
                files.append({
                    "name": name,
                    "path": f"azure://{self.account_name}/{self.container_name}/{blob.name}",
                    "blob_name": blob.name,
                    "size": blob.size,
                    "modified": blob.last_modified.isoformat() if blob.last_modified else None,
                    "type": Path(name).suffix[1:] if Path(name).suffix else "unknown"
                })
        except AzureError as e:
            raise Exception(f"Azure error: {e}")
        
        return sorted(files, key=lambda x: x['modified'] or '', reverse=True)
    
    def read_file(self, filepath: str) -> str:
        """Read file from Azure. filepath can be azure:// URI or just the blob name."""
        if filepath.startswith('azure://'):
            # Parse azure://account/container/blobname format
            parts = filepath[8:].split('/', 2)
            blob_name = parts[2] if len(parts) > 2 else ''
        else:
            blob_name = filepath
        
        try:
            blob_client = self.container_client.get_blob_client(blob_name)
            return blob_client.download_blob().readall().decode('utf-8')
        except AzureError as e:
            raise Exception(f"Failed to read Azure blob: {e}")
    
    def file_exists(self, filepath: str) -> bool:
        if filepath.startswith('azure://'):
            parts = filepath[8:].split('/', 2)
            blob_name = parts[2] if len(parts) > 2 else ''
        else:
            blob_name = filepath
        
        try:
            blob_client = self.container_client.get_blob_client(blob_name)
            blob_client.get_blob_properties()
            return True
        except:
            return False
    
    def get_file_info(self, filepath: str) -> Optional[Dict[str, Any]]:
        if filepath.startswith('azure://'):
            parts = filepath[8:].split('/', 2)
            blob_name = parts[2] if len(parts) > 2 else ''
        else:
            blob_name = filepath
        
        try:
            blob_client = self.container_client.get_blob_client(blob_name)
            props = blob_client.get_blob_properties()
            return {
                "name": Path(blob_name).name,
                "path": f"azure://{self.account_name}/{self.container_name}/{blob_name}",
                "blob_name": blob_name,
                "size": props.size,
                "modified": props.last_modified.isoformat() if props.last_modified else None,
                "type": Path(blob_name).suffix[1:] if Path(blob_name).suffix else "unknown"
            }
        except:
            return None
    
    def test_connection(self) -> Dict[str, Any]:
        try:
            # Try to get container properties to verify access
            self.container_client.get_container_properties()
            return {"success": True, "message": f"Successfully connected to Azure container: {self.container_name}"}
        except AzureError as e:
            error_str = str(e)
            if 'ContainerNotFound' in error_str:
                return {"success": False, "message": f"Container not found: {self.container_name}"}
            elif 'AuthenticationFailed' in error_str or 'AuthorizationFailure' in error_str:
                return {"success": False, "message": "Authentication failed. Check credentials."}
            return {"success": False, "message": f"Azure error: {error_str}"}
        except Exception as e:
            return {"success": False, "message": f"Connection failed: {str(e)}"}
    
    def cleanup(self):
        """Clean up temporary files."""
        if self._temp_dir and self._temp_dir.exists():
            shutil.rmtree(self._temp_dir)
            self._temp_dir = None


# Global storage configuration
_current_storage_config: Optional[Dict[str, Any]] = None
_current_adapter: Optional[StorageAdapter] = None


def get_storage_adapter(config: Optional[Dict[str, Any]] = None) -> StorageAdapter:
    """Get the appropriate storage adapter based on configuration."""
    global _current_storage_config, _current_adapter
    
    # If no config provided, use current or default to local
    if config is None:
        if _current_adapter is not None:
            return _current_adapter
        # Default to local storage
        from config import LOG_DIR
        return LocalStorageAdapter(str(LOG_DIR))
    
    storage_type = config.get('type', 'local')
    
    if storage_type == 'local':
        path = config.get('path', '')
        if not path:
            from config import LOG_DIR
            path = str(LOG_DIR)
        adapter = LocalStorageAdapter(path)
    
    elif storage_type == 's3':
        adapter = S3StorageAdapter(
            bucket=config['bucket'],
            prefix=config.get('prefix', ''),
            region=config.get('region', 'us-east-1'),
            access_key_id=config.get('access_key_id'),
            secret_access_key=config.get('secret_access_key')
        )
    
    elif storage_type == 'azure':
        adapter = AzureStorageAdapter(
            account_name=config['account_name'],
            container=config['container'],
            path=config.get('path', ''),
            account_key=config.get('account_key'),
            connection_string=config.get('connection_string')
        )
    
    else:
        raise ValueError(f"Unknown storage type: {storage_type}")
    
    return adapter


def configure_storage(config: Dict[str, Any]) -> Dict[str, Any]:
    """Configure and set the global storage adapter."""
    global _current_storage_config, _current_adapter
    
    try:
        adapter = get_storage_adapter(config)
        result = adapter.test_connection()
        
        if result['success']:
            # Clean up old adapter if exists
            if _current_adapter is not None and hasattr(_current_adapter, 'cleanup'):
                _current_adapter.cleanup()
            
            _current_storage_config = config
            _current_adapter = adapter
        
        return result
    except ImportError as e:
        return {"success": False, "message": str(e)}
    except Exception as e:
        return {"success": False, "message": f"Configuration failed: {str(e)}"}


def get_current_storage_config() -> Optional[Dict[str, Any]]:
    """Get the current storage configuration."""
    return _current_storage_config


def reset_storage():
    """Reset storage to default local configuration."""
    global _current_storage_config, _current_adapter
    
    if _current_adapter is not None and hasattr(_current_adapter, 'cleanup'):
        _current_adapter.cleanup()
    
    _current_storage_config = None
    _current_adapter = None
