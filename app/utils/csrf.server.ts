import { createCookie } from "@remix-run/node";
import { CSRF } from 'remix-utils/csrf/server'

/**
 * The CSRF cookie is used to protect against cross-site request forgery attacks.
 * It is important to set the `httpOnly` flag to true to prevent the cookie from
 * being accessed by JavaScript. We also set the `secure` flag to true in production
 * to ensure that the cookie is only sent over HTTPS. The `sameSite` flag is set to
 * `lax` to allow the cookie to be sent in both first-party and top-level
 * navigation requests. Finally, we split the `SESSION_SECRET` environment variable
 * and use it as the secrets for the CSRF token.
 */
const cookie = createCookie('csrf', {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    secrets: process.env.SESSION_SECRET?.split(','),
})

export const csrf = new CSRF({ cookie })