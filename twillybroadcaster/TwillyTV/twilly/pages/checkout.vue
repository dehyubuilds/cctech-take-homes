<template>
  <div class="product">
    <section class="showcase">
      <div class="product-container">
        <div class="product-img">
          <img src="/images/checkout.png" alt="" srcset="" />
          <h3>Enter in Payment Details</h3>
        </div>
      </div>
    </section>
    <div class="checkout-container">
      <form @submit.prevent="pay()" class="checkout-form">
        <fieldset :class="{ 'is-disabled': loading }" class="fields">
          <div class="input-group">
            <label for="name_field">Name</label>
            <input
              placeholder="Jane Doe"
              type="text"
              name="name"
              id="name_field"
              class="stripe-input"
            />
          </div>
          <div class="input-group">
            <label for="email_field">Email</label>
            <input
              placeholder="jane.doe@example.com"
              type="email"
              name="email"
              id="email_field"
              class="stripe-input"
            />
          </div>
          <div class="input-group">
            <label for="address_field">Address</label>
            <input
              placeholder="1234 Sycamore Street"
              type="text"
              name="address"
              id="address_field"
              class="stripe-input"
            />
          </div>
          <div class="input-group">
            <label for="city_field">City</label>
            <input
              placeholder="Reno"
              type="text"
              name="city"
              id="city_field"
              class="stripe-input"
            />
          </div>
          <div class="input-group">
            <label for="state_field">State</label>
            <input
              placeholder="Nevada"
              type="text"
              name="state"
              id="state_field"
              class="stripe-input"
            />
          </div>
          <div class="input-group">
            <label for="zip_field">Zip</label>
            <input
              placeholder="89523"
              type="text"
              name="zip"
              id="zip_field"
              class="stripe-input"
            />
          </div>
          <div class="input-group">
            <label for="credit_card_field">Credit Card</label>
            <div id="payment-element" class="stripe-input"></div>
          </div>
        </fieldset>
        <div class="button-group">
          <button
            type="submit"
            class="stripe-btn"
            :class="{ 'is-disabled': loading }"
          >
            {{ loading ? "Loading..." : "Pay $10.00" }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
  

<script setup>
let stripe = null;
let elements = null;
let card = null;
let form = null;
let total = ref(1000);
let clientSecret = null;
let currentAddress = ref(null);
let loading = ref(true);

onMounted(async () => {
  loading.value = true;

  const runtimeConfig = useRuntimeConfig();
  stripe = Stripe(runtimeConfig.stripePk);

  let res = await $fetch("/api/stripe/paymentintent", {
    method: "POST",
    body: {
      amount: total.value,
    },
  });
  clientSecret = res.client_secret;

  elements = stripe.elements({
    mode: "payment",
    amount: 1000,
    currency: "usd",
  });

  const paymentElement = elements.create("payment");
  paymentElement.mount("#payment-element");

  loading.value = false;
});

const pay = async () => {
  if (formData.address === "") {
    showError("Please add shipping address");
    return;
  }
  loading.value = true;

  const result = await stripe.confirmCardPayment(clientSecret, {
    payment_method: { card: card },
  });

  if (result.error) {
    showError(result.error.message);
    loading.value = false;
  } else {
    await createOrder(result.paymentIntent.id);
    setTimeout(() => {
      return navigateTo("/success");
    }, 500);
  }
};

const createOrder = async (stripeId, formData) => {
  await useFetch("/api/stripe/create-order", {
    method: "POST",
    body: {
      stripeId: stripeId,
      name: formData.name,
      address: formData.address,
      zipcode: formData.zip,
      city: formData.city,
      country: "US",
    },
  });
};

const showError = (errorMsgText) => {
  const errorMsg = document.querySelector("#card-error");

  errorMsg.textContent = errorMsgText;
  setTimeout(() => {
    errorMsg.textContent = "";
  }, 4000);
};
</script>

<style>
.product-container {
  border: 1px solid #ccc;
  padding: 20px;
  border-radius: 5px;
  background-color: #f7f7f7;
}
.product {
  margin-top: -50px;
}

.product-img {
  text-align: center;
  margin-top: 10px;
  position: relative;
}

.product-img h3 {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #fff;
  background-color: rgba(0, 0, 0, 0.7);
  padding: 5px 10px;
  border-radius: 5px;
}

.product-img img {
  display: block;
  width: 100%;
  height: auto;
}

.checkout-container {
  margin-top: 20px;
  max-width: 400px;
  margin-left: auto;
  margin-right: auto;
}

.fields {
  border: none;
}

.input-group {
  margin-bottom: 15px;
}

.stripe-input {
  width: 100%;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 5px;
  font-size: 14px;
  box-sizing: border-box;
}

.button-group {
  margin-top: 20px;
  text-align: center;
}

.stripe-btn {
  background-color: #5469d4;
  color: #fff;
  padding: 10px 20px;
  border: none;
  border-radius: 5px;
  font-size: 16px;
  cursor: pointer;
}

.stripe-btn:hover {
  background-color: #455bcd;
}

.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Larger screen Styles */
@media (min-width: 768px) {
  .product-img img {
    width: 20%; /* Adjust the width of the image for larger screens */
    margin: 0 auto; /* Center the image horizontally */
  }
}

/* Mobile Styles */
@media (max-width: 480px) {
  .checkout-container {
    padding: 0 10px;
  }

  .stripe-input {
    width: calc(100% - 20px); /* Adjusting width for smaller screens */
  }
}
</style>

