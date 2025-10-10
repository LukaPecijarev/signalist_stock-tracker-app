import {inngest} from "@/lib/inngest/client";
import {NEWS_SUMMARY_EMAIL_PROMPT, PERSONALIZED_WELCOME_EMAIL_PROMPT} from "@/lib/inngest/prompts";
import {sendWelcomeEmail, sendNewsSummaryEmail} from "@/lib/nodemailer";
import {getAllUsersForNewsEmail} from "@/lib/actions/user.actions";
import { getWatchlistSymbolsByEmail } from "@/lib/actions/watchlist.actions";
import { getNews } from "@/lib/actions/finnhub.actions";
import {formatDateToday} from "@/lib/utils";

export const sendSignUpEmail = inngest.createFunction(
    { id: 'sign-up-email' },
    { event: 'app/user.created'},
    async ({ event, step}) => {
        const userProfile = `
            - Country: ${event.data.country}
            - Investment goals: ${event.data.investmentGoals}
            - Risk tolerance: ${event.data.RiskTolerance}
            - Preferred industry: ${event.data.preferredIndustry}
        `

        const prompt = PERSONALIZED_WELCOME_EMAIL_PROMPT.replace('{{userProfile}}',userProfile)

        const response = await step.ai.infer('generate-welcome-intro', {
            model: step.ai.models.gemini({ model: 'gemini-2.5-flash-lite' }),
                body: {
                    contents: [
                        {
                        role: 'user',
                        parts: [
                            { text: prompt }
                        ]
                    }]
            }
        })
        await step.run('send-welcome-email', async () => {
            const part = response.candidates?.[0]?.content?.parts?.[0];
            const introText = (part && 'text' in part ? part.text : null) || 'Thanks for joining Signalist. You now have the tools to track markets and make smarter moves.'

            const {data: {email,name}} = event;
            return await sendWelcomeEmail({
                email,name,intro: introText
            });
        })
        return {
            success: true,
            message: 'Welcome email sent successfully'
        }
    }
)

export const sendDailyNewsSummary = inngest.createFunction(
    { id: 'daily-news-summary' },
    [ { event: 'app/send.daily.news'}, {cron: '0 12 * * *' } ],
    async ({ step }) => {
        // Step #1: Get all users for news delivery
        const users = await step.run('get-all-users', getAllUsersForNewsEmail);
        if (!users || users.length === 0) {
            return { success: true, message: 'No users found for news email' };
        }

        // Step #2: For each user, get their watchlist symbols and fetch news
        const perUserNews = await step.run('fetch-user-news', async () => {
            const results: { userId: string; email: string; name: string; news: MarketNewsArticle[] }[] = [];

            for (const u of users) {
                try {
                    const symbols = await getWatchlistSymbolsByEmail(u.email);
                    let news = await getNews(symbols);
                    if (!news || news.length === 0) {
                        // fallback to general market news
                        news = await getNews();
                    }
                    // Cap at 6 items per spec (getNews already caps, but ensure)
                    news = (news || []).slice(0, 6);
                    results.push({ userId: u.id, email: u.email, name: u.name, news });
                } catch (e) {
                    console.error(`Error processing news for user ${u.email}:`, e);
                    results.push({ userId: u.id, email: u.email, name: u.name, news: [] });
                }
            }

            return results;
        });

        // Step #3: Summarize news via AI
        const userNewsSummaries: { userId: string; email: string; name: string; newsContent: string | null }[] = []

        for(const { userId, email, name, news } of perUserNews){
            try{
                const prompt = NEWS_SUMMARY_EMAIL_PROMPT.replace('{{newsData}}', JSON.stringify(news, null, 2));

                const response = await step.ai.infer(`summarize-news-${email}`, {
                    model: step.ai.models.gemini({ model: 'gemini-2.5-flash-lite' }),
                    body: {
                        contents: [{role: 'user', parts: [{ text: prompt }]}]
                    }
                });
                const part = response.candidates?.[0]?.content?.parts?.[0];
                const newsContent = (part && 'text' in part ? part.text : null) || 'No market news.';

                userNewsSummaries.push({ userId, email, name, newsContent });
            } catch(e) {
                console.error('Failed to summarize news for:', email);
                userNewsSummaries.push({ userId, email, name, newsContent: null });
            }
        }

        // Step #4: Send the emails
        await step.run('send-news-emails', async () => {
            await Promise.all(
                userNewsSummaries.map(async ({ userId, email, name, newsContent }) => {
                    if(!newsContent) return false;
                    return await sendNewsSummaryEmail({
                        email,
                        name,
                        date: formatDateToday,
                        newsContent
                    })
                })
            )
        });

        return { success: true, message: 'Daily news summary emails sent successfully' };
    }
)