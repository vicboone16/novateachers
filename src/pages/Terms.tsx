import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const Terms = () => {
  const navigate = useNavigate();
  const EFFECTIVE = 'September 1, 2025';
  const CONTACT = 'legal@novatrack.app';
  const SUPPORT = 'support@novatrack.app';

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-6 gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        <h1 className="text-3xl font-bold font-heading mb-2">Terms &amp; Conditions</h1>
        <p className="text-sm text-muted-foreground mb-8">Effective date: {EFFECTIVE}</p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6 text-sm leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold mb-2">1. Acceptance of Terms</h2>
            <p>By downloading, installing, or using NovaTrack Teacher Hub ("NovaTrack", "the App", "the Service"), you agree to be bound by these Terms &amp; Conditions ("Terms"). If you do not agree, do not use the App. These Terms form a binding agreement between you and NovaTrack Teacher Hub.</p>
            <p className="mt-2">If you are using NovaTrack on behalf of a school, district, or agency, you represent that you have authority to bind that organization to these Terms.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">2. Description of Service</h2>
            <p>NovaTrack Teacher Hub is a professional data-collection and IEP-management platform designed for use by:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Special education teachers</li>
              <li>Board-certified behavior analysts (BCBAs) and behavior technicians</li>
              <li>Paraeducators and instructional aides working under licensed staff</li>
              <li>School administrators and supervisors overseeing special education programs</li>
            </ul>
            <p className="mt-2">Features include ABC behavioral logging, duration and frequency data collection, IEP goal tracking, AI-assisted IEP drafting, behavior intervention plan (BIP) workflows, classroom game boards, and supervisor dashboards.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">3. Professional Use and Eligibility</h2>
            <p>NovaTrack is intended for professional use by qualified education and behavior support staff. By using the App you represent that:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>You are at least 18 years old</li>
              <li>You are employed by or contracted to work with a school, district, agency, or family in a professional educational or behavioral capacity</li>
              <li>You have the appropriate authorization from your employer and, where required, from parents or guardians to collect and store the data you enter</li>
              <li>You will comply with all applicable laws, including FERPA, IDEA, HIPAA (where applicable), COPPA, and your jurisdiction's student-data privacy laws</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">4. Student Data Ownership and Responsibility</h2>
            <p>You — not NovaTrack — own the student data you enter. NovaTrack acts as a data processor on your behalf. By entering student data you represent that you have lawful authority to do so, including obtaining any required parental consent.</p>
            <p className="mt-2">You are solely responsible for:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>The accuracy of data you enter</li>
              <li>Maintaining confidentiality of student identifiable information</li>
              <li>Complying with your school or district's data-governance policies</li>
              <li>Exporting and retaining records as required by your jurisdiction before closing your account</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">5. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Use the App for any purpose other than legitimate educational or behavioral data collection</li>
              <li>Enter data about individuals without proper authorization</li>
              <li>Share your login credentials with unauthorized persons</li>
              <li>Attempt to reverse-engineer, decompile, or tamper with the App or its backend systems</li>
              <li>Upload harmful, malicious, or illegal content</li>
              <li>Use automated scripts or bots to access the Service</li>
              <li>Violate any applicable law or regulation</li>
            </ul>
            <p className="mt-2">We reserve the right to suspend or terminate accounts that violate these rules without prior notice.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">6. AI Features</h2>
            <p>NovaTrack uses AI assistance for features such as IEP goal drafting, document analysis, and behavior pattern suggestions. AI-generated content is provided as a drafting aid only. It does not constitute clinical, legal, or educational advice. You are solely responsible for reviewing, editing, and approving any AI-generated text before using it in official documents or with students.</p>
            <p className="mt-2">Do not enter full student names, Social Security numbers, Medicaid IDs, or other highly sensitive identifiers into AI-powered features.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">7. Accounts and Security</h2>
            <p>You are responsible for maintaining the security of your account credentials. Notify us immediately at {SUPPORT} if you suspect unauthorized access. We are not liable for losses resulting from unauthorized use of your account where you failed to keep credentials secure.</p>
            <p className="mt-2">We may require you to change your password, enforce multi-factor authentication, or suspend your account if we detect suspicious activity.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">8. Subscriptions and Payments</h2>
            <p>Certain features of NovaTrack may require a paid subscription. Subscription terms, pricing, and billing cycles are displayed at the time of purchase. All payments are processed by Apple App Store or another payment provider; NovaTrack does not store payment card information.</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Free tier:</strong> Core data collection features available at no cost</li>
              <li><strong>Paid tier:</strong> Advanced AI features, supervisor dashboard, and multi-classroom management</li>
              <li><strong>Refunds:</strong> Refund requests for App Store purchases must be submitted through Apple. We will honor refund requests within 14 days of initial purchase for any reason.</li>
              <li><strong>Cancellation:</strong> Cancel any time via your App Store subscription settings; access continues until the end of the current billing period</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">9. Intellectual Property</h2>
            <p>The App, its interface, branding, and underlying technology are owned by NovaTrack Teacher Hub and protected by copyright, trademark, and other intellectual property laws. These Terms do not grant you any rights to our intellectual property except the limited license to use the App as described herein.</p>
            <p className="mt-2">You retain all rights to the data you enter. By using the Service you grant NovaTrack a limited, non-exclusive license to process your data solely to provide and improve the Service as described in our Privacy Policy.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">10. Disclaimer of Warranties</h2>
            <p>THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE.</p>
            <p className="mt-2">NovaTrack is a data-collection and organizational tool. It does not provide medical, clinical, therapeutic, or legal advice. Always consult qualified professionals for clinical and legal decisions.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">11. Limitation of Liability</h2>
            <p>TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, NOVATRACK TEACHER HUB SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF DATA, LOSS OF REVENUE, OR LOSS OF GOODWILL, ARISING FROM YOUR USE OF OR INABILITY TO USE THE SERVICE.</p>
            <p className="mt-2">OUR TOTAL LIABILITY TO YOU FOR ANY CLAIM ARISING FROM THESE TERMS OR THE SERVICE SHALL NOT EXCEED THE AMOUNTS YOU PAID TO US IN THE TWELVE MONTHS PRECEDING THE CLAIM, OR $100 USD, WHICHEVER IS GREATER.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">12. Indemnification</h2>
            <p>You agree to indemnify and hold harmless NovaTrack Teacher Hub and its officers, employees, and contractors from any claims, damages, losses, or expenses (including reasonable attorneys' fees) arising from: (a) your use of the Service; (b) your violation of these Terms; (c) your violation of any applicable law; or (d) data you entered into the Service.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">13. Termination</h2>
            <p>Either party may terminate this agreement at any time. You may delete your account in the app Settings. We may suspend or terminate your access for violations of these Terms, non-payment, or if required by law. Upon termination you retain the right to export your data for 30 days; after that period, data may be permanently deleted.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">14. Governing Law and Disputes</h2>
            <p>These Terms are governed by the laws of the State of California, United States, without regard to conflict-of-law principles. Any dispute not resolved informally shall be submitted to binding arbitration under the American Arbitration Association's Commercial Arbitration Rules, conducted in English in San Francisco, California. You waive any right to a jury trial or to participate in a class action.</p>
            <p className="mt-2"><strong>Exception:</strong> Either party may seek injunctive relief in any court of competent jurisdiction to prevent irreparable harm.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">15. Changes to These Terms</h2>
            <p>We may update these Terms from time to time. We will notify you of material changes via in-app notice or email at least 14 days before they take effect. Continued use of the Service after the effective date constitutes acceptance of the revised Terms.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">16. Contact Us</h2>
            <p>Questions about these Terms: <a href={`mailto:${CONTACT}`} className="text-primary underline">{CONTACT}</a></p>
            <p className="mt-1">General support: <a href={`mailto:${SUPPORT}`} className="text-primary underline">{SUPPORT}</a></p>
          </section>

        </div>

        <p className="mt-10 text-xs text-muted-foreground">© {new Date().getFullYear()} NovaTrack Teacher Hub. All rights reserved.</p>
      </div>
    </div>
  );
};

export default Terms;
