<template>
  <main>
    <!-- heading -->
    <header>
      <img
        src="https://theprivatecollection.s3.us-east-2.amazonaws.com/twillyicon.png"
        alt="twilly logo"
        class="logo-image"
      />
      <h1>GUIDE</h1>
      <!-- Add the links under the guide title -->

    </header>
    <div class="guide-links">
        <nuxt-link to="/faq" class="guide-link">FAQs</nuxt-link>
        <span class="separator">|</span>
        <nuxt-link to="/usage-examples" class="guide-link"
          >Usage Examples</nuxt-link
        >
      </div>

    <div class="faq-list">
      <div class="faq-item" v-for="(faq, index) in faqs" :key="index">
        <h2>{{ faq.question }}</h2>
        <p v-if="faq.link">
          <nuxt-link :to="faq.link">{{ faq.answer }}</nuxt-link>
        </p>
        <p v-else>
          <span :class="{ 'get-started-text': faq.isGetStarted }">{{
            faq.answer
          }}</span>
        </p>
      </div>
    </div>
  </main>
</template>
    
  <script setup>
const faqs = ref([
  {
    question: "What is Twilly?",
    answer:  "Twilly is a collaborative content-sharing platform where users can upload content to specific groups, provide descriptions, and utilize a messaging feature to schedule and send the content to others at designated times. It combines content management with scheduled messaging for effective communication and sharing.",
    isGetStarted: false,
  },
  {
    question: "How do I schedule a message?",
    answer: "To schedule, use the new message form on the main page. Enter the details and submit the form. You can use natural language when setting reminder times. As an example, you could set a reminder time by entering 2 hours, in 20 minutes, on Nov 3rd at 3:30am, 5:30 pm today, now, etc.",
    isGetStarted: false,
  },
  {
    question: "Can I filter messages?",
    answer:
      "Yes, you can filter reminders based on all reminders or your favorite reminders. Use the filter buttons to switch between views.",
    isGetStarted: false,
  },
  {
    question: "How do I start using Twilly?",
    answer: "Set up your profile to get started.",
            link: "/account",
    isGetStarted: true, // Ensure this is set to true
  },
]);
</script>
    
  <style scoped>
main {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

header {
  text-align: center;
  margin-bottom: 30px;
}

h1 {
  font-size: 2rem;
  color: #4299e1;
}

.logo-image {
  width: 100px;
  height: auto;
}

.faq-list {
  border-top: 2px solid #e2e8f0;
}

.faq-item {
  margin-bottom: 20px;
  padding: 15px;
  border-bottom: 1px solid #e2e8f0;
}

.faq-item:last-child {
  border-bottom: none;
}

.faq-item h2 {
  font-size: 1.5rem;
  color: #2d3748;
  margin-bottom: 10px;
}

.get-started-text {
  font-size: 1rem;
  color: red;
}
.get-started-link {
  font-size: 1rem;
  color: red; /* Set the color to #4299e1 */
}

/* Hover effect for FAQ items */
.faq-item:hover {
  background-color: #f7fafc;
  transition: background-color 0.3s ease-in-out;
}

.guide-links {
  text-align: center;
  margin-top: 10px;
  
}


.guide-link {
  margin: 0 10px;
  color: #4299e1; /* Set the link color */
}

.separator {
  margin: 0 5px;
  color: #4299e1; /* Set the separator color */
}
</style>