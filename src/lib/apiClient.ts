export async function safeJson(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error: text || "Invalid JSON response" };
  }
}

export async function apiFetch(url: string, options: RequestInit = {}) {
  // Map old URLs to new grouped URLs
  let finalUrl = url;
  if (url.startsWith('/api/auth/login')) finalUrl = '/api/auth?action=login';
  else if (url.startsWith('/api/auth/register')) finalUrl = '/api/auth?action=register';
  else if (url.startsWith('/api/auth/me')) finalUrl = '/api/auth?action=me';
  else if (url.startsWith('/api/auth/logout')) finalUrl = '/api/auth?action=logout';
  else if (url.startsWith('/api/profile/update')) finalUrl = '/api/profile?action=update';
  else if (url.startsWith('/api/dashboard/stats')) finalUrl = '/api/dashboard?action=stats';
  else if (url.startsWith('/api/cvs/upload')) finalUrl = '/api/cvs?action=upload';
  else if (url.startsWith('/api/cvs/rewrite')) finalUrl = '/api/cvs?action=rewrite';
  else if (url === '/api/cvs') finalUrl = '/api/cvs?action=list';
  else if (url.startsWith('/api/cvs/')) {
    const parts = url.split('/');
    if (parts.length >= 4) {
      if (parts[parts.length-1] === 'restore') {
        finalUrl = `/api/cvs?action=restore&cvId=${parts[3]}&versionId=${parts[5]}`;
      } else if (parts[parts.length-1] === 'versions') {
        finalUrl = `/api/cvs?action=versions&cvId=${parts[3]}`;
      }
    }
  }
  else if (url === '/api/jobs') finalUrl = '/api/jobs?action=list';
  else if (url.startsWith('/api/jobs/search')) finalUrl = '/api/jobs?action=search';
  else if (url === '/api/matches') finalUrl = '/api/matches?action=list';
  else if (url.startsWith('/api/matches/')) {
    const parts = url.split('/');
    if (parts.length >= 4) {
      if (parts[2] === 'save') {
        finalUrl = `/api/matches?action=save&id=${parts[3]}`;
      }
    }
  }
  else if (url.startsWith('/api/matches/analyze')) finalUrl = '/api/matches?action=analyze';
  else if (url.startsWith('/api/matches/custom')) finalUrl = '/api/matches?action=custom';
  else if (url.startsWith('/api/matches/saved')) finalUrl = '/api/matches?action=saved';
  else if (url === '/api/history') finalUrl = '/api/history?action=list';
  else if (url.startsWith('/api/history/')) {
    const parts = url.split('/'); // /api/history/[type]/[id]
    if (parts.length >= 5) {
      finalUrl = `/api/history?action=delete&type=${parts[3]}&id=${parts[4]}`;
    }
  }
  else if (url === '/api/career-advice') finalUrl = '/api/career-advice?action=list';
  else if (url.startsWith('/api/career-advice/generate')) finalUrl = '/api/career-advice?action=generate';
  else if (url.startsWith('/api/career-advice/')) {
    const parts = url.split('/');
    finalUrl = `/api/career-advice?action=get&cvId=${parts[parts.length-1]}`;
  }
  else if (url === '/api/cover-letters') finalUrl = '/api/cover-letters?action=list';
  else if (url.startsWith('/api/cover-letters/generate')) finalUrl = '/api/cover-letters?action=generate';
  else if (url.startsWith('/api/settings/language')) finalUrl = '/api/settings?action=language';
  else if (url.startsWith('/api/admin/stats')) finalUrl = '/api/admin?action=stats';
  else if (url.startsWith('/api/admin/users')) {
    const parts = url.split('/');
    if (parts.length >= 5) {
      if (parts[parts.length-1] === 'reset-password') {
        finalUrl = `/api/admin?action=reset-password&id=${parts[4]}`;
      } else {
        finalUrl = `/api/admin?action=users&id=${parts[4]}`;
      }
    } else {
      finalUrl = '/api/admin?action=users';
    }
  }
  else if (url.startsWith('/api/admin/jobs')) {
    const parts = url.split('/');
    if (parts.length >= 5) {
      finalUrl = `/api/admin?action=jobs&id=${parts[4]}`;
    } else {
      finalUrl = '/api/admin?action=jobs';
    }
  }
  else if (url.startsWith('/api/admin/settings')) finalUrl = '/api/admin?action=settings';
  else if (url.startsWith('/api/admin/seed-demo')) finalUrl = '/api/admin?action=seed';

  console.log(`[apiFetch] Request: ${options.method || 'GET'} ${url} -> ${finalUrl}`, { body: !!options.body });

  try {
    const response = await fetch(finalUrl, options);
    
    // If it's a 404 in development, try mock data
    if (response.status === 404 && import.meta.env.DEV) {
      console.warn(`API route ${finalUrl} not found (404). Using mock fallback.`);
      return getMockData(url, options);
    }

    const data = await safeJson(response);

    if (!response.ok) {
      throw new Error(data.error || data.message || `Request failed: ${response.status}`);
    }

    // Unpack data if it follows the { success, data } format
    if (data && typeof data === 'object' && 'success' in data) {
      if (data.success) {
        return data.data !== undefined ? data.data : data;
      } else {
        throw new Error(data.error || "Operation failed");
      }
    }

    return data;
  } catch (error: any) {
    // If network error in dev, also try mock data
    if (import.meta.env.DEV) {
      console.warn(`Network error for ${finalUrl}. Using mock fallback.`, error);
      return getMockData(url, options);
    }
    throw error;
  }
}

function getMockData(url: string, options: RequestInit) {
  const method = options.method || 'GET';
  
  // Auth mocks
  if (url.includes('/api/auth/login') || url.includes('/api/auth/register')) {
    return {
      token: 'mock-token-' + Date.now(),
      user: {
        id: 'mock-user-1',
        email: 'mock@example.com',
        fullName: 'Mock User',
        role: 'user'
      }
    };
  }
  
  if (url.includes('/api/auth/me')) {
    return {
      id: 'mock-user-1',
      email: 'mock@example.com',
      fullName: 'Mock User',
      role: 'user'
    };
  }

  // Dashboard / Stats
  if (url.includes('/api/dashboard/stats') || url.includes('/api/admin/stats')) {
    return {
      cvsCount: 12,
      lettersCount: 8,
      matchesCount: 25,
      interviewsCount: 3,
      averageScore: 82,
      cvs: [],
      letters: [],
      matches: [],
      recentActivity: []
    };
  }

  // Lists
  if (url.includes('/api/cvs') || url.includes('/api/jobs') || url.includes('/api/matches') || url.includes('/api/history') || url.includes('/api/career-advice')) {
    return [];
  }

  // Single items / Objects
  if (url.match(/\/api\/[^\/]+\/[^\/]+$/)) {
    return {};
  }

  // Default success for actions
  return { success: true };
}
