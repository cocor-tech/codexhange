## Admin setup

1. Add one or more admin emails to the environment variable ADMIN_EMAILS.
2. Set the Brevo SMTP values in the environment so OTP emails can be delivered.
3. Sign in at /admin using one of the configured emails.

Example:

ADMIN_EMAILS=you@example.com,team@example.com
BREVO_API_KEY=your-brevo-key
EMAIL_SERVER_HOST=smtp-relay.brevo.com
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=apikey
EMAIL_SERVER_PASSWORD=your-brevo-key
EMAIL_FROM=noreply@codexhange.com
