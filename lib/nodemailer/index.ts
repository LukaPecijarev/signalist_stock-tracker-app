import nodemailer from 'nodemailer';
import { WELCOME_EMAIL_TEMPLATE, NEWS_SUMMARY_EMAIL_TEMPLATE } from "@/lib/nodemailer/templates";
import { getFormattedTodayDate } from "@/lib/utils";

export const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.NODEMAILER_EMAIL!,
        pass: process.env.NODEMAIL_PASSWORD!,
    }
})

export const sendWelcomeEmail = async ( {email,name,intro}: WelcomeEmailData) => {
    const htmlTemplate = WELCOME_EMAIL_TEMPLATE
        .replace('{{name}}', name)
        .replace('{{intro}}', intro)

    const mailOptions = {
        from: `"Signalist" <signalist@jsmastery.pro>`,
        to: email,
        subject: `Welcome to Signalist - your stock market toolkit is ready!`,
        text: 'Thanks for joining Signalist',
        html: htmlTemplate,
    }
    await transporter.sendMail(mailOptions);
}

export const sendNewsSummaryEmail = async ({ email, name, newsContent, date }: NewsSummaryEmailData) => {
    const formattedDate = date || getFormattedTodayDate();
    const htmlTemplate = NEWS_SUMMARY_EMAIL_TEMPLATE
        .replace('{{date}}', formattedDate)
        .replace('{{newsContent}}', newsContent || 'No market news today.');

    const mailOptions = {
        from: `"Signalist" <signalist@jsmastery.pro>`,
        to: email,
        subject: `Your Daily Market Summary — ${formattedDate}`,
        text: 'Today\'s market highlights from Signalist',
        html: htmlTemplate,
    };

    await transporter.sendMail(mailOptions);
}