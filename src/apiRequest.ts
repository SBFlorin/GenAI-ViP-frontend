import { API_HOST, API_PATH } from './apiConfig';

const baseUrl = `${API_HOST}${API_PATH}`;

export async function apiRequest(endpoint: string, options: RequestInit = {}) {
    const token = localStorage.getItem('auth_token');
    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(options.headers || {})
    };
    const response = await fetch(`${baseUrl}${endpoint}`, { ...options, headers });
    let data;
    try {
        data = await response.json();
    } catch {
        data = {};
    }
    if (!response.ok) {
        console.error(`API Error: ${response.status} ${response.statusText} at ${baseUrl}${endpoint}`);
        // Only throw for 'error' attribute, fallback to generic message
        const errorMsg = data.error || `API request failed: ${response.status} ${response.statusText}`;
        throw new Error(errorMsg);
    }
    // Also handle process errors in successful responses
    if (data.error) {
        throw new Error(data.error);
    }
    return data;
}
