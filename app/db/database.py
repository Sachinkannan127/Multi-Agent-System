import logging
from typing import Any, Dict, Optional
import pymongo
from pymongo.errors import PyMongoError
from app.core.config import settings

logger = logging.getLogger("app.db")
logging.basicConfig(level=logging.INFO)

class MongoDBManager:
    """
    Manages MongoDB connections, ping status, and collection access.
    """
    def __init__(self):
        self.client: Optional[pymongo.MongoClient] = None
        self.db = None

    def connect(self) -> bool:
        """
        Connects to MongoDB, sends a ping command, and logs the connection status.
        """
        uri = settings.MONGODB_URI
        db_name = settings.MONGODB_DB_NAME

        print("Connecting to MongoDB...")
        logger.info(f"Connecting to MongoDB URI: {uri[:25]}...")

        try:
            self.client = pymongo.MongoClient(uri, serverSelectionTimeoutMS=5000)
            # Send ping command to verify connection
            ping_response = self.client.admin.command("ping")
            self.db = self.client[db_name]

            print(f" ✅ MongoDB connected successfully! Ping status: {ping_response}")
            logger.info(f"✅ MongoDB connected successfully! Ping status: {ping_response}")
            return True

        except PyMongoError as e:
            print(f" ❌ MongoDB connection failed: {e}")
            logger.error(f" ❌ MongoDB connection failed: {e}")
            self.client = None
            self.db = None
            return False
        except Exception as e:
            print(f"Unexpected error connecting to MongoDB: {e}")
            logger.error(f"Unexpected error connecting to MongoDB: {e}")
            self.client = None
            self.db = None
            return False

    def ping(self) -> Dict[str, Any]:
        """
        Pings the MongoDB server to check if it's currently connected and alive.
        """
        if self.client is None:
            # Try re-connecting if client was not established
            print("❌ MongoDB client is not connected. Attempting connecting...")
            connected = self.connect()
            if not connected:
                return {
                    "status": "disconnected",
                    "ping": None,
                    "error": "Failed to connect to MongoDB server."
                }

        try:
            print("Pinging MongoDB...")
            ping_response = self.client.admin.command("ping")
            print(f"✅MongoDB connected! Ping response: {ping_response}")
            return {
                "status": "connected",
                "ping": ping_response,
                "db_name": settings.MONGODB_DB_NAME,
                "uri": settings.MONGODB_URI.split("@")[-1] if "@" in settings.MONGODB_URI else settings.MONGODB_URI
            }
        except PyMongoError as e:
            print(f"MongoDB ping failed: {e}")
            logger.error(f"MongoDB ping failed: {e}")
            return {
                "status": "disconnected",
                "ping": None,
                "error": str(e)
            }

    def close(self):
        """Closes the MongoDB client connection."""
        if self.client:
            self.client.close()
            self.client = None
            self.db = None
            print("MongoDB connection closed.")
            logger.info("MongoDB connection closed.")

# Singleton instance
db_manager = MongoDBManager()


def get_db():
    """Dependency helper to get the database instance."""
    if db_manager.db is None:
        db_manager.connect()
    return db_manager.db
