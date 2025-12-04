import React, { useState } from 'react';
import Link from 'next/link';
import { UserAuth } from './UserAuth';

export const PricingPage: React.FC = () => {
  const [showAuth, setShowAuth] = useState(false);

  const features = [
    'Unlimited lists and content',
    'Real-time collaboration',
    'Public sharing with custom links',
    'Cross-platform access',
    'Advanced workflow tools',
    'AI-powered content generation',
    'SEO metadata extraction',
    'Secure cloud storage',
    'Priority support',
    'No advertisements'
  ];

  const faqs = [
    {
      question: 'What is JustShare?',
      answer: 'JustShare is a minimalist list management platform that enables real-time collaboration and seamless sharing across teams and individuals.'
    },
    {
      question: 'Can I cancel anytime?',
      answer: 'Yes, you can cancel your subscription at any time. Your access will continue until the end of your current billing period.'
    },
    {
      question: 'Is there a free trial?',
      answer: 'We offer a limited free tier to try the basic features. Upgrade to Pro for unlimited access and advanced collaboration tools.'
    },
    {
      question: 'How does billing work?',
      answer: 'You\'ll be billed $5 monthly on the same date you subscribe. We use secure payment processing through Paddle.'
    },
    {
      question: 'What payment methods do you accept?',
      answer: 'We accept all major credit cards, PayPal, and other payment methods through our secure payment processor Paddle.'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm border-b border-gray-200">
        <div className="w-full px-4 py-4">
          <div className="flex justify-between items-center">
            <Link href="/" className="text-xl font-semibold text-gray-900 hover:text-blue-600 transition-colors">
              List App
            </Link>
            <button
              onClick={() => setShowAuth(true)}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Sign In
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-12 pt-24">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Simple Pricing for
            <span className="text-blue-600"> Powerful Collaboration</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Everything you need to manage lists, collaborate in real-time, and share content seamlessly.
          </p>
        </div>

        {/* Pricing Card */}
        <div className="max-w-lg mx-auto mb-16">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 relative">
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
              <span className="bg-blue-600 text-white px-4 py-1 rounded-full text-sm font-medium">
                Most Popular
              </span>
            </div>
            
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">JustShare Pro</h3>
              <div className="mb-4">
                <span className="text-5xl font-bold text-gray-900">$5</span>
                <span className="text-gray-600 ml-2">/month</span>
              </div>
              <p className="text-gray-600">
                Perfect for individuals and small teams who want unlimited access.
              </p>
            </div>

            <ul className="space-y-4 mb-8">
              {features.map((feature, index) => (
                <li key={index} className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">{feature}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => setShowAuth(true)}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Start Your Subscription
            </button>
            
            <p className="text-center text-sm text-gray-500 mt-4">
              Cancel anytime. No hidden fees.
            </p>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Frequently Asked Questions
          </h2>
          <div className="max-w-3xl mx-auto space-y-6">
            {faqs.map((faq, index) => (
              <div key={index} className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  {faq.question}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center bg-blue-50 rounded-2xl p-8 mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Ready to get started?
          </h2>
          <p className="text-xl text-gray-600 mb-6">
            Join thousands of users who trust JustShare for their collaboration needs.
          </p>
          <button
            onClick={() => setShowAuth(true)}
            className="bg-blue-600 text-white py-3 px-8 rounded-lg hover:bg-blue-700 transition-colors font-medium inline-block"
          >
            Start Your Subscription
          </button>
        </div>

        {/* Footer Links */}
        <div className="text-center">
          <div className="flex flex-wrap justify-center items-center gap-1 text-sm mb-4">
            <Link href="/list/terms" className="text-gray-500 hover:text-gray-700 transition-colors">
              Terms of Service
            </Link>
            <span className="text-gray-400">·</span>
            <Link href="/list/privacy" className="text-gray-500 hover:text-gray-700 transition-colors">
              Privacy Policy
            </Link>
            <span className="text-gray-400">·</span>
            <Link href="/list/refund" className="text-gray-500 hover:text-gray-700 transition-colors">
              Refund Policy
            </Link>
          </div>
          <p className="text-xs text-gray-500">
            © {new Date().getFullYear()} List App. All rights reserved.
          </p>
        </div>
      </div>

      {/* Auth Modal */}
      {showAuth && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-1 max-w-md w-full relative">
            <button
              onClick={() => setShowAuth(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <UserAuth 
              onAuthSuccess={() => {
                setShowAuth(false);
                // Could redirect to dashboard or show success message
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};