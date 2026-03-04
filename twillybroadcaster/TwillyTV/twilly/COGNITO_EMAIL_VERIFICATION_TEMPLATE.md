# Cognito Email Verification Template

## Updated Sign Up Message

Use this text in your AWS Cognito User Pool email verification template:

```
Welcome to Twilly TV 📺

We're excited to have you join our community of creators!

To complete your account setup, please verify your email address using the verification code below:

{####}

This code will expire in 24 hours for your security.

Once verified, you'll be able to:
• Access your creator dashboard
• Start streaming live content
• Build and manage your channels
• Connect with your audience

If you didn't create an account with Twilly TV, please ignore this email.

Welcome aboard!
The Twilly TV Team
```

## How to Update in AWS Console

1. Go to AWS Cognito Console
2. Select your User Pool
3. Navigate to **Messaging** → **Email templates**
4. Select **Verification code** template
5. Update the message body with the text above
6. Keep the `{####}` placeholder as-is (Cognito will replace it with the actual code)

## Template Variables

- `{####}` - Will be replaced with the 6-digit verification code
- Other Cognito variables can be used if needed (e.g., `{username}`, `{####}`)

## Notes

- The placeholder `{####}` must remain exactly as shown for Cognito to replace it with the verification code
- You can customize the greeting, closing, and instructions while keeping the placeholder
- HTML formatting is supported in Cognito email templates
