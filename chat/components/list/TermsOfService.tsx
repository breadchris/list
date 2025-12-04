import React from 'react';
import Link from 'next/link';

export const TermsOfService: React.FC = () => {
  return (
    <div className="min-h-screen bg-base-100">
      <div className="container mx-auto max-w-4xl px-4 py-12">
        <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>

        <div className="prose prose-lg max-w-none">
          <p className="text-gray-600 mb-6">Effective Date: {new Date().toLocaleDateString()}</p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
            <p>
              By accessing and using this application ("Service"), you accept and agree to be bound by the terms
              and provision of this agreement. If you do not agree to abide by the above, please do not use this Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">2. Use License</h2>
            <p>
              Permission is granted to temporarily access and use the Service for personal, non-commercial use.
              This is the grant of a license, not a transfer of title, and under this license you may not:
            </p>
            <ul className="list-disc pl-6 mt-2">
              <li>modify or copy the materials;</li>
              <li>use the materials for any commercial purpose or for any public display;</li>
              <li>attempt to reverse engineer any software contained in the Service;</li>
              <li>remove any copyright or other proprietary notations from the materials.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">3. User Accounts</h2>
            <p>
              When you create an account with us, you must provide information that is accurate, complete,
              and current at all times. You are responsible for safeguarding the password and for all activities
              that occur under your account.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">4. Content and Data</h2>
            <p>
              Our Service allows you to post, link, store, share and otherwise make available certain information,
              text, or materials ("Content"). You are responsible for Content that you post to the Service,
              including its legality, reliability, and appropriateness.
            </p>
            <p className="mt-3">
              By posting Content to the Service, you grant us the right and license to use, modify, publicly perform,
              publicly display, reproduce, and distribute such Content on and through the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">5. Privacy</h2>
            <p>
              Your use of our Service is also governed by our Privacy Policy.
              Please review our <Link href="/list/privacy" className="link link-primary">Privacy Policy</Link>,
              which also governs the Site and informs users of our data collection practices.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">6. Prohibited Uses</h2>
            <p>You may not use our Service:</p>
            <ul className="list-disc pl-6 mt-2">
              <li>For any unlawful purpose or to solicit others to perform unlawful acts;</li>
              <li>To violate any international, federal, provincial, or state regulations, rules, laws, or local ordinances;</li>
              <li>To infringe upon or violate our intellectual property rights or the intellectual property rights of others;</li>
              <li>To harass, abuse, insult, harm, defame, slander, disparage, intimidate, or discriminate;</li>
              <li>To submit false or misleading information;</li>
              <li>To upload or transmit viruses or any other type of malicious code;</li>
              <li>To interfere with or circumvent the security features of the Service.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">7. Payment and Refunds</h2>
            <p>
              Certain features of the Service may be subject to payment now or in the future.
              Payment terms and refund policies are detailed in our <Link href="/list/refund" className="link link-primary">Refund Policy</Link>.
            </p>
            <p className="mt-3">
              We use third-party payment processor Paddle to handle all payment processing.
              By providing payment information, you agree to Paddle's terms of service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">8. Termination</h2>
            <p>
              We may terminate or suspend your account and bar access to the Service immediately,
              without prior notice or liability, under our sole discretion, for any reason whatsoever
              and without limitation, including but not limited to a breach of the Terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">9. Disclaimer</h2>
            <p>
              The information on the Service is provided with the understanding that the Company is not
              herein engaged in rendering legal, accounting, tax, or other professional advice and services.
              The Service is provided "as is" and "as available" without any warranty or condition,
              express, implied, or statutory.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">10. Limitation of Liability</h2>
            <p>
              In no event shall our company, nor its directors, employees, partners, agents, suppliers,
              or affiliates, be liable for any indirect, incidental, special, consequential, or punitive damages,
              including without limitation, loss of profits, data, use, goodwill, or other intangible losses.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">11. Governing Law</h2>
            <p>
              These Terms shall be governed and construed in accordance with the laws of the United States,
              without regard to its conflict of law provisions. Our failure to enforce any right or provision
              of these Terms will not be considered a waiver of those rights.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">12. Changes to Terms</h2>
            <p>
              We reserve the right, at our sole discretion, to modify or replace these Terms at any time.
              If a revision is material, we will provide at least 30 days notice prior to any new terms taking effect.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">13. Contact Information</h2>
            <p>
              If you have any questions about these Terms, please contact us through the application
              or via the contact information provided in our Privacy Policy.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-300">
          <p className="text-center text-gray-600">
            <Link href="/" className="link link-primary mr-4">Back to App</Link>
            <Link href="/list/privacy" className="link link-primary mr-4">Privacy Policy</Link>
            <Link href="/list/refund" className="link link-primary">Refund Policy</Link>
          </p>
        </div>
      </div>
    </div>
  );
};