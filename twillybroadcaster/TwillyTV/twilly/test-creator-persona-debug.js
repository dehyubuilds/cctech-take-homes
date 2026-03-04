// Test to debug creator persona lookup for non-master account

console.log('🔍 CREATOR PERSONA DEBUG FOR NON-MASTER ACCOUNT');
console.log('===============================================');
console.log('');

console.log('🐛 ISSUE:');
console.log('   - Account: dehsin365@gmail.com (non-master)');
console.log('   - Expected: Creator persona for "Twilly After Dark"');
console.log('   - Current: Only Affiliate persona showing');
console.log('');

console.log('✅ DEBUGGING ADDED:');
console.log('   - Added console logging to /api/personas/get');
console.log('   - Will show PK being used for creator persona lookup');
console.log('   - Will show query results from DynamoDB');
console.log('');

console.log('🧪 TO TEST:');
console.log('1. Go to profile page for dehsin365@gmail.com account');
console.log('2. Open browser console (F12)');
console.log('3. Look for these logs:');
console.log('   - "🔍 Looking for creator personas with PK: USER#<userId>"');
console.log('   - "🔍 Creator persona query result: [...]"');
console.log('4. Check what the query returns');
console.log('');

console.log('🔍 WHAT TO LOOK FOR:');
console.log('');

console.log('IF QUERY RETURNS EMPTY ARRAY:');
console.log('   - Creator persona not stored in database');
console.log('   - Need to check if invite acceptance worked');
console.log('   - May need to re-accept the invite');
console.log('');

console.log('IF QUERY RETURNS ITEMS:');
console.log('   - Creator persona exists in database');
console.log('   - Issue is in how it\'s being processed');
console.log('   - Check if channel name matches "Twilly After Dark"');
console.log('');

console.log('IF QUERY FAILS:');
console.log('   - Database connection issue');
console.log('   - Wrong table name or region');
console.log('   - Check AWS credentials');
console.log('');

console.log('📝 REPORT BACK:');
console.log('1. What does the console show for the creator persona query?');
console.log('2. Are there any error messages?');
console.log('3. What items are returned (if any)?');
console.log('4. Does the channel name match "Twilly After Dark"?');
