import { Inngest } from "inngest"

export const inngest = new Inngest({
    id: 'signalist',
    ai: { gemini: { apiKey: process.env.GENERAL_API_KEY! } },
})