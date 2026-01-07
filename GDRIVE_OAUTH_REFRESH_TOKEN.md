# Google Drive OAuth Refresh Token (OAuth Playground)

Use this guide when the Google Drive upload stops working because the refresh token
expired or needs to be regenerated.

## Prerequisites

- Google Cloud project with OAuth 2.0 client (Web application type).
- `GDRIVE_OAUTH_CLIENT_ID` and `GDRIVE_OAUTH_CLIENT_SECRET` available.

## Generate a new refresh token

1. Open the OAuth Playground: `https://developers.google.com/oauthplayground`
2. Click the gear icon (top right) and enable "Use your own OAuth credentials".
3. Paste your `GDRIVE_OAUTH_CLIENT_ID` and `GDRIVE_OAUTH_CLIENT_SECRET`.
4. In the "Select & authorize APIs" step, enter the scope:
   `https://www.googleapis.com/auth/drive`
5. Click "Authorize APIs" and complete the Google consent flow.
6. Click "Exchange authorization code for tokens".
7. Copy the `refresh_token` from the response.

## Update the local environment

Update `.env` in the project root:

```env
GDRIVE_OAUTH_CLIENT_ID=your-client-id
GDRIVE_OAUTH_CLIENT_SECRET=your-client-secret
GDRIVE_OAUTH_REFRESH_TOKEN=your-new-refresh-token
```

If you set a redirect URI for OAuth Playground in the Google Cloud Console,
keep it consistent with the OAuth Playground default:

```env
GDRIVE_OAUTH_REDIRECT_URI=https://developers.google.com/oauthplayground
```

## Notes

- Make sure the Drive API is enabled for the Google Cloud project.
- Never commit `.env` values to git.
- The `access_token` expires in about 1 hour; the `refresh_token` is what you store in `.env`.
- In Google Cloud Console, set the OAuth consent screen to **Production** to avoid the 7-day
  testing expiry. Refresh tokens can still be revoked or expire if unused or replaced.
