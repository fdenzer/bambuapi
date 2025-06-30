import { json } from '@sveltejs/kit';

/** @type {import('./$types').RequestHandler} */
export async function GET({ locals }) {
    // event.locals.user is populated by hooks.server.js
    if (locals.user && locals.user.isAuthenticated) {
        return json({
            isAuthenticated: true,
            email: locals.user.email, // Send back email if available
            // Do NOT send back the token itself to the client here for security.
            // The client doesn't need it directly if HTTPOnly cookie is used for API calls.
        });
    } else {
        return json({ isAuthenticated: false });
    }
}
