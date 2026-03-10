// @ts-nocheck
import { app } from '../src/worker/index.js';

export const config = {
    runtime: 'edge',
};

export default function handler(req) {
    return app.fetch(req, {
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_KEY: process.env.SUPABASE_KEY,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
        MOCHA_USERS_SERVICE_API_URL: process.env.MOCHA_USERS_SERVICE_API_URL,
        MOCHA_USERS_SERVICE_API_KEY: process.env.MOCHA_USERS_SERVICE_API_KEY,
    });
}
