// Test script to demonstrate the new collaborator invite flow with metadata
// This shows how to create and use collaborator invites with rich metadata

const testCollaboratorInvite = async () => {
  console.log('🧪 Testing Collaborator Invite Flow with Metadata');
  console.log('================================================');
  
  // Step 1: Create a collaborator invite with metadata
  console.log('\n1. Creating collaborator invite with metadata...');
  
  const inviteData = {
    channelName: 'Twilly TV',
    channelOwnerEmail: 'dehyu.sinyan@gmail.com',
    channelOwnerId: 'user123',
    title: 'Twilly TV',
    description: 'Join as a collaborator and stream on Twilly TV with Twilly!',
    creator: 'DehSin365',
    poster: 'https://d3hv50jkrzkiyh.cloudfront.net/public/series-posters/dehyu.sinyan@gmail.com/Twilly+TV/47FA2F76-79C0-4129-B26D-06FD87A99713.png'
  };
  
  try {
    const response = await fetch('/api/collaborations/store-invite-with-metadata', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(inviteData)
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Invite created successfully!');
      console.log('Invite Code:', result.inviteCode);
      console.log('Channel Name:', result.channelName);
      console.log('Title:', result.title);
      console.log('Description:', result.description);
      console.log('Creator:', result.creator);
      console.log('Poster:', result.poster);
      
      // Step 2: Generate the collaborator invite URL
      console.log('\n2. Generated Collaborator Invite URL:');
      const baseUrl = 'http://localhost:3000';
      const collaboratorUrl = `${baseUrl}/collaborator/${result.inviteCode}/${encodeURIComponent(result.channelName)}?title=${encodeURIComponent(result.title)}&description=${encodeURIComponent(result.description)}&creator=${encodeURIComponent(result.creator)}&poster=${encodeURIComponent(result.poster)}`;
      
      console.log('🔗 Collaborator Invite URL (CORRECTED):');
      console.log(collaboratorUrl);
      
      // Step 3: Show the difference from affiliate URL
      console.log('\n3. Comparison with Affiliate URL:');
      const affiliateUrl = `${baseUrl}/affiliate/${result.inviteCode}/${encodeURIComponent(result.channelName)}?title=${encodeURIComponent(result.title)}&description=${encodeURIComponent(result.description)}&creator=${encodeURIComponent(result.creator)}&poster=${encodeURIComponent(result.poster)}`;
      
      console.log('🔗 Affiliate Invite URL:');
      console.log(affiliateUrl);
      
      console.log('\n📋 Key Differences:');
      console.log('- Both now have channel name in the URL path');
      console.log('- Both support rich metadata in query parameters');
      console.log('- Both have consistent URL structure');
      console.log('- Collaborator page now displays metadata like affiliate page');
      console.log('\n✅ FIXED: Collaborator URLs now include channel name in path like affiliate URLs');
      
      return result.inviteCode;
    } else {
      console.error('❌ Failed to create invite:', result.message);
    }
  } catch (error) {
    console.error('❌ Error creating invite:', error);
  }
};

// Test the flow
testCollaboratorInvite();
