import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

class EmailService {
    private transporter: nodemailer.Transporter | null = null;

    constructor() {
        if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
            this.transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: parseInt(process.env.SMTP_PORT || '587'),
                secure: process.env.SMTP_SECURE === 'true',
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                },
            });
            console.log('📧 EmailService: SMTP Transport initialized');
        } else {
            console.log('📧 EmailService: No SMTP credentials found. Running in Developer Mode (Logging codes to console).');
        }
    }

    async sendTwoFactorCode(email: string, code: string): Promise<boolean> {
        if (!this.transporter) {
            // Developer Mode
            console.log('\n==================================================');
            console.log(`🔐 2FA CODE For [${email}]: ${code}`);
            console.log('==================================================\n');
            return true;
        }

        try {
            await this.transporter.sendMail({
                from: process.env.SMTP_FROM || '"Aether Security" <security@aether.com>',
                to: email,
                subject: 'Your Verification Code',
                text: `Your verification code is: ${code}\n\nThis code will expire in 5 minutes.`,
                html: `
                    <div style="font-family: sans-serif; padding: 20px; color: #333;">
                        <h2>Verification Code</h2>
                        <p>Use the following code to complete your login:</p>
                        <div style="background: #f4f4f4; padding: 15px; border-radius: 5px; font-size: 24px; letter-spacing: 5px; font-weight: bold; text-align: center; margin: 20px 0;">
                            ${code}
                        </div>
                        <p style="color: #666; font-size: 14px;">This code will expire in 5 minutes.</p>
                    </div>
                `,
            });
            console.log(`📧 EmailService: Sent 2FA code to ${email}`);
            return true;
        } catch (error) {
            console.error('📧 EmailService: Failed to send email', error);
            return false;
        }
    }
}

export default new EmailService();
