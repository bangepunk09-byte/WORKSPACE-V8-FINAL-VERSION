import { getAccessToken } from './auth';

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

export const listEvents = async () => {
  const token = await getAccessToken();
  if (!token) throw new Error('No access token');
  
  const response = await fetch(`${CALENDAR_API_BASE}/calendars/primary/events`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  
  if (!response.ok) throw new Error('Failed to fetch events');
  return response.json();
};

export const createEvent = async (event) => {
  const token = await getAccessToken();
  if (!token) throw new Error('No access token');
  
  const response = await fetch(`${CALENDAR_API_BASE}/calendars/primary/events`, {
    method: 'POST',
    headers: { 
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(event),
  });
  
  if (!response.ok) throw new Error('Failed to create event');
  return response.json();
};
