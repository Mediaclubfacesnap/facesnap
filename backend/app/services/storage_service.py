import requests
import logging
from app.config import settings

logger = logging.getLogger(__name__)

class StorageService:
    def __init__(self):
        self.base_url = f"{settings.SUPABASE_URL}/storage/v1"
        self.headers = {
            "Authorization": f"Bearer {settings.SUPABASE_KEY}",
            "apikey": settings.SUPABASE_KEY
        }
        self.bucket_name = settings.SUPABASE_BUCKET
        self.initialize_bucket()

    def initialize_bucket(self):
        """Checks if the bucket exists. If not, creates a public bucket."""
        check_url = f"{self.base_url}/bucket/{self.bucket_name}"
        try:
            response = requests.get(check_url, headers=self.headers)
            if response.status_code == 200:
                logger.info(f"Supabase Storage bucket '{self.bucket_name}' already exists.")
                return
            
            # Bucket does not exist, create it
            create_url = f"{self.base_url}/bucket"
            payload = {
                "id": self.bucket_name,
                "name": self.bucket_name,
                "public": True,
                "file_size_limit": 52428800 # 50 MB
            }
            res = requests.post(create_url, headers=self.headers, json=payload)
            if res.status_code == 200:
                logger.info(f"Supabase Storage bucket '{self.bucket_name}' successfully created!")
            else:
                logger.error(f"Failed to create bucket: {res.status_code} - {res.text}")
        except Exception as e:
            logger.error(f"Error checking/creating storage bucket: {e}")

    def upload_file(self, file_path: str, file_bytes: bytes, content_type: str = "image/jpeg") -> str:
        """
        Uploads raw file bytes to the Supabase Storage bucket.
        Returns the public URL of the uploaded asset.
        """
        upload_url = f"{self.base_url}/object/{self.bucket_name}/{file_path.lstrip('/')}"
        
        headers = self.headers.copy()
        headers["Content-Type"] = content_type
        headers["x-upsert"] = "true" # Overwrite if exists

        try:
            response = requests.post(upload_url, headers=headers, data=file_bytes)
            if response.status_code == 200:
                public_url = self.get_public_url(file_path)
                logger.info(f"Successfully uploaded {file_path} to Supabase Storage.")
                return public_url
            else:
                raise Exception(f"Supabase Storage upload failed: {response.status_code} - {response.text}")
        except Exception as e:
            logger.error(f"Exception uploading file to storage: {e}")
            raise

    def get_public_url(self, file_path: str) -> str:
        """Returns the public access URL of a path in a public bucket."""
        cleaned_path = file_path.lstrip('/')
        return f"{settings.SUPABASE_URL}/storage/v1/object/public/{self.bucket_name}/{cleaned_path}"

storage_service = StorageService()
