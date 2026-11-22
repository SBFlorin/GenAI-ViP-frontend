import { API_HOST, API_PATH } from './apiConfig';

export async function downloadAuthenticatedCsv(apiPath: string, filename: string) {
  const token = localStorage.getItem('auth_token');
  const response = await fetch(`${API_HOST}${API_PATH}${apiPath}`, {
    method: 'GET',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });

  if (!response.ok) {
    let message = `Download failed (${response.status})`;
    try {
      const data = await response.json();
      if (data.error) message = data.error;
    } catch {
      // not JSON
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
