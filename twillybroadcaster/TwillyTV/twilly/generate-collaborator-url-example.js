// Example of generating a collaborator invite URL with the corrected format
// This shows how the URL should look now

const generateCollaboratorUrl = () => {
  // Example data (this would come from your database/API)
  const inviteCode = '3emt48fy0aulrxqe5zkf9l';
  const channelName = 'Twilly TV';
  const title = 'Twilly TV';
  const description = 'Join as a collaborator and stream on Twilly TV with Twilly!';
  const creator = 'dehsin365';
  const poster = 'https://d3hv50jkrzkiyh.cloudfront.net/public/series-posters/dehyu.sinyan@gmail.com/Twilly+TV/47FA2F76-79C0-4129-B26D-06FD87A99713.png';
  
  const baseUrl = 'http://localhost:3000';
  
  // OLD FORMAT (what you were getting before):
  const oldUrl = `${baseUrl}/collaborator/${inviteCode}?title=${encodeURIComponent(title)}&description=${encodeURIComponent(description)}&creator=${encodeURIComponent(creator)}`;
  
  // NEW FORMAT (corrected - matches affiliate structure):
  const newUrl = `${baseUrl}/collaborator/${inviteCode}/${encodeURIComponent(channelName)}?title=${encodeURIComponent(title)}&description=${encodeURIComponent(description)}&creator=${encodeURIComponent(creator)}&poster=${encodeURIComponent(poster)}`;
  
  console.log('🔗 COLLABORATOR URL GENERATION EXAMPLE');
  console.log('=====================================');
  console.log('');
  console.log('❌ OLD FORMAT (what you were getting):');
  console.log(oldUrl);
  console.log('');
  console.log('✅ NEW FORMAT (corrected - matches affiliate):');
  console.log(newUrl);
  console.log('');
  console.log('📋 KEY DIFFERENCES:');
  console.log('- Channel name now in URL path: /collaborator/{inviteCode}/{channelName}');
  console.log('- Matches affiliate URL structure exactly');
  console.log('- Supports poster metadata');
  console.log('- Works with new collaborator page at /pages/collaborator/[inviteCode]/[channelName].vue');
  console.log('');
  console.log('🎯 AFFILIATE URL FOR COMPARISON:');
  const affiliateUrl = `${baseUrl}/affiliate/09c2ef9a-6be9-431d-8e1c-914aea740a25/${encodeURIComponent(channelName)}?title=${encodeURIComponent(title)}&description=${encodeURIComponent(description)}&creator=${encodeURIComponent(creator)}&poster=${encodeURIComponent(poster)}`;
  console.log(affiliateUrl);
  console.log('');
  console.log('✅ Both URLs now have identical structure!');
};

generateCollaboratorUrl();
