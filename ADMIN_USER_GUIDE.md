# Admin User Management Guide

## Current Configuration

✅ **DEBUG mode**: OFF (production mode)  
✅ **Default admin creation**: DISABLED  
✅ **Security**: No default credentials will be created automatically

---

## Step-by-Step: Remove Existing Admin User

### Step 1: Navigate to project directory
```bash
cd "C:\Users\rick_\Documents\Labyellov\Bedrijventoernooi\2026\BedrijventoernooiApplicatie"
```

### Step 2: Activate your conda environment (if using conda)
```bash
conda activate bedrijventoernooi
```

### Step 3: Delete the admin user
```bash
python -m backend.delete_user admin
```

When prompted, type `yes` to confirm deletion.

**Expected output:**
```
Warning: You are about to delete user 'admin'.
Are you sure? Type 'yes' to confirm: yes
✓ User 'admin' deleted successfully.
```

---

## Step-by-Step: Create a New Admin User

### Step 1: Navigate to project directory
```bash
cd "C:\Users\rick_\Documents\Labyellov\Bedrijventoernooi\2026\BedrijventoernooiApplicatie"
```

### Step 2: Activate your conda environment (if using conda)
```bash
conda activate bedrijventoernooi
```

### Step 3: Create a new admin user
```bash
python -m backend.create_admin <username> <password>
```

**Example:**
```bash
python -m backend.create_admin organizer MySecurePassword123!
```

**Requirements:**
- Username: Any string (no spaces)
- Password: Minimum 8 characters recommended (you'll get a warning if less)

**Expected output:**
```
✓ Admin user 'organizer' created successfully.
```

### Step 4: Verify the user was created
You can verify by trying to log in at:
```
http://127.0.0.1:8000/frontend/login.html
```

---

## Quick Reference Commands

### Create Admin User
```bash
python -m backend.create_admin <username> <password>
```

### Delete User
```bash
python -m backend.delete_user <username>
```

### List Users (via Python shell)
```python
python
>>> from backend.database import SessionLocal
>>> from backend.models import User
>>> db = SessionLocal()
>>> users = db.query(User).all()
>>> for u in users: print(u.username)
>>> db.close()
```

---

## Security Notes

1. **Never commit passwords to version control**
2. **Use strong passwords** (minimum 8 characters, mix of letters, numbers, symbols)
3. **Default admin creation is disabled** - you must manually create users
4. **DEBUG mode is OFF** - production-ready configuration

---

## Troubleshooting

### Error: "User already exists"
- The username is already taken
- Use a different username or delete the existing user first

### Error: "Module not found"
- Make sure you're in the project root directory
- Ensure your conda environment is activated
- Verify all dependencies are installed: `pip install -r requirements.txt`

### Can't log in after creating user
- Verify the user was created successfully
- Check that the server is running
- Ensure you're using the correct username and password
