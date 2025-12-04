import React from 'react';
import Link from 'next/link';

export const RefundPolicy: React.FC = () => {
  return (
    <div className="min-h-screen bg-base-100">
      <div className="container mx-auto max-w-4xl px-4 py-12">
        <h1 className="text-4xl font-bold mb-8">Refund Policy</h1>

        <div className="prose prose-lg max-w-none">
          <p className="text-gray-600 mb-6">Effective Date: {new Date().toLocaleDateString()}</p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">1. Overview</h2>
            <p>
              This Refund Policy explains our policy regarding refunds for purchases made through our Service.
              We process all payments through Paddle, our merchant of record, which provides secure payment processing
              and handles refund transactions.
            </p>
            <p className="mt-3">
              We are committed to providing excellent service and value to our customers. If you are not satisfied
              with your purchase, we offer refunds under the conditions outlined in this policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">2. Refund Eligibility</h2>
            <p>You may be eligible for a refund under the following circumstances:</p>
            <ul className="list-disc pl-6 mt-2">
              <li><strong>Technical Issues:</strong> If you experience significant technical problems that prevent you from using the Service</li>
              <li><strong>Billing Errors:</strong> If you were charged incorrectly or without authorization</li>
              <li><strong>Service Unavailability:</strong> If the Service becomes unavailable for extended periods</li>
              <li><strong>Dissatisfaction:</strong> If you are not satisfied with the Service within the first 30 days of purchase</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">3. Refund Request Process</h2>
            <p>To request a refund, please follow these steps:</p>
            <ol className="list-decimal pl-6 mt-2">
              <li>Contact our support team through the application or email</li>
              <li>Provide your order number or transaction ID from Paddle</li>
              <li>Explain the reason for your refund request</li>
              <li>Allow up to 5 business days for our team to review your request</li>
            </ol>
            <p className="mt-3">
              We will respond to all refund requests promptly and work with you to resolve any issues
              before processing a refund.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">4. Refund Timeframes</h2>
            <ul className="list-disc pl-6">
              <li><strong>30-Day Money-Back Guarantee:</strong> Full refund available within 30 days of initial purchase</li>
              <li><strong>Pro-Rated Refunds:</strong> After 30 days, refunds may be pro-rated based on remaining subscription time</li>
              <li><strong>Processing Time:</strong> Approved refunds are processed within 5-10 business days</li>
              <li><strong>Payment Method:</strong> Refunds are issued to the original payment method used for purchase</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">5. Subscription Cancellations</h2>
            <p>
              You can cancel your subscription at any time through your account settings or by contacting support.
              Cancellation policies include:
            </p>
            <ul className="list-disc pl-6 mt-2">
              <li>Access continues until the end of your current billing period</li>
              <li>No automatic refund for unused time unless within the 30-day guarantee period</li>
              <li>Data export available for 30 days after cancellation</li>
              <li>Account reactivation possible within 60 days of cancellation</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">6. Non-Refundable Items</h2>
            <p>The following items are generally not eligible for refunds:</p>
            <ul className="list-disc pl-6 mt-2">
              <li>Services that have been fully consumed or used</li>
              <li>Custom development or consulting services that have been delivered</li>
              <li>Third-party integrations or add-ons purchased through external providers</li>
              <li>Refund requests made more than 90 days after the original purchase</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">7. Paddle Payment Processing</h2>
            <p>
              All payments are processed by Paddle, our merchant of record. Paddle handles:
            </p>
            <ul className="list-disc pl-6 mt-2">
              <li>Secure payment processing</li>
              <li>Tax calculation and collection</li>
              <li>Refund processing and authorization</li>
              <li>Chargeback and dispute management</li>
              <li>Compliance with international payment regulations</li>
            </ul>
            <p className="mt-3">
              For payment-related inquiries, you may also contact Paddle directly through their support channels.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">8. Dispute Resolution</h2>
            <p>
              If you disagree with our refund decision, you may:
            </p>
            <ul className="list-disc pl-6 mt-2">
              <li>Request a review of the decision by providing additional information</li>
              <li>Escalate the matter to our management team</li>
              <li>Contact Paddle directly for payment disputes</li>
              <li>Use your credit card company's dispute resolution process if applicable</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">9. Force Majeure</h2>
            <p>
              We are not liable for refunds due to circumstances beyond our reasonable control,
              including but not limited to acts of nature, government actions, war, terrorism,
              internet service provider failures, or other force majeure events.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">10. Policy Changes</h2>
            <p>
              We reserve the right to modify this Refund Policy at any time. Changes will be effective
              immediately upon posting to our website. Continued use of the Service after changes
              constitutes acceptance of the new policy.
            </p>
            <p className="mt-3">
              Purchases made before policy changes will be governed by the policy in effect at the time of purchase.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">11. Contact Information</h2>
            <p>
              For refund requests or questions about this policy, please contact us:
            </p>
            <ul className="list-disc pl-6 mt-2">
              <li>Through the support feature in the application</li>
              <li>By email at the address provided in our Terms of Service</li>
              <li>Through our website contact form</li>
            </ul>
            <p className="mt-3">
              Please include your order number, transaction ID, and detailed explanation of your request
              to help us process it efficiently.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-300">
          <p className="text-center text-gray-600">
            <Link href="/" className="link link-primary mr-4">Back to App</Link>
            <Link href="/list/terms" className="link link-primary mr-4">Terms of Service</Link>
            <Link href="/list/privacy" className="link link-primary">Privacy Policy</Link>
          </p>
        </div>
      </div>
    </div>
  );
};