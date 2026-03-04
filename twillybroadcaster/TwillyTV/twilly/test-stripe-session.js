const Stripe = require('stripe');
const stripe = new Stripe('sk_test_51OXsV0HCxgj7mB8yEfuPrnyAZMRhoC9MQgr8bSp8g9yNvQ13Coro68YDfIqKIDCUYg2Wnp17xrvEU6E5UPcgcrz500Er5Mpfz0');

async function checkSession() {
  try {
    const sessionId = 'cs_test_b16qQ4qUq04D0iT0Sqe0CO7IpXAjQsdQtBdiBDBl0aoKtaz7G8gD0UYnG3';
    console.log('Checking Stripe session:', sessionId);
    
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    console.log('Session status:', session.status);
    console.log('Payment status:', session.payment_status);
    console.log('Customer:', session.customer);
    console.log('Amount total:', session.amount_total);
    console.log('Metadata:', session.metadata);
    
  } catch (error) {
    console.error('Error checking session:', error);
  }
}

checkSession(); 