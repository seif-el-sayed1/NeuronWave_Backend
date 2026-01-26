const crypto = require("crypto");
const axios = require("axios");
const Payment = require("../models/payment.model");
const Appointment = require("../models/appointment.model");

class PaymentClass {
  async createClientSecretKey(appointment, user) {
    return new Promise(async (resolve, reject) => {
      try {
        const amount = 100 * 100;
        let items = [
          {
            name: "Appointment Fees",
            description: "It's Appointment Fees",
            quantity: 1,
            amount: 100 * 100,
          },
        ];
        let paymobIntegrationId = Number(process.env.PAYMOB_INTEGRATION_ID);
        // Get user_id from the authenticated user's session
        const user_id = user._id; // Replace with actual user identifier
        let address = {};
        const requestBody = {
          amount,
          currency: "EGP",
          payment_methods: [paymobIntegrationId],
          items,
          billing_data: {
            first_name: user.fullName.split(" ")[0],
            last_name: user.fullName.split(" ")[1],
            email: user.email,
            phone_number: user.phone || "NA",
            apartment: address?.apartment || 1,
            floor: address?.floor || 1,
            street: address?.street || 1,
            building: address?.building || 1,
            city: user.city?.nameEn || "NA",
            state: user.region?.nameEn || "NA",
            country: "Egypt",
            postal_code: address?.postalCode || "NA",
            promoCodeApplied: "NA",
          },
          customer: {
            first_name: user.fullName.split(" ")[0],
            last_name: user.fullName.split(" ")[1],
            email: user.email,
            extras: {
              re: "22",
            },
          },
          extras: {
            ee: 22,
          },
        };
        const secretKey = process.env.PAYMOB_SECRET_KEY;
        const response = await axios.post(
          "https://accept.paymob.com/v1/intention/",
          requestBody,
          {
            headers: { Authorization: `Token ${secretKey}` },
          },
        );
        /*
          Intention API Changes order_id, so that I've figured a way to store the order_id
          to be shared between intention response and request body of the callback.
        */
        const transaction = await Payment.create({
          appointment: appointment._id,
          orderCode: response.data.id.split("_")[2],
          user: user_id,
          amount: amount / 100,
          billedAmount: amount,
          status: "pending",
          clientSecret: response.data.client_secret, // You might update this based on payment status
        });
        // Resolve the promise with the necessary data
        resolve({ transaction, clientSecret: response.data.client_secret });
      } catch (error) {
        reject(error);
      }
    });
  }

  async processed(req, res) {
    try {
      res.status(201).json({ data: req.data, message: "processed" });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  async response(req, res) {
    try {
      res.status(201).json({
        data: req.data,
        message: "response",
        success: req.query.success,
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

}

module.exports = new PaymentClass();
