require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const bcrypt = require('bcryptjs');

async function createAdmin() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Default admin credentials (you can change these)
    const email = process.argv[2] || 'admin@example.com';
    const password = process.argv[3] || 'admin123';
    const name = process.argv[4] || 'Admin User';

    // Check if admin already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    
    if (existingUser) {
      if (existingUser.role === 'admin') {
        console.log('⚠️  Admin user already exists with this email:', email);
        console.log('   Email:', email);
        console.log('   Role:', existingUser.role);
        console.log('\n✅ You can login with this account!');
        process.exit(0);
      } else {
        // Update existing user to admin
        existingUser.role = 'admin';
        existingUser.password = await bcrypt.hash(password, 10);
        await existingUser.save();
        console.log('✅ Updated existing user to admin!');
        console.log('📧 Email:', email);
        console.log('🔑 Password:', password);
        console.log('\n✅ You can now login with these credentials!');
        await mongoose.disconnect();
        process.exit(0);
      }
    }

    // Create new admin user
    const admin = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role: 'admin'
    });

    console.log('✅ Admin user created successfully!\n');
    console.log('📧 Email:', email);
    console.log('🔑 Password:', password);
    console.log('👤 Name:', name);
    console.log('\n✅ You can now login at: http://localhost:8080/login');
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 11000) {
      console.error('   Email already exists. Use different email or update existing user.');
    }
    process.exit(1);
  }
}

createAdmin();
