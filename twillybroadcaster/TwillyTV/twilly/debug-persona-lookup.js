// Debug script to check persona lookup for non-master account

console.log('🔍 DEBUGGING PERSONA LOOKUP FOR NON-MASTER ACCOUNT');
console.log('==================================================');
console.log('');

console.log('📋 ACCOUNT DETAILS:');
console.log('   - Email: dehsin365@gmail.com');
console.log('   - Expected: Creator persona for Twilly After Dark');
console.log('   - Current: Only Affiliate persona showing');
console.log('');

console.log('🔍 DEBUGGING STEPS:');
console.log('');

console.log('1️⃣ CHECK API RESPONSE:');
console.log('   - Open browser console on profile page');
console.log('   - Look for persona API calls');
console.log('   - Check what /api/personas/get returns');
console.log('');

console.log('2️⃣ CHECK DATABASE RECORDS:');
console.log('   - Look for USER#dehsin365@gmail.com records');
console.log('   - Look for USER#<userId> records');
console.log('   - Check for COLLABORATOR_ROLE#Twilly After Dark');
console.log('');

console.log('3️⃣ POSSIBLE ISSUES:');
console.log('   A) Creator persona not created in database');
console.log('   B) Creator persona created with wrong PK pattern');
console.log('   C) API not finding creator persona due to PK mismatch');
console.log('   D) Non-master account handling issue');
console.log('');

console.log('🔧 DEBUGGING COMMANDS:');
console.log('');

console.log('In browser console, run:');
console.log('1. Check auth store:');
console.log('   window.$nuxt.$pinia.state.value.auth');
console.log('');

console.log('2. Check persona data:');
console.log('   localStorage.getItem("personaData")');
console.log('');

console.log('3. Check API response:');
console.log('   fetch("/api/personas/get", {');
console.log('     method: "POST",');
console.log('     headers: {"Content-Type": "application/json"},');
console.log('     body: JSON.stringify({');
console.log('       userId: "USER_ID_HERE",');
console.log('       userEmail: "dehsin365@gmail.com"');
console.log('     })');
console.log('   }).then(r => r.json()).then(console.log)');
console.log('');

console.log('4. Check if creator persona exists:');
console.log('   - Look for COLLABORATOR_ROLE#Twilly After Dark');
console.log('   - Check both USER#dehsin365@gmail.com and USER#<userId>');
console.log('');

console.log('📝 WHAT TO REPORT:');
console.log('1. What does the persona API response show?');
console.log('2. What personas are in the auth store?');
console.log('3. Are there any error messages in console?');
console.log('4. Does the creator persona exist in the database?');
