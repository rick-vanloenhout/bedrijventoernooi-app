"""
CLI script to create admin users securely.
Usage:
    python -m backend.create_admin <username> <password>
    python -m backend.create_admin admin mypassword123
"""
import sys
from backend.database import SessionLocal
from backend.models import User
from backend.auth import get_password_hash


def create_admin_user(username: str, password: str):
    """Create an admin user in the database."""
    if not username or not password:
        print("Error: Username and password are required.")
        print("Usage: python -m backend.create_admin <username> <password>")
        sys.exit(1)
    
    if len(password) < 8:
        print("Warning: Password is less than 8 characters. Consider using a stronger password.")
        response = input("Continue anyway? (y/N): ")
        if response.lower() != 'y':
            print("Aborted.")
            sys.exit(0)
    
    db = SessionLocal()
    try:
        # Check if user already exists
        existing = db.query(User).filter(User.username == username).first()
        if existing:
            print(f"Error: User '{username}' already exists.")
            sys.exit(1)
        
        # Create new admin user
        admin = User(
            username=username,
            hashed_password=get_password_hash(password),
            is_active=1
        )
        db.add(admin)
        db.commit()
        print(f"✓ Admin user '{username}' created successfully.")
    except Exception as e:
        print(f"Error creating admin user: {e}")
        db.rollback()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python -m backend.create_admin <username> <password>")
        print("Example: python -m backend.create_admin admin mypassword123")
        sys.exit(1)
    
    username = sys.argv[1]
    password = sys.argv[2]
    create_admin_user(username, password)
