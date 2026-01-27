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

  async callBack(req, res) {
    try {
      const receivedHmac = req.query.hmac || req.headers["x-hmac-sha512"];
      
      if (!receivedHmac) {
        return res.status(400).json({ success: false, message: "Missing HMAC" });
      }

      const transactionData = req.body?.obj;

      if (!transactionData) {
        return res.status(400).json({ success: false, message: "Invalid callback data" });
      }

      const nextPaymentIntention = transactionData.payment_key_claims?.next_payment_intention;
      

      let order_id;
      if (nextPaymentIntention) {
        order_id = nextPaymentIntention.split("_")[2];
      }

      if (!order_id) {
        console.error("❌ Could not extract order ID from intention");
        return res.status(400).json({ success: false, message: "Invalid order data" });
      }

      let status = "failed";
      if (transactionData.success) status = "succeeded";
      else if (transactionData.pending) status = "pending";


      const payment = await Payment.findOneAndUpdate(
        { orderCode: order_id },
        {
          $set: {
            success: transactionData.success,
            pending: transactionData.pending,
            cardNum: transactionData.data?.card_num || null,
            cardType: transactionData.data?.card_type || null,
            currency: transactionData.currency || null,
            status,
            updatedAt: Date.now(),
          },
        },
        { new: true }
      );

      if (!payment) {
        
        const allPayments = await Payment.find({}).select('orderCode').limit(10);
        
        return res.status(404).json({
          success: false,
          message: "Payment not found",
        });
      }


      if (payment.success === true) {
        const appointment = await Appointment.findById(payment.appointment);
        if (!appointment) {
          console.error("❌ Appointment not found");
          return res.status(404).json({
            success: false,
            message: "Appointment not found",
          });
        }
        
        appointment.isPaid = true;
        appointment.paymentWay = "online";
        await appointment.save();

      }

      return res.status(200).json({
        success: true,
        message: "Callback processed",
        status,
      });
    } catch (error) {
      console.error("❌ ERROR:", error);
      console.error("Stack:", error.stack);
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
}

module.exports = new PaymentClass();