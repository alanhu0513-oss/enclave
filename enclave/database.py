import os
import sqlite3
import cv2
import numpy as np
from dotenv import load_dotenv

# Initialize Enclave core local configurations
load_dotenv()
DB_PATH = os.getenv("LOCAL_DB_PATH", "./enclave_secure_vault.db")

def initialize_database():
    """Creates local storage structures to hold user biometric metadata and alert state logs."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Core table tracking registered user profile references and local file metadata
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            sample_image_path TEXT NOT NULL,
            registration_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Table storing suspicious match alerts flagged for your terminal review dashboard
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS identity_alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            infringing_source TEXT NOT NULL,
            match_confidence REAL NOT NULL,
            status TEXT DEFAULT 'PENDING_REVIEW',
            discovered_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    conn.close()
    print("🔒 Enclave Database and Schema Initialized Successfully.")

def register_user_offline(username, local_image_path):
    """Processes a local baseline photo using OpenCV to confirm face presence before saving."""
    if not os.path.exists(local_image_path):
        return f"Error: The target asset path '{local_image_path}' does not exist."

    # Load OpenCV's built-in, open-source Haar Cascade face detection layout
    cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
    face_cascade = cv2.CascadeClassifier(cascade_path)

    # Read the image file and convert to grayscale for mathematical analysis
    image = cv2.imread(local_image_path)
    if image is None:
        return "Error: Unable to process or parse image dimensions."
        
    gray_image = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # Run structural detection scan across pixels
    detected_faces = face_cascade.detectMultiScale(gray_image, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))

    if len(detected_faces) == 0:
        return "Verification Failed: No face profile detected in local sample asset."

    # Record the user account and secure local image file path binding
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT OR REPLACE INTO users (username, sample_image_path) VALUES (?, ?)",
            (username, local_image_path)
        )
        conn.commit()
        conn.close()
        return f"Success: Local biometric reference linked to user profile '{username}'."
    except Exception as e:
        return f"Database Error: {str(e)}"

if __name__ == "__main__":
    # Initialize database schemas automatically when module is executed directly
    initialize_database()


