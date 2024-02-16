"use strict";
const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * order controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController("api::order.order", ({ strapi }) => ({
  async create(ctx) {
    const { products, userName, email } = ctx.request.body;
    try {
      // retrieve item information
      const lineItems = await Promise.all(
        products.map(async (product) => {
          const item = await strapi
            .service("api::item.item")
            .findOne(product.id);

          return {
            price_data: {
              currency: "usd",
              product_data: {
                name: item.name,
              },
              unit_amount: item.price * 100,
            },
            quantity: product.count,
          };
        })
      );

      // create a stripe session
      const session = await stripe.checkout.sessions.create({
        success_url: "http://localhost:5173/checkout/success",
        line_items: lineItems,
        mode: "payment",
        payment_method_types: ["card"],
        customer_email: email,
        cancel_url: "http://localhost:5173",
      });

      // create the item
      await strapi.service("api::order.order").create({
        data: { userName, products, stripeSessionId: session.is },
      });

      // return the session id
      return { id: session.id };
    } catch (error) {
      ctx.response.status = 500;
      return {
        error: { message: "There was a problem creating the charge" },
      };
    }
  },
}));
