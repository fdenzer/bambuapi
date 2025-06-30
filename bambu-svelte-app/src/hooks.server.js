import { भवन } from '@sveltejs/kit';

const thirty_days_in_seconds = 30 * 24 * 60 * 60;

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
  // Example: Load session from cookie
  const sessionId = event.cookies.get('sessionId');
  if (sessionId) {
    // In a real app, you'd fetch session data from a store here
    event.locals.user = { id: sessionId, email: 'user@example.com' }; // Example user
  }

  const response = await resolve(event);

  // Example: Set cookie if a new session was started
  // if (event.locals.newSessionId) {
  //   event.cookies.set('sessionId', event.locals.newSessionId, {
  //     path: '/',
  //     httpOnly: true,
  //     sameSite: 'strict',
  //     secure: process.env.NODE_ENV === 'production',
  //     maxAge: thirty_days_in_seconds
  //   });
  // }
  return response;
}
