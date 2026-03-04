<template>
  <footer class="footer">
    <div class="footer-content">
      <div class="footer-logo">
        <h3 class="text-teal-400 font-bold text-xl">Twilly</h3>
        <p class="text-gray-400 text-sm">A social streaming network</p>
      </div>
      
      <nav class="footer-nav">
        <div class="footer-links">
          <a href="/legal/terms-of-service#introduction" class="footer-link">
            Terms of Service
          </a>
          <a href="/legal/privacy-policy#introduction" class="footer-link">
            Privacy Policy
          </a>
          <a href="/legal/community-guidelines#introduction" class="footer-link">
            Community Guidelines
          </a>
          <a href="/legal/copyright-policy#introduction" class="footer-link">
            Copyright Policy
          </a>
          <a href="/legal/creator-terms#introduction" class="footer-link">
            Creator Terms
          </a>
          <a href="/legal/refund-policy#introduction" class="footer-link">
            Refund Policy
          </a>
        </div>
      </nav>
      
      <div class="footer-bottom">
        <p class="text-gray-500 text-sm">
          © 2025 Twilly. All rights reserved.
        </p>
      </div>
    </div>
  </footer>
</template>

<script setup>
// Footer component for global use
</script>

<style scoped>
.footer {
  background: #000000;
  color: white;
  padding: 2rem 0 1rem 0;
  margin-top: auto;
  margin-bottom: 0;
  border-top: 1px solid rgba(20, 184, 166, 0.3);
}

.footer-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
  text-align: center;
}

.footer-logo {
  margin-bottom: 1.5rem;
}

.footer-logo h3 {
  margin-bottom: 0.5rem;
}

.footer-nav {
  margin-bottom: 1.5rem;
}

.footer-links {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 1.5rem;
  margin-bottom: 1rem;
}

.footer-link {
  color: #14b8a6;
  text-decoration: none;
  font-weight: 500;
  font-size: 0.875rem;
  transition: all 0.3s ease;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
}

.footer-link:hover {
  color: #06b6d4;
  text-decoration: underline;
  transform: translateY(-1px);
}

.footer-bottom {
  border-top: 1px solid rgba(20, 184, 166, 0.2);
  padding-top: 1rem;
}

/* Mobile responsive */
@media (max-width: 768px) {
  .footer-links {
    flex-direction: column;
    gap: 0.75rem;
  }
  
  .footer-link {
    font-size: 0.8rem;
  }
  
  .footer {
    padding: 1.5rem 0 1rem 0;
  }
}

/* Tablet responsive */
@media (min-width: 769px) and (max-width: 1024px) {
  .footer-links {
    gap: 1rem;
  }
}
</style> 