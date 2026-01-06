const sendEmail = require("../utils/sendEmail");
const generateHTML = require("../utils/generateHTML");
class EmailController {
  userVerificationEmail = async (code, emailAddress) => {

    const html = generateHTML({
      link: process.env.LANDING_URL,
      emailTitle: "Verify Your user Account",
      emailSubTitle: "Use the code below to verify your email address.",
      btnText: code,
      belowText: "Visit our website:",
      belowLink: process.env.LANDING_URL,
      footerNote: `You received this email because you have registered on ${process.env.APP_NAME}. If you did not initiate this action, please ignore this email.`,
      footerLink: process.env.APP_NAME
    });
    await sendEmail({
      email: emailAddress,
      subject: `${process.env.APP_NAME} account verification`,
      html: html
    });
  };

  userResetPasswordEmail = async (emailAddress, code) => {

    const html = generateHTML({
      link: process.env.LANDING_URL,
      emailTitle: "Forgot Password Account",
      emailSubTitle: "Use the code below to reset your email password.",
      btnText: code,
      belowText: "Visit our website:",
      belowLink: process.env.LANDING_URL,
      footerNote: `You received this email because you have registered on ${process.env.APP_NAME}. If you did not initiate this action, please ignore this email.`,
      footerLink: process.env.APP_NAME
    });
    await sendEmail({
      email: emailAddress,
      subject: `${process.env.APP_NAME} password Reset`,
      html: html
    });
  };

  userForgotPasswordEmail = async (code, emailAddress) => {
    const html = generateHTML({
      emailTitle: `Reset your ${process.env.APP_NAME} account password`,
      emailSubTitle: "Use the code below to reset your account password.",
      btnText: code,
      footerNote: `You are receiving this email because a request to reset the password for your ${process.env.APP_NAME} account has been initiated. If you did not initiate this action, please disregard this message.`
    });
    await sendEmail({
      email: emailAddress,
      subject: `${process.env.APP_NAME} reset account password`,
      html: html
    });
  };

}

module.exports = new EmailController();
