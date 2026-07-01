import nodemailer from 'nodemailer';

/**
 * Send an email using SMTP credentials from environment variables.
 *
 * @param {Object}  options
 * @param {string}  options.email   – recipient address
 * @param {string}  options.subject – email subject line
 * @param {string}  options.message – HTML body of the email
 */
const sendEmail = async ({ email, subject, message }) => {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.SMTP_EMAIL,
            pass: process.env.SMTP_PASSWORD
        }
    });

    const mailOptions = {
        from: `"QuestLab" <${process.env.SMTP_EMAIL}>`,
        to: email,
        subject,
        html: message
    };

    await transporter.sendMail(mailOptions);
};

export default sendEmail;
