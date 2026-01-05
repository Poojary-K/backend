# Angular -> Backend Link

Backend base URL (Render):
- `https://backend-kmy4.onrender.com`

Health check:
- `https://backend-kmy4.onrender.com/health`

API base URL (use this for API calls):
- `https://backend-kmy4.onrender.com/api`

## Angular config (recommended)

Update your Angular environment files:

```ts
// src/environments/environment.ts
export const environment = {
  production: false,
  apiBaseUrl: 'https://backend-kmy4.onrender.com/api',
};
```

```ts
// src/environments/environment.prod.ts
export const environment = {
  production: true,
  apiBaseUrl: 'https://backend-kmy4.onrender.com/api',
};
```

Example usage in a service:

```ts
import { HttpClient } from '@angular/common/http';
import { environment } from '../environments/environment';

export class ApiService {
  private readonly baseUrl = environment.apiBaseUrl;

  constructor(private readonly http: HttpClient) {}

  listCauses() {
    return this.http.get(`${this.baseUrl}/causes`);
  }
}
```

Notes:
- If you use a different Angular project or a custom domain later, only `apiBaseUrl` needs to change.
- CORS is currently open on the backend (`origin: true`). If you want to lock it down, share the Netlify domain and I can update the allowlist.
