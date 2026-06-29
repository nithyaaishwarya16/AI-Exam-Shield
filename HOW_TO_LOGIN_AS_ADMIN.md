# 🔐 How to Login as Admin

## Quick Method (Recommended)

### Step 1: Open Terminal in `backend-code` folder
```bash
cd backend-code
```

### Step 2: Run the admin creation script
```bash
node create-admin.js
```

This creates an admin with:
- **Email:** `admin@example.com`
- **Password:** `admin123`

### Step 3: Login
1. Go to: `http://localhost:8080/login`
2. Enter:
   - Email: `admin@example.com`
   - Password: `admin123`
3. Click "Login"

---

## Custom Admin Credentials

To create admin with custom credentials:

```bash
node create-admin.js your-email@example.com yourpassword "Your Name"
```

Example:
```bash
node create-admin.js admin@myschool.com securepass123 "School Admin"
```

---

## Convert Existing User to Admin

If you already have a user account:

### Option 1: Using the script
```bash
# First, create a user normally through registration
# Then run:
node create-admin.js your-email@example.com yourpassword
```

This will update your existing user to admin role.

### Option 2: Direct MongoDB Update

1. Connect to MongoDB:
```bash
mongosh mongodb://localhost:27018/anticheating_exam
```

2. Update user:
```javascript
db.users.updateOne(
  { email: "your-email@example.com" },
  { $set: { role: "admin" } }
)
```

---

## Verify Admin Access

After logging in as admin:

1. **Check Profile Menu** (top right corner)
   - You should see "Admin Dashboard" option
   - You should see "Analytics" option

2. **Access Admin Pages:**
   - Admin Dashboard: `http://localhost:8080/admin`
   - Analytics: `http://localhost:8080/analytics`

---

## Troubleshooting

### "Email already exists"
- The user already exists. The script will update it to admin if it's not already admin.

### "Cannot connect to MongoDB"
- Make sure MongoDB is running on port 27018
- Check your `.env` file has correct `MONGODB_URI`

### "No admin options in menu"
- Make sure you logged out and logged back in after creating admin
- Check browser console (F12) for errors
- Verify user role in database

---

## Default Admin Credentials

If you used the default script:
- **Email:** `admin@example.com`
- **Password:** `admin123`

**⚠️ Change these in production!**
