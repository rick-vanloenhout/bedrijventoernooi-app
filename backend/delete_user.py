"""
CLI script to delete a user.
Usage:
    python -m backend.delete_user <username>
    python -m backend.delete_user admin
"""
import sys
from backend.database import SessionLocal
from backend.models import User


def delete_user(username: str):
    """Delete a user from the database."""
    if not username:
        print("Error: Username is required.")
        print("Usage: python -m backend.delete_user <username>")
        sys.exit(1)
    
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == username).first()
        if not user:
            print(f"Error: User '{username}' not found.")
            sys.exit(1)
        
        # Confirm deletion
        print(f"Warning: You are about to delete user '{username}'.")
        response = input("Are you sure? Type 'yes' to confirm: ")
        if response.lower() != 'yes':
            print("Aborted.")
            sys.exit(0)
        
        db.delete(user)
        db.commit()
        print(f"✓ User '{username}' deleted successfully.")
    except Exception as e:
        print(f"Error deleting user: {e}")
        db.rollback()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python -m backend.delete_user <username>")
        print("Example: python -m backend.delete_user admin")
        sys.exit(1)
    
    username = sys.argv[1]
    delete_user(username)
