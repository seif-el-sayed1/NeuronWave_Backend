const generateHTML = ({
    link = process.env.FRONTEND_URL,
    logo = process.env.LOGO_URL,
    primaryColor = "#0295f7",
    primaryDark = "#2681ff",
    primaryLight = "#00b7db",
    secondaryColor = "#ffffff",
    backgroundColor = "#F4F6F8",
    emailTitle,
    emailSubTitle,
    btnText,
    btnLink,
    belowText,
    belowLink,
    footerNote,
    footerLink
}) => {
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Email</title>

      <style>
        body {
          margin: 0;
          padding: 0;
          background: ${backgroundColor};
          font-family: 'Arial', sans-serif;
        }

        .container {
          width: 100%;
          max-width: 600px;
          margin: 20px auto;
          background: ${secondaryColor};
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 8px 20px rgba(0,0,0,0.08);
        }

        .logo {
          text-align: center;
          padding: 20px 0;
        }

        .logo img {
          width: 180px; 
        }

        .header {
          padding: 15px 20px 5px;
          border-top: 4px solid ${primaryColor};
          text-align: center;
        }

        .header h1 {
          margin: 0;
          font-size: 22px;
          color: #222;
          font-weight: bold;
        }

        .content {
          padding: 10px 20px;
          color: #444;
          font-size: 15px;
          line-height: 22px;
          text-align: center;
        }

        .button-wrapper {
          text-align: center;
          padding: 10px 20px 20px;
        }

        .button {
          background: ${primaryColor};
          color: #fff !important;
          padding: 12px 28px;
          font-size: 16px;
          border-radius: 8px;
          text-decoration: none;
          display: inline-block;
          font-weight: bold;
          transition: 0.2s;
        }

        .button:hover {
          background: ${primaryDark};
        }

        .below {
          padding: 0 20px 15px;
          font-size: 14px;
          line-height: 20px;
          color: #444;
          text-align: center;
        }

        .below a {
          color: ${primaryColor};
          font-weight: bold;
          text-decoration: underline;
        }

        .thank-you {
          border-top:1px solid #eee;
          padding: 10px 20px 5px;
          font-size: 14px;
          line-height: 20px;
          text-align: center;
          color: #444;
        }

        .footer {
          text-align: center;
          padding: 5px 20px 15px;
          font-size: 13px;
          color: #777;
        }

        .footer a {
          color: ${primaryColor};
          text-decoration: none;
        }

      </style>
    </head>

    <body>

      <div class="container">

        <div class="logo">
          <a href="${link}" target="_blank">
            <img src="${logo || 'https://via.placeholder.com/180x60?text=Logo'}" alt="Logo">
          </a>
        </div>

        <div class="header">
          <h1>${emailTitle}</h1>
        </div>

        <div class="content">
          <p>${emailSubTitle}</p>
        </div>

        ${
          btnText || btnLink
            ? `
              <div class="button-wrapper">
                ${
                  btnLink
                    ? `<a href="${btnLink}" class="button" target="_blank">${btnText}</a>`
                    : `<div class="button">${btnText}</div>`
                }
              </div>` 
            : ""
        }

        ${
          belowText || belowLink
            ? `
            <div class="below">
              ${belowText ? `<p>${belowText}</p>` : ""}
              ${
                belowLink
                  ? `<a href="${belowLink}" target="_blank">${belowLink}</a>`
                  : ""
              }
            </div>` 
            : ""
        }

        <div class="content thank-you">
          <p>Thank you,<br>${process.env.APP_NAME}</p>
        </div>

        <div class="footer">
          <p>${footerNote || ""}</p>
          ${
            footerLink
              ? `<a href="${footerLink}" target="_blank">${footerLink}</a>`
              : ""
          }
        </div>

      </div>

    </body>
    </html>
    `;

    return html;
};

module.exports = generateHTML;
