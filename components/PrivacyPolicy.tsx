import React from 'react';
import { Link } from 'react-router-dom';

export const PrivacyPolicy: React.FC = () => {
  return (
    <div className="min-h-screen bg-base-100">
      <div className="container mx-auto max-w-4xl px-4 py-12">
        <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>

        <div className="prose prose-lg max-w-none">
          <p className="text-gray-600 mb-6">Effective Date: {new Date().toLocaleDateString()}</p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">1. Information We Collect</h2>
            <p>We collect information you provide directly to us, such as when you:</p>
            <ul className="list-disc pl-6 mt-2">
              <li>Create an account</li>
              <li>Use our Service</li>
              <li>Contact us for support</li>
              <li>Participate in our features</li>
            </ul>
            <p className="mt-3">The types of information we may collect include:</p>
            <ul className="list-disc pl-6 mt-2">
              <li>Email address</li>
              <li>Username and password</li>
              <li>Content you create, share, or upload</li>
              <li>Group membership and collaboration data</li>
              <li>Usage information and preferences</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">2. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-6 mt-2">
              <li>Provide, maintain, and improve our Service</li>
              <li>Process transactions and send related information</li>
              <li>Send technical notices, updates, security alerts, and support messages</li>
              <li>Respond to your comments, questions, and requests</li>
              <li>Monitor and analyze trends, usage, and activities</li>
              <li>Detect, investigate, and prevent fraudulent transactions and other illegal activities</li>
              <li>Personalize and improve the Service</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">3. Information Sharing and Disclosure</h2>
            <p>We do not sell, trade, or rent your personal information to third parties. We may share your information in the following situations:</p>
            <ul className="list-disc pl-6 mt-2">
              <li><strong>With your consent:</strong> We may share your information with your explicit consent</li>
              <li><strong>For legal reasons:</strong> When required by law or to respond to legal process</li>
              <li><strong>To protect rights:</strong> When we believe disclosure is necessary to protect our rights, property, or safety</li>
              <li><strong>Business transfers:</strong> In connection with any merger, sale of company assets, or acquisition</li>
              <li><strong>Service providers:</strong> With third-party vendors who perform services on our behalf (e.g., Supabase for data storage, Paddle for payment processing)</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">4. Data Storage and Security</h2>
            <p>
              We use Supabase to store and manage your data. Supabase implements industry-standard security measures
              including encryption at rest and in transit. While we strive to use commercially acceptable means
              to protect your personal information, we cannot guarantee its absolute security.
            </p>
            <p className="mt-3">
              Your data is stored on secure servers and we implement appropriate technical and organizational measures
              to protect against unauthorized access, alteration, disclosure, or destruction of your information.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">5. Your Data Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-6 mt-2">
              <li><strong>Access:</strong> Request a copy of the personal information we hold about you</li>
              <li><strong>Correction:</strong> Request correction of inaccurate or incomplete information</li>
              <li><strong>Deletion:</strong> Request deletion of your personal information</li>
              <li><strong>Portability:</strong> Request your data in a structured, machine-readable format</li>
              <li><strong>Object:</strong> Object to our processing of your personal information</li>
              <li><strong>Withdraw consent:</strong> Withdraw consent where we rely on it for processing</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">6. Cookies and Tracking Technologies</h2>
            <p>
              We use cookies and similar tracking technologies to track activity on our Service and hold certain information.
              Cookies are files with small amount of data which may include an anonymous unique identifier.
              You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">7. Third-Party Services</h2>
            <p>Our Service may contain links to third-party websites or services that are not owned or controlled by us.
              We have no control over and assume no responsibility for the content, privacy policies, or practices of any third-party services.</p>
            <p className="mt-3">Key third-party services we use:</p>
            <ul className="list-disc pl-6 mt-2">
              <li><strong>Supabase:</strong> Database and authentication services</li>
              <li><strong>Paddle:</strong> Payment processing and subscription management</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">8. Children's Privacy</h2>
            <p>
              Our Service is not intended for children under 13 years of age. We do not knowingly collect
              personal information from children under 13. If you are a parent or guardian and you are aware
              that your child has provided us with personal information, please contact us.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">9. International Data Transfers</h2>
            <p>
              Your information may be transferred to and maintained on computers located outside of your state,
              province, country, or other governmental jurisdiction where the data protection laws may differ
              from those of your jurisdiction.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">10. Data Retention</h2>
            <p>
              We will retain your personal information only for as long as is necessary for the purposes set out
              in this Privacy Policy. We will retain and use your information to the extent necessary to comply
              with our legal obligations, resolve disputes, and enforce our policies.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">11. Changes to This Privacy Policy</h2>
            <p>
              We may update our Privacy Policy from time to time. We will notify you of any changes by posting
              the new Privacy Policy on this page and updating the "Effective Date" at the top of this Privacy Policy.
              You are advised to review this Privacy Policy periodically for any changes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">12. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy or our data practices, please contact us
              through the application or at the contact information provided below.
            </p>
            <p className="mt-3">
              For data protection inquiries or to exercise your rights, please submit a request through
              the application's support feature.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-300">
          <p className="text-center text-gray-600">
            <Link to="/" className="link link-primary mr-4">Back to App</Link>
            <Link to="/terms-of-service" className="link link-primary mr-4">Terms of Service</Link>
            <Link to="/refund-policy" className="link link-primary">Refund Policy</Link>
          </p>
        </div>
      </div>
    </div>
  );
};