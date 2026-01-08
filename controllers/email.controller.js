const sendEmail = require("../utils/sendEmail");
const generateHTML = require("../utils/generateHTML");
class EmailController {
  userVerificationEmail = async (code, emailAddress) => {

    const html = generateHTML({
      emailTitle: "Verify Your user Account",
      emailSubTitle: "Use the code below to verify your email address.",
      btnText: code,
      footerNote: `You received this email because you have registered on ${process.env.APP_NAME}. If you did not initiate this action, please ignore this email.`,
    });
    await sendEmail({
      email: emailAddress,
      subject: `${process.env.APP_NAME} account verification`,
      html: html
    });
  };

  userResetPasswordEmail = async (emailAddress, code) => {

    const html = generateHTML({
      emailTitle: "Forgot Password Account",
      emailSubTitle: "Use the code below to reset your email password.",
      btnText: code,
      footerNote: `You received this email because you have registered on ${process.env.APP_NAME}. If you did not initiate this action, please ignore this email.`,
    });
    await sendEmail({
      email: emailAddress,
      subject: `${process.env.APP_NAME} password Reset`,
      html: html
    });
  };


}

module.exports = new EmailController();
