/**
 * HSMLE India Corporation - Contact & Support Module
 * Handles contact enquiries, map links, and phone/email click actions.
 */

const ContactPage = {
  init() {
    const form = document.getElementById('main-contact-form');
    if (form) {
      form.addEventListener('submit', (e) => this.handleSubmit(e));
    }
  },

  async handleSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');

    const payload = {
      full_name: form.full_name.value.trim(),
      company_name: form.company_name.value.trim(),
      email: form.email.value.trim(),
      phone: form.phone.value.trim(),
      city: form.city ? form.city.value.trim() : null,
      country: 'India',
      subject: form.subject ? form.subject.value.trim() : 'General Business Consultation',
      message: form.message.value.trim(),
    };

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `
          <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg> Sending Message...
        `;
      }

      const res = await window.API.submitEnquiry(payload);
      form.reset();

      if (window.showToast) {
        window.showToast(`Thank you! Enquiry ${res.enquiry_number} submitted successfully.`, 'success');
      }

      if (window.showSuccessModal) {
        window.showSuccessModal({
          title: 'Communication Received',
          message: `Thank you for reaching out to HSMLE India Corporation. Reference Ticket: <strong>${res.enquiry_number}</strong>. Our customer relations engineer will respond to <strong>${res.email}</strong> within 1 business day.`,
        });
      }
    } catch (err) {
      if (window.showToast) {
        window.showToast(`Error: ${err.message}`, 'error');
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Send Corporate Message';
      }
    }
  },
};

window.ContactPage = ContactPage;
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('main-contact-form')) {
    ContactPage.init();
  }
});
