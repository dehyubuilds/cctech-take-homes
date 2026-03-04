export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    console.log('Onboarding complete query:', query);

    // The account ID will be in the query parameters
    const accountId = query.account_id;
    
    if (!accountId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'No account ID provided'
        })
      };
    }

    // Here you would typically:
    // 1. Update your database with the account status
    // 2. Redirect the user to their dashboard
    // 3. Show a success message

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Onboarding completed successfully',
        accountId: accountId
      })
    };

  } catch (error) {
    console.error('Error in onboarding complete:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to process onboarding completion'
      })
    };
  }
}); 