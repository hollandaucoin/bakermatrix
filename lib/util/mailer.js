// import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'
// import Helpers from './helpers.js'

// // Verify and set up AWS SES Client
// if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_VERIFIED_EMAIL) {
//   throw new Error('AWS credentials not provided')
// }
// const sesClient = new SESClient({ region: 'us-west-1' })
// const suffix = process.env.NODE_ENV === 'production' ? '' : ' - DEV ENV';

// const Mailer = {};

// // Send email
// Mailer.sendEmail = async (params) => {
//   try {
//     const emailParams = formatEmailParams(params);
//     const command = new SendEmailCommand(emailParams);
//     return await sesClient.send(command);
//   } catch (err) {
//     throw new Error(`Error sending email: ${err.message}`)
//   }
// }


// /**
//  * Helper functions
//  */

// // Format email parameters
// function formatEmailParams ({ emailAddress, subject, body } = {}) {
//   if (typeof emailAddress !== 'string' || typeof subject !== 'string' || typeof body !== 'string') {
//     throw new Error('Missing or invalid email parameters')
//   }
//   if (!Helpers.isValidEmail(emailAddress)) { throw new Error('Invalid email address') }

//   return {
//     Destination: { ToAddresses: [emailAddress] },
//     Message: { Subject: { Data: subject + suffix }, Body: { Text: { Data: body }, } },
//     Source: process.env.AWS_VERIFIED_EMAIL,
//   }
// }

// export default Mailer;
