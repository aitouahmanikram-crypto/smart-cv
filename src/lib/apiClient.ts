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
  try {
    const response = await fetch(url, options);
    
    // If it's a 404 in development, try mock data
    if (response.status === 404 && import.meta.env.DEV) {
      console.warn(`API route ${url} not found (404). Using mock fallback.`);
      return getMockData(url, options);
    }

    const data = await safeJson(response);

    if (!response.ok) {
      throw new Error(data.error || data.message || `Request failed: ${response.status}`);
    }

    return data;
  } catch (error: any) {
    // If network error in dev, also try mock data
    if (import.meta.env.DEV) {
      console.warn(`Network error for ${url}. Using mock fallback.`, error);
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
