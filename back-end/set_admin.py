import firebase_admin
from firebase_admin import auth, credentials
import os

def initialize_firebase():
    """Initialize Firebase Admin SDK."""
    try:
        if not firebase_admin._apps:
            cred = credentials.Certificate("serviceAccountKey.json")
            firebase_admin.initialize_app(cred)
            print("Firebase Admin initialized successfully.")
    except Exception as e:
        print(f"Error initializing Firebase Admin: {str(e)}")
        raise

def create_admin_user():
    """Create admin user if it doesn't exist."""
    try:
        # Initialize Firebase
        initialize_firebase()
        
        # Admin user details
        email = "admin@gmail.com"
        password = "123456"
        
        try:
            # Try to get existing user
            user = auth.get_user_by_email(email)
            print(f"User {email} already exists.")
        except auth.UserNotFoundError:
            # Create new user if doesn't exist
            user = auth.create_user(
                email=email,
                password=password,
                email_verified=True
            )
            print(f"Created new user: {email}")
        
        # Set admin custom claim
        auth.set_custom_user_claims(user.uid, {"admin": True})
        print(f"Set admin privileges for user: {email}")
        
    except Exception as e:
        print(f"Error creating admin user: {str(e)}")
        raise

if __name__ == "__main__":
    create_admin_user() 